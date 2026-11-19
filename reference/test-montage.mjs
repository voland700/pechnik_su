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
  const results = [];
  for (const width of [320,375,390,576,768,992,1200,1440,1920]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:baseUrl+'/installation/'});
    await pause(700);
    await evaluate(`Promise.all([...document.querySelectorAll('.montage-page img')].map(i=>{i.loading='eager';return i.decode()}))`);
    const state = await evaluate(`(()=>{const p=document.querySelector('.montage-page');const cols=s=>getComputedStyle(p.querySelector(s)).gridTemplateColumns.split(' ').length;return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,h1:document.querySelectorAll('h1').length,main:document.querySelectorAll('main').length,sections:p.querySelectorAll(':scope>section').length,services:p.querySelectorAll('.montage-service-card').length,pairs:p.querySelectorAll('.montage-solutions__row').length,advantages:p.querySelectorAll('.montage-advantages__item').length,experience:p.querySelectorAll('.montage-experience__item').length,photos:p.querySelectorAll('[data-fancybox="montage-gallery"]').length,reviews:p.querySelectorAll('blockquote').length,reviewLengths:[...p.querySelectorAll('blockquote')].map(e=>e.textContent.length),images:[...p.querySelectorAll('img')].every(i=>i.naturalWidth>0),columns:{catalog:cols('.montage-catalog__grid'),services:cols('.montage-services__grid'),advantages:cols('.montage-advantages__grid'),experience:cols('.montage-experience__grid'),gallery:cols('.montage-gallery__grid'),reviews:cols('.montage-reviews__grid'),pairs:cols('.montage-solutions__row')},links:[...p.querySelectorAll('.montage-catalog a')].map(a=>a.getAttribute('href')),groups:[...new Set([...p.querySelectorAll('[data-fancybox]')].map(a=>a.dataset.fancybox))],sidebar:!!document.querySelector('.catalog-sidebar')}})()`);
    assert(!state.overflow,JSON.stringify(state)); assert.equal(state.h1,1);assert.equal(state.main,1);assert.equal(state.sections,8);assert.equal(state.services,6);assert.equal(state.pairs,5);assert.equal(state.advantages,6);assert.equal(state.experience,6);assert.equal(state.photos,4);assert.equal(state.reviews,6);assert(state.reviewLengths.every(n=>n>350));assert(state.images);assert(!state.sidebar);
    assert.deepEqual(state.columns,{catalog:width>=992?4:width>=576?2:1,services:width>=992?3:width>=576?2:1,advantages:width>=992?3:2,experience:width>=992?6:width>=768?3:2,gallery:width>=992?4:2,reviews:width>=768?2:1,pairs:width>=768?2:1});
    assert.deepEqual(state.links,['/catalog/pechnoy-kirpich/','/catalog/pechnye-smesi/','/catalog/kaminnoe-i-pechnoe-litye-chugun/','/catalog/izolyatsiya-dlya-pechey-i-kaminov/']);
    assert.deepEqual(state.groups,['montage-gallery','montage-plan']);
    await evaluate(`document.querySelector('.montage-catalog a').focus()`);
    assert.equal(await evaluate(`getComputedStyle(document.activeElement).outlineStyle`),'solid');
    if(width===390||width===1440){await evaluate(`document.querySelector('.montage-page').scrollIntoView()`);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('reference/montage-'+width+'.png',Buffer.from(shot.data,'base64'));}
    results.push(state);
  }
  const waitFor=async expression=>{for(let n=0;n<50;n++){if(await evaluate(expression))return;await pause(100);}throw Error('Timed out: '+expression);};
  const key=async key=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key});await send('Input.dispatchKeyEvent',{type:'keyUp',key});};
  await evaluate(`document.querySelector('[data-fancybox="montage-gallery"]').click()`);
  await waitFor(`!!document.querySelector('.fancybox__container img')?.naturalWidth`);
  const before=await evaluate(`document.querySelector('.fancybox__container img').src`);
  await key('ArrowRight');await pause(600);
  assert(await evaluate(`Array.from(document.querySelectorAll('.fancybox__container img')).some(i=>i.src!==${JSON.stringify(before)}&&i.naturalWidth>0)`));
  await key('Escape');await waitFor(`!document.querySelector('.fancybox__container')`);
  await evaluate(`document.querySelector('[data-fancybox="montage-plan"]').click()`);
  await waitFor(`!!document.querySelector('.fancybox__container img')?.naturalWidth`);
  await waitFor(`!!document.querySelector('[data-fancybox-close]')`);
  await evaluate(`document.querySelector('[data-fancybox-close]').click()`);
  await waitFor(`!document.querySelector('.fancybox__container')`);
  assert.equal(errors.length,0,JSON.stringify(errors));
  await writeFile('reference/montage-results.json',JSON.stringify(results,null,2));
  console.log('PASS: nine widths, sections, grids, content, images, links, focus, Fancybox gallery navigation and closing, independent workflow.');
} finally { socket?.close(); chrome.kill(); }


