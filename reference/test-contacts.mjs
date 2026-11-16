// Optional smoke check using installed Chrome and Node's native CDP/WebSocket.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
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


  const results=[];
  for(const width of [320,375,576,768,992,1200,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:baseUrl+'/about/contacts/'});await pause(650);
    await evaluate(`Promise.all([...document.querySelectorAll('.store-card img')].map(img=>{img.loading='eager';return img.decode()}))`);
    const state=await evaluate(`(()=>{const r=e=>e.getBoundingClientRect();return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,h1:[...document.querySelectorAll('h1')].map(e=>e.textContent),mainCount:document.querySelectorAll('main').length,breadcrumbs:[...document.querySelectorAll('.breadcrumbs li')].map(e=>({text:e.textContent.trim(),href:e.querySelector('a')?.getAttribute('href')})),stores:[...document.querySelectorAll('.store-card')].map(c=>({name:c.querySelector('h3').textContent,address:c.querySelector('address span').textContent,hours:c.querySelector('.store-card__hours span').textContent,departments:[...c.querySelectorAll('.store-card__department')].map(e=>e.textContent),phones:[...c.querySelectorAll('.store-card__phone')].map(e=>({text:e.textContent.trim(),href:e.getAttribute('href'),height:r(e).height})),links:[...c.querySelectorAll('.store-card__image-link,.store-card__title a')].map(e=>e.getAttribute('href')),images:[...c.querySelectorAll('img')].map(e=>({loaded:e.naturalWidth>0,alt:e.alt,hidden:e.getAttribute('aria-hidden')})),fit:getComputedStyle(c.querySelector('.store-card__image')).objectFit,vertical:r(c.querySelector('.store-card__content')).top>=r(c.querySelector('.store-card__image')).bottom-1,imageWidth:r(c.querySelector('.store-card__image')).width,cardWidth:r(c).width})),map:{width:r(document.querySelector('.contacts-map__container')).width,height:r(document.querySelector('.contacts-map__container')).height,text:document.querySelector('.contacts-map').textContent.trim()},remoteMap:!!document.querySelector('.contacts-page iframe, .contacts-page script'),icons:[...document.querySelectorAll('.store-card__icon')].map(e=>new URL(e.src).pathname)}})()`);
    assert.deepEqual(state.h1,['Контакты']);assert.equal(state.mainCount,1);assert(!state.overflow);assert.equal(state.stores.length,2);assert(!state.remoteMap);
    assert.deepEqual(state.breadcrumbs,[{text:'Главная',href:'/'},{text:'О печном центре',href:'/about/'},{text:'Контакты'}]);
    assert.equal(state.stores[0].name,'Печной Центр Ясенево - Центральный склад');assert.equal(state.stores[1].name,'Печной Центр Заокск');
    assert.equal(state.stores[0].address,'117574 г. Москва, дорога МКАД 38 км, владение 4Б, стр.1');
    assert.equal(state.stores[1].address,'Тульская область, Заокский район, д. Панькино, (Симферопольское шоссе, 112 км. – 10 минут от Серпухова)');
    assert.deepEqual(state.stores[0].departments,['Печной кирпич, литьё, смеси','Печи-камины JOTUL, топки, дымоходы']);assert.deepEqual(state.stores[1].departments,[]);
    assert.deepEqual(state.stores.flatMap(s=>s.phones.map(p=>p.href)),['tel:+79168818399','tel:+79853088316','tel:+79612673880']);
    for(const s of state.stores){assert.equal(s.hours,'с 9.00 до 18.00 (без выходных)');assert.deepEqual(s.links,['#','#']);assert.equal(s.fit,'cover');assert.equal(s.vertical,width<768);assert.equal(s.imageWidth,width<768?s.cardWidth:224);assert(s.images.every(i=>i.loaded));assert.equal(s.images[0].alt,s.name);assert(s.images.slice(1).every(i=>i.hidden==='true'&&i.alt===''));assert(s.phones.every(p=>p.height>=44));}
    assert.equal(state.map.height,width<768?288:384);assert.equal(state.map.text,'Здесь будет размещена карта магазинов');
    await evaluate(`document.querySelector('.store-card__phone').focus()`);assert.equal(await evaluate(`getComputedStyle(document.activeElement).outlineStyle`),'solid');
    await evaluate(`document.activeElement.blur()`);await send('Runtime.evaluate',{expression:'window.scrollTo(0,document.querySelector(".contacts-page").getBoundingClientRect().top+scrollY-16)'});
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('contacts-'+width+'.png',Buffer.from(shot.data,'base64'));
    results.push(state);
  }
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  await send('Page.navigate',{url:baseUrl+'/about/contacts/'});await pause(500);assert.equal(await evaluate(`document.querySelectorAll('.store-card').length`),2);
  assert.equal(errors.length,0,JSON.stringify(errors));await writeFile('contacts-results.json',JSON.stringify(results,null,2));
  console.log('PASS: seven widths, exact contacts, photos and SVG, phone links, touch targets, focus, map placeholder, no overflow or browser errors, content without JS.');
}finally{socket?.close();chrome.kill();}
