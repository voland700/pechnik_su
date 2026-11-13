// Optional smoke check using installed Chrome and Node's native CDP/WebSocket.
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const baseUrl = process.env.SHOWCASE_BASE_URL ?? 'http://127.0.0.1:4321';
const profile = await mkdtemp(join(tmpdir(), 'pechnik-header-'));
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: ['ignore','ignore','ignore','pipe','pipe'] });
let socket;
try {
  let buffer='';
  socket={close(){chrome.stdio[3].end();},send(value){chrome.stdio[3].write(value+'\0');},
    addEventListener(_type,handler){chrome.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\0'))>=0){const data=buffer.slice(0,end);buffer=buffer.slice(end+1);if(data)handler({data});}});}};
  let sessionId;
  let id = 0;
  const pending = new Map();
  const errors = [];
  let pageLoadedResolve;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Page.loadEventFired') pageLoadedResolve?.();
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error' && !message.params.entry.url?.endsWith('favicon.ico')) errors.push(message.params.entry);
    const request = pending.get(message.id);
    if (request) { pending.delete(message.id); message.error ? request.reject(message.error) : request.resolve(message.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error('CDP timeout: ' + method)); }, 30000);
    pending.set(requestId, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
    socket.send(JSON.stringify({ id: requestId, method, params, sessionId }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const target = await send('Target.createTarget',{url:'about:blank'});
  sessionId=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir('artifacts/product-detail', {recursive:true});
  const report=[];
  // External media is preserved in HTML; its providers are outside local QA.
  await send('Network.enable');
  await send('Network.setBlockedURLs',{urls:['*rutube.ru/*','*youtube.com/*','*catalog.arguv.com/*','*www.pechnik.su/upload/*']});
  for(let product=1;product<=5;product++) {
    await send('Page.navigate',{url:baseUrl+`/catalog/product_${product}/`});
    await evaluate(`new Promise(resolve=>{let n=0;const t=setInterval(()=>{if(document.querySelector('[data-gallery-open]') && document.querySelector('[data-product-form]')?.noValidate){clearInterval(t);resolve(true)}else if(++n>100){clearInterval(t);resolve(false)}},50)})`);
    await evaluate('document.fonts.ready');
    await evaluate(`Promise.all([...document.querySelectorAll('.product-gallery img')].map(i=>{i.loading='eager';return i.decode()}))`);
    for(const width of [320,375,414,768,992,1200,1280,1440]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
      await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      const state=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,h1:document.querySelectorAll('h1').length,filter:!!document.querySelector('[data-catalog-filter]'),status:document.querySelector('.product-purchase__status').textContent.trim(),disabled:document.querySelector('[name=quantity]').disabled,photos:document.querySelectorAll('[data-gallery-index]').length,broken:[...document.querySelectorAll('.product-gallery img')].some(i=>!i.naturalWidth)})`);
      assert(!state.overflow,JSON.stringify({product,width,state}));assert.equal(state.h1,1);assert(!state.filter);assert(!state.broken);assert.equal(state.disabled,product===5);
      if(product===4)assert.equal(state.status,'Под заказ');
      if(product===5)assert.equal(state.status,'Нет в наличии');
      const related = await evaluate(`(async()=>{
        const section=document.querySelector('.product-detail__related');
        const grid=section.querySelector('[role="list"]');
        const images=[...section.querySelectorAll('img')];
        await Promise.all(images.map(i=>{i.loading='eager';return i.decode()}));
        const offer=document.querySelector('.product-detail__offer');
        return {
          sections:document.querySelectorAll('.product-detail__related').length,
          heading:section.querySelector('h2').textContent,
          products:section.querySelectorAll('[data-product-card]').length,
          categories:section.querySelectorAll('.catalog-subcategories__item').length,
          names:[...section.querySelectorAll('.product-card__title')].map(e=>e.textContent),
          columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
          images:images.length,broken:images.some(i=>!i.naturalWidth),
          offer:offer.textContent,align:getComputedStyle(offer).textAlign,
          after:!!(section.compareDocumentPosition(offer)&Node.DOCUMENT_POSITION_FOLLOWING)
        };
      })()`);
      const withProducts=[1,2,4].includes(product);
      assert.equal(related.sections,1);
      assert.equal(related.heading,withProducts?'Похожие товары':'Сопутствующие товары');
      assert.equal(related.products,withProducts?4:0);
      assert.equal(related.categories,withProducts?0:4);
      assert.equal(new Set(related.names).size,related.names.length);
      assert.equal(related.columns,width>=1200?4:width>=768?2:withProducts?1:2);
      assert.equal(related.images,4);assert(!related.broken);assert(related.after);
      assert.equal(related.offer,'Информация о товаре носит исключительно ознакомительный характер и не является публичной офертой.');
      assert.equal(related.align,width>=992?'right':'start');
      state.related=related;
      report.push({product,width,...state});
      if((product===2 && [375,1440].includes(width)) || (product===3 && width===992)) {
        await evaluate("document.querySelector('.page-heading').scrollIntoView()");
        const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        await writeFile(`artifacts/product-detail/product-${product}-${width}.png`,Buffer.from(shot.data,'base64'));
      }
    }
    if(product!==5) {
      assert.equal(await evaluate(`(()=>{document.querySelector('[data-quantity-step="1"]').click();return document.querySelector('[name=quantity]').value})()`),'2');
      for(const bad of ['0','-4','1.5','']) assert.equal(await evaluate(`(()=>{const i=document.querySelector('[name=quantity]');i.value=${JSON.stringify(bad)};i.dispatchEvent(new Event('change'));return i.value})()`),'1');
    } else {
      assert(await evaluate(`document.querySelector('.product-purchase__prices').textContent.includes('Цена по запросу') && !document.querySelector('.product-detail__brand') && !document.querySelector('.product-detail__benefits') && !document.querySelector('.product-documents') && [...document.querySelectorAll('.product-purchase button')].every(b=>b.disabled)`));
    }
    if(product===3) {
      assert.equal(await evaluate("document.querySelectorAll('[data-gallery-index]').length"),14);
      assert(await evaluate(`(()=>{const el=document.querySelector('[data-gallery-thumbs]');const before=el.swiper.activeIndex;document.querySelector('[data-gallery-next]').click();return el.swiper.activeIndex>before})()`));
    }
    if(product===4)assert.equal(await evaluate("document.querySelectorAll('[data-gallery-thumbs]').length"),0);
    const index=product===4?0:2;
    await evaluate(`document.querySelector('[data-gallery-index="${index}"]')?.click();document.querySelector('[data-gallery-open]').click()`);
    await evaluate('new Promise(r=>setTimeout(r,500))');
    assert(await evaluate(`!!document.querySelector('.fancybox__container')`));
    assert(await evaluate(`(()=>{const src=document.querySelector('[data-gallery-image]').src;return [...document.querySelectorAll('.fancybox__container img')].some(i=>i.src===src)})()`));
    await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    await evaluate('new Promise(r=>setTimeout(r,400))');
    for(const file of ['shops','delivery','baying','payment','return','install']) {
      await evaluate(`document.querySelector('[data-product-information="${file}"]').click()`);
      await evaluate('new Promise(r=>setTimeout(r,500))');
      assert(await evaluate("!!document.querySelector('.fancybox__container .product-information')"),file);
      assert(await evaluate("document.querySelector('.product-information').scrollWidth<=document.querySelector('.product-information').clientWidth"),file);
      assert(await evaluate(`(()=>{const b=document.querySelector('.product-information-modal .is-close-button');if(!b)return false;const r=b.getBoundingClientRect();return r.width>=43&&r.height>=43&&r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===b})()`),file+' close button visible');
      const closePoint=await evaluate("(()=>{const r=document.querySelector('.product-information-modal .is-close-button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
      await send('Input.dispatchMouseEvent',{type:'mousePressed',...closePoint,button:'left',clickCount:1});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',...closePoint,button:'left',clickCount:1});
      await evaluate('new Promise(r=>setTimeout(r,500))');
      assert(await evaluate("!document.querySelector('.product-information-modal')"),file+' closed');
    }
  }
  assert.equal(errors.filter(e=>e.exceptionId).length,0,JSON.stringify(errors));
  await writeFile('artifacts/product-detail/results.json',JSON.stringify({report,externalMediaBlocked:true,errors},null,2));
  console.log('Product detail checks passed: five products, eight widths, exclusive recommendations, offer, gallery/Fancybox, six modals, quantity, statuses and empty states.');
} finally {socket?.close();chrome.kill();}




