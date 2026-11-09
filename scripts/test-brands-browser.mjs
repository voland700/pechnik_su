// Optional smoke check using installed Chrome and Node's native CDP/WebSocket.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const baseUrl = process.env.SHOWCASE_BASE_URL ?? 'http://127.0.0.1:4321';
const profile = await mkdtemp(join(tmpdir(), 'pechnik-header-'));
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: ['ignore','ignore','ignore','pipe','pipe'] });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let buffer='';
  socket={close(){chrome.stdio[3].end();},send(value){chrome.stdio[3].write(value+'\0');},
    addEventListener(_type,handler){chrome.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\0'))>=0){const data=buffer.slice(0,end);buffer=buffer.slice(end+1);if(data)handler({data});}});}};
  let sessionId;
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
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




  await send('Page.navigate',{url:baseUrl+'/'});await pause(800);
  await mkdir('artifacts/brands',{recursive:true});
  const expected=['HWAM','WIKING','Morsø','JOTUL','SCAN','Romotop','Везувий','ETNA','Эверест','ASTON','ПроМеталл','КераСтиль','Амфора','SKAMOL','Supersilika','Фаспан','NICHIHA'];
  const results=[];
  for(const width of [375,768,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await pause(200);
    await evaluate(`document.fonts.ready.then(()=>{const v=document.querySelector('[data-brands-viewport]');v.swiper.slideTo(0,0);v.scrollIntoView({behavior:'instant',block:'center'});return Promise.all([...v.querySelectorAll('img')].map(i=>{i.loading='eager';return i.decode()}))})`);
    const state=await evaluate(`(()=>{const v=document.querySelector('[data-brands-viewport]'),s=v.swiper;return {
      width:innerWidth,count:s.slides.length,perView:s.params.slidesPerView,overflow:document.documentElement.scrollWidth>innerWidth,
      names:[...v.querySelectorAll('a')].map(a=>a.getAttribute('aria-label').replace('Товары производителя ','')),
      hrefs:[...v.querySelectorAll('a')].every(a=>a.getAttribute('href')==='#'),
      images:[...v.querySelectorAll('img')].every(i=>i.naturalWidth>0&&getComputedStyle(i).objectFit==='contain'),
      grayscale:[...v.querySelectorAll('img')].every(i=>getComputedStyle(i).filter==='grayscale(1)'),
      prev:document.querySelector('[data-brands-prev]').disabled,loop:s.params.loop};})()`);
    assert.equal(state.count,17);assert.equal(state.perView,width>=1200?5:width>=992?4:width>=768?3:2);
    assert.deepEqual(state.names,expected);assert(!state.overflow);assert(state.hrefs);assert(state.images);assert(state.grayscale);assert(state.prev);assert(!state.loop);
    results.push(state);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile('artifacts/brands/'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await evaluate(`document.querySelector('[data-brands-next]').click()`);await pause(450);
  assert.equal(await evaluate(`document.querySelector('[data-brands-viewport]').swiper.activeIndex`),1);
  await evaluate(`document.querySelector('[data-brands-prev]').click()`);await pause(450);
  assert.equal(await evaluate(`document.querySelector('[data-brands-viewport]').swiper.activeIndex`),0);
  await evaluate(`document.querySelector('[data-brands-viewport]').focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});await pause(450);
  assert.equal(await evaluate(`document.querySelector('[data-brands-viewport]').swiper.activeIndex`),1);
  await evaluate(`document.querySelector('[data-brands-viewport]').swiper.slideTo(16,0)`);
  assert(await evaluate(`document.querySelector('[data-brands-next]').disabled`));
  await evaluate(`document.querySelector('[data-brands-viewport]').swiper.slideTo(0,0)`);
  await send('DOM.enable');await send('CSS.enable');
  const {root}=await send('DOM.getDocument');
  const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'.brands-slider__link'});
  await send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['hover']});await pause(350);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.brands-slider__image')).filter`),'grayscale(0)');
  await send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]});await pause(350);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.brands-slider__image')).filter`),'grayscale(1)');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
  await evaluate(`document.querySelector('.brands-slider__link').focus()`);
  assert(await evaluate(`document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).outlineWidth==='3px'`));
  for(let i=1;i<17;i++) {
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});await pause(30);
    assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`),'Товары производителя '+expected[i]);
  }
  assert(await evaluate(`document.querySelector('[data-brands-viewport]').swiper.isEnd`));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await pause(100);
  assert.equal(await evaluate(`document.querySelector('[data-brands-viewport]').swiper.params.speed`),0);
  // Real touch gesture on a narrow viewport.
  await send('Emulation.setDeviceMetricsOverride',{width:375,height:1000,deviceScaleFactor:1,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true});await pause(200);
  await evaluate(`const v=document.querySelector('[data-brands-viewport]');v.swiper.slideTo(0,0);v.scrollIntoView({block:'center',behavior:'instant'})`);
  const point=await evaluate(`(()=>{const b=document.querySelector('[data-brands-viewport]').getBoundingClientRect();return {x:b.right-20,y:b.top+b.height/2}})()`);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  for(const dx of [30,60,100,140]) {await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x-dx,y:point.y}]});await pause(30);}
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause(200);
  assert(await evaluate(`document.querySelector('[data-brands-viewport]').swiper.activeIndex>0`));
  if(process.argv.includes('--fixtures')) {
    await send('Page.navigate',{url:baseUrl+'/brands-test/'});await pause(600);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-brands-viewport]')].map(v=>v.swiper.slides.length)`),[1,3,17]);
    assert(await evaluate(`document.querySelectorAll('[data-brands-next]')[0].disabled`));
    await evaluate(`document.querySelectorAll('[data-brands-next]')[2].click()`);await pause(50);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-brands-viewport]')].map(v=>v.swiper.activeIndex)`),[0,0,1]);
  }
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  await send('Page.navigate',{url:baseUrl+'/'});await pause(500);
  assert(await evaluate(`(()=>{const v=document.querySelector('[data-brands-viewport]');v.scrollIntoView({behavior:'instant'});v.scrollLeft=v.scrollWidth;return v.querySelectorAll('a').length===17&&v.scrollLeft>0&&!v.classList.contains('swiper-initialized')})()`));
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/brands/results.json',JSON.stringify(results,null,2));
  console.log('Passed: 17 brands/images, four widths, navigation/boundaries, keyboard, touch, grayscale/focus, reduced motion, independent instances, no-JS fallback, console.');
} finally {socket?.close();chrome.kill();}
