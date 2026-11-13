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







  await send('Emulation.setScriptExecutionDisabled',{value:true});
  await send('Page.navigate',{url:baseUrl+'/article/demo-article/'}); await pause(1200);
  await mkdir('artifacts/recommended-articles',{recursive:true});
  for(const width of [1440,1024,768,390,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await evaluate("document.querySelector('.recommended-articles').scrollIntoView({block:'start',behavior:'instant'})");
    await pause(400); await evaluate('document.fonts.ready');
    const state=await evaluate(`(()=>{const section=document.querySelector('.recommended-articles');const cards=[...section.querySelectorAll('.article-card')];return {overflow:document.documentElement.scrollWidth>innerWidth,count:cards.length,columns:getComputedStyle(section.querySelector('.recommended-articles__grid')).gridTemplateColumns.split(' ').length,titles:cards.map(c=>c.querySelector('h3').textContent),images:cards.map(c=>{const i=c.querySelector('img');return i.complete&&i.naturalWidth>0&&getComputedStyle(i).objectFit==='contain'}),heights:cards.map(c=>c.getBoundingClientRect().height),links:section.querySelectorAll('a').length,afterGallery:!!(document.querySelector('.article-gallery').compareDocumentPosition(section)&Node.DOCUMENT_POSITION_FOLLOWING),back:section.nextElementSibling.querySelector('a').getAttribute('href')}})()`);
    assert(!state.overflow);assert.equal(state.count,4);assert.equal(state.columns,width>=1200?4:width>=768?2:1);assert.equal(new Set(state.titles).size,4);assert(state.images.every(Boolean));assert.equal(state.links,8);assert(state.afterGallery);assert.equal(state.back,'/article/');
    for(let i=0;i<4;i+=state.columns) assert.equal(new Set(state.heights.slice(i,i+state.columns)).size,1);
    await evaluate("document.querySelector('.recommended-articles').scrollIntoView({block:'start',behavior:'instant'})"); await pause(300);
    await writeFile('artifacts/recommended-articles/'+width+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    console.log(width,JSON.stringify(state));
  }
} finally {socket?.close();chrome.kill();}

