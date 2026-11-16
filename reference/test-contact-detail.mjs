// Optional smoke check using installed Chrome and Node's native CDP/WebSocket.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
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
  const route = '/about/contacts/pechnoy-tsentr-yasenevo-tsentralniy-sklad/';
  const results = [];
  for (const width of [375,576,768,992,1200,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:baseUrl+route});
    await pause(700);
    await evaluate(`Promise.all([...document.querySelectorAll('.contact-detail img')].map(i=>{i.loading='eager';return i.decode()}))`);
    const state = await evaluate(`(()=>{const d=document.querySelector('.contact-detail');return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,h1:document.querySelectorAll('h1').length,main:document.querySelectorAll('main').length,columns:getComputedStyle(d.querySelector('.contact-gallery')).gridTemplateColumns.split(' ').length,photos:d.querySelectorAll('.contact-gallery a.shine').length,groups:[...new Set([...d.querySelectorAll('[data-fancybox]')].map(a=>a.dataset.fancybox))],images:[...d.querySelectorAll('img')].every(i=>i.naturalWidth>0),phones:[...d.querySelectorAll('a[href^="tel:"]')].map(a=>a.getAttribute('href')),emails:[...d.querySelectorAll('a[href^="mailto:"]')].map(a=>a.getAttribute('href')),maps:[...d.querySelectorAll('.contact-map__placeholder')].map(e=>e.getBoundingClientRect().height),external:[...d.querySelectorAll('a[target]')].every(a=>a.target==='_blank'&&a.rel==='noopener noreferrer'),remoteMaps:d.querySelectorAll('iframe').length}})()`);
    assert(!state.overflow, JSON.stringify(state)); assert.equal(state.h1,1); assert.equal(state.main,1);
    assert.equal(state.columns,width>=1200?4:width>=768?3:2); assert.equal(state.photos,12); assert(state.images);
    assert.deepEqual(state.groups,['yasenevo-scheme','yasenevo-gallery']);
    assert.deepEqual(state.phones,['tel:+79168818399','tel:+79853088316']);
    assert.deepEqual(state.emails,['mailto:info@pechnik.su','mailto:c9150368017@yandex.ru']);
    assert.deepEqual(state.maps,[width>=768?352:256,width>=768?352:256]); assert(state.external); assert.equal(state.remoteMaps,0);
    await evaluate(`document.querySelector('.contact-detail__back').focus()`);
    assert.equal(await evaluate(`getComputedStyle(document.activeElement).outlineStyle`),'solid');
    await evaluate(`document.activeElement.blur();document.querySelector('.contact-detail').scrollIntoView()`);
    if(width===375||width===1440){await pause(500);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('reference/contact-detail-'+width+'.png',Buffer.from(shot.data,'base64'));}
    if(width===375||width===1440){await evaluate(`document.querySelector('.contact-detail__gallery').scrollIntoView()`);await pause(500);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('reference/contact-detail-gallery-'+width+'.png',Buffer.from(shot.data,'base64'));}
    results.push(state);
  }
  const waitFor = async expression => {for(let n=0;n<50;n++){if(await evaluate(expression))return;await pause(100);}throw Error('Condition timed out: '+expression);};
  const key = async key => {await send('Input.dispatchKeyEvent',{type:'keyDown',key});await send('Input.dispatchKeyEvent',{type:'keyUp',key});};
  await evaluate(`document.querySelector('.contact-detail__scheme').click()`);
  await waitFor(`!!document.querySelector('.fancybox__container')`);
  await waitFor(`!!document.querySelector('.fancybox__container img')?.naturalWidth`);
  await key('Escape'); await waitFor(`!document.querySelector('.fancybox__container')`);
  await evaluate(`document.querySelector('.contact-gallery a').click()`);
  await waitFor(`!!document.querySelector('.fancybox__container img')?.naturalWidth`);
  const before = await evaluate(`document.querySelector('.fancybox__container img').src`);
  await key('ArrowRight'); await pause(600);
  assert(await evaluate(`Array.from(document.querySelectorAll('.fancybox__container img')).some(i=>i.src!==${JSON.stringify(before)}&&i.naturalWidth>0)`));
  await key('Escape'); await waitFor(`!document.querySelector('.fancybox__container')`);
  await evaluate(`document.querySelector('.contact-detail__scheme').click()`);
  await waitFor(`!!document.querySelector('[data-fancybox-close]')`);
  await evaluate(`document.querySelector('[data-fancybox-close]').click()`);
  await waitFor(`!document.querySelector('.fancybox__container')`);
  await evaluate(`document.querySelector('.contact-detail__scheme').click()`);
  await waitFor(`!!document.querySelector('.fancybox__container img')?.naturalWidth`);
  await pause(350);
  await evaluate(`document.querySelector('.fancybox__backdrop').click()`);
  
  await waitFor(`!document.querySelector('.fancybox__container')`);
  assert.equal(errors.length,0,JSON.stringify(errors));
  await writeFile('reference/contact-detail-results.json',JSON.stringify(results,null,2));
  console.log('PASS: six widths, no overflow, grid 2/3/4, images, links, focus, map placeholders, Fancybox opening, gallery navigation and Escape.');
} finally { socket?.close(); chrome.kill(); }



