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
  await mkdir('artifacts/footer',{recursive:true});
  const results=[];
  for(const width of [375,768,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
    await evaluate(`document.fonts.ready.then(()=>{document.querySelector('.site-footer').scrollIntoView();return Promise.all([...document.querySelectorAll('.site-footer img')].map(i=>{i.loading='eager';return i.decode()}))})`);await pause(150);
    const state=await evaluate(`(()=>{const f=document.querySelector('.site-footer'),m=f.querySelector('.site-footer__main'),links=[...f.querySelectorAll('nav a')],social=[...f.querySelectorAll('.site-footer__social')];return {width:innerWidth,columns:getComputedStyle(m).gridTemplateColumns.split(' ').length,overflow:document.documentElement.scrollWidth>innerWidth,menus:links.length,placeholders:links.every(a=>a.getAttribute('href')==='#'),social:social.length,safe:social.every(a=>a.target==='_blank'&&a.rel==='noopener noreferrer'&&a.getAttribute('aria-label')),contacts:f.querySelectorAll('.site-footer__contacts li').length,payments:f.querySelectorAll('.site-footer__payments svg').length,phone:!!f.querySelector('a[href="tel:+79168818399"]'),email:!!f.querySelector('a[href="mailto:info@pechnik.su"]'),images:[...f.querySelectorAll('img')].every(i=>i.naturalWidth>0),copyright:f.querySelector('.site-footer__copyright').textContent,bounds:[...m.children].every(c=>{const r=c.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})}})()`);
    assert.equal(state.columns,width>=1200?5:width>=768?3:1);assert.equal(state.overflow,false);assert.equal(state.menus,24);assert.equal(state.social,5);assert.equal(state.contacts,4);assert.equal(state.payments,12);
    for(const key of ['placeholders','safe','phone','email','images','bounds'])assert.equal(state[key],true,key);
    assert.equal(state.copyright,'2015 © Печной Центр Ясенево');results.push(state);
    const rect=await evaluate(`(()=>{const r=document.querySelector('.site-footer').getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()`);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:rect});await writeFile('artifacts/footer/'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});
  await evaluate(`document.querySelector('.site-footer__social').focus()`);
  assert(await evaluate(`document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).outlineWidth==='3px'`));
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  for(const path of ['/','/ui-kit/','/products-demo/']){await send('Page.navigate',{url:baseUrl+path});await pause(300);assert.equal(await evaluate(`document.querySelectorAll('.site-footer nav a').length`),24);}
  assert.deepEqual(errors,[]);await writeFile('artifacts/footer/results.json',JSON.stringify(results,null,2));console.log('Passed: four widths, menus, socials, contacts, payments, images, overflow, focus, all three pages without JS, browser errors.');
} finally {socket?.close();chrome.kill();}

