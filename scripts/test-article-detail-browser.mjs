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






  await send('Page.navigate',{url:baseUrl+'/article/demo-article/'}); await pause(1200);
  await mkdir('artifacts/article-detail',{recursive:true});
  for (const width of [1440,1024,768,390,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await evaluate('document.fonts.ready');
    const state = await evaluate(`(()=>({overflow:document.documentElement.scrollWidth>innerWidth,h1:document.querySelectorAll('h1').length,main:document.querySelectorAll('main').length,gallery:document.querySelectorAll('.article-gallery a').length,filter:!!document.querySelector('.catalog-filter'),sidebar:getComputedStyle(document.querySelector('.catalog-sidebar')).display,grids:[...document.querySelectorAll('.article-content__images')].map(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)}))()`);
    assert(!state.overflow,JSON.stringify(state));assert.equal(state.h1,1);assert.equal(state.main,1);assert.equal(state.gallery,20);assert(!state.filter);assert.equal(state.sidebar,width<768?'none':'block');
    assert.deepEqual(state.grids,Array.from({length:4},()=>width<768?[1,1,1]:width<1200?[1,2,2]:[1,2,3]).flat());
    for(const position of ['left','right','wide']) {
      await evaluate(`document.querySelector('.article-detail').className='article-detail article-detail--image-${position}'`);
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.article-detail__image')).cssFloat`),width<768||position==='wide'?'none':position);
      assert(await evaluate(`document.querySelector('.article-detail').getBoundingClientRect().bottom>=document.querySelector('.article-detail__image').getBoundingClientRect().bottom`));
    }
    const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/article-detail/'+width+'.png',Buffer.from(shot.data,'base64'));
    console.log('Passed responsive',width);
  }
  await evaluate(`document.querySelector('.article-detail__image').remove();document.querySelector('.article-detail__summary').remove();document.querySelector('.article-detail').className='article-detail article-detail--no-image'`);
  assert(await evaluate(`!document.querySelector('.article-detail__image,.article-detail__summary')&&document.documentElement.scrollWidth<=innerWidth`));
  await evaluate(`document.querySelector('.article-gallery a').click()`);await pause(900);
  assert(await evaluate(`!!document.querySelector('.fancybox__container')`));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await pause(600);
  assert.equal(await evaluate(`document.querySelector('.fancybox__slide.is-selected').getAttribute('index')`),'1');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await pause(600);
  assert(await evaluate(`!document.querySelector('.fancybox__container')`));
  console.log('Passed Fancybox open, next, Escape; optional blocks absent');
} finally {socket?.close();chrome.kill();}


