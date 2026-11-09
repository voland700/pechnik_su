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


  await send('Page.navigate', {url: baseUrl + '/'});
  await pause(700);
  await mkdir('artifacts/advantages', {recursive:true});
  const results=[];
  for (const width of [375,768,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
    await evaluate(`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))).then(()=>document.querySelector('.advantages').scrollIntoView()).then(()=>new Promise(r=>requestAnimationFrame(r)))`);
    const state=await evaluate(`(() => {
      const s=document.querySelector('.advantages'),g=s.querySelector('ul');
      return {width:innerWidth,count:g.children.length,columns:getComputedStyle(g).gridTemplateColumns.split(' ').length,
        overflow:document.documentElement.scrollWidth>innerWidth,
        interactive:s.querySelectorAll('a,button,[tabindex]').length,
        decorative:[...s.querySelectorAll('svg')].every(i=>i.getAttribute('aria-hidden')==='true'),
        clipped:[...s.querySelectorAll('h3,p')].some(t=>t.scrollWidth>t.clientWidth+1 || t.scrollHeight>t.clientHeight+1),
        centered:[...g.children].every(i=>getComputedStyle(i).textAlign==='center')};
    })()`);
    assert.equal(state.count,8);assert.equal(state.columns,width>=992?4:width>=576?2:1);
    assert.equal(state.overflow,false);assert.equal(state.interactive,0);assert(state.decorative);assert(state.centered);assert(!state.clipped);
    results.push(state);
    const clip=await evaluate(`(() => {const b=document.querySelector('.advantages').getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height,scale:1};})()`);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
    await writeFile('artifacts/advantages/'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await send('DOM.enable'); await send('CSS.enable');
  const {root}=await send('DOM.getDocument');
  const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'.advantages__image'});
  const before=await evaluate(`document.querySelector('.advantages__title').getBoundingClientRect().top+scrollY`);
  await send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['hover']});await pause(400);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.advantages__image')).transform`),'matrix(1.05, 0, 0, 1.05, 0, 0)');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.advantages__image')).color`),'rgb(233, 101, 0)');
  assert.equal(await evaluate(`document.querySelector('.advantages__title').getBoundingClientRect().top+scrollY`),before);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.advantages__image')).transform`),'none');
  assert(await evaluate(`parseFloat(getComputedStyle(document.querySelector('.advantages__image')).transitionDuration)<=0.00001`));
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  await send('Page.navigate',{url:baseUrl+'/'});await pause(500);
  assert.equal(await evaluate(`document.querySelectorAll('.advantages__item').length`),8);
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/advantages/results.json',JSON.stringify(results,null,2));
  console.log('Passed: 375/768/1024/1440, grid, overflow, decorative SVG, noninteractive items, hover, reduced motion, no JS.');
} finally {socket?.close();chrome.kill();}

