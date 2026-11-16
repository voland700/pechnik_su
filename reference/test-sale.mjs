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
  for(const width of [375,576,768,992,1200,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:baseUrl+'/sale/'}); await pause(700);
    await evaluate(`Promise.all([...document.querySelectorAll('.sale-item img')].map(img=>{img.loading='eager';return img.decode()}))`);
    const state=await evaluate(`(()=>{const cards=[...document.querySelectorAll('.sale-item')];const r=e=>e.getBoundingClientRect();return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,count:cards.length,h1:document.querySelector('h1').textContent,sidebar:!!document.querySelector('.catalog-sidebar'),phone:document.querySelector('.sale-list__intro a').getAttribute('href'),items:cards.map(c=>({title:c.querySelector('h2').textContent,date:c.querySelector('time').textContent,datetime:c.querySelector('time').dateTime,text:c.querySelector('p').innerHTML,links:[...c.querySelectorAll('a')].map(a=>a.getAttribute('href')),shine:c.querySelector('.sale-item__image-link').classList.contains('shine'),loaded:c.querySelector('img').naturalWidth>0,vertical:r(c.querySelector('.sale-item__content')).top>=r(c.querySelector('img')).bottom-1,imageWidth:r(c.querySelector('img')).width,cardWidth:r(c).width}))}})()`);
    assert.equal(state.count,4);assert.equal(state.h1,'Акции');assert(!state.overflow);assert(state.sidebar);assert.equal(state.phone,'tel:+79168818399');
    for(const [i,item] of state.items.entries()){const expected=JSON.parse(await readFile('../src/data/sale.json','utf8'))[i];assert.equal(item.title,expected.title);assert.equal(item.date,expected.date);assert.equal(item.text,expected.text);assert(item.loaded&&item.shine);assert.deepEqual(item.links,['#','#','#']);assert.equal(item.vertical,width<992);assert.equal(item.imageWidth,width<992?item.cardWidth:280);}
    await evaluate(`document.querySelector('.sale-item__image-link').focus()`);
    const focus=await evaluate(`(()=>{const a=document.activeElement;return {outline:getComputedStyle(a).outlineStyle,animation:getComputedStyle(a,'::before').animationName}})()`);
    assert.equal(focus.outline,'solid');assert.equal(focus.animation,'shine');
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile('sale-'+width+'.png',Buffer.from(shot.data,'base64'));
    results.push(state);
  }
  await send('Page.navigate',{url:baseUrl+'/catalog/'});await pause(500);
  assert(await evaluate(`!!document.querySelector('.catalog-sidebar') && getComputedStyle(document.querySelector('.catalog-layout')).gridTemplateColumns.split(' ').length===2`));
  assert.equal(errors.length,0,JSON.stringify(errors));
  await writeFile('sale-results.json',JSON.stringify(results,null,2));
  console.log('PASS: six viewport sizes, exact data, images, links, focus, shine, no overflow; catalog sidebar preserved; no browser errors.');
} finally {socket?.close();chrome.kill();}

