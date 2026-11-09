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



  await send('Page.navigate',{url:baseUrl+'/'});await pause(700);
  await mkdir('artifacts/completed-works',{recursive:true});
  const expected=['Кладка кирпичных печей','Монтаж чугунных печей-каминов','Монтаж каминов в облицовке','Монтаж кирпичных печей для бани','Банные печи в толькомагнезите','Строительство комплексов барбекю'];
  const results=[];
  for(const width of [375,768,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await evaluate(`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))).then(()=>document.querySelector('.completed-works').scrollIntoView({behavior:'instant'})).then(()=>new Promise(r=>requestAnimationFrame(r)))`);
    const state=await evaluate(`(()=>{
      const s=document.querySelector('.completed-works'),g=s.querySelector('ul'),links=[...s.querySelectorAll('a')];
      return {width:innerWidth,columns:getComputedStyle(g).gridTemplateColumns.split(' ').length,
      titles:links.map(a=>a.textContent),hrefs:links.map(a=>a.getAttribute('href')),
      overflow:document.documentElement.scrollWidth>innerWidth,
      clipped:links.some(a=>a.scrollWidth>a.clientWidth+1||a.scrollHeight>a.clientHeight+1),
      touch:links.every(a=>a.getBoundingClientRect().height>=44),
      positions:links.map(a=>({x:a.getBoundingClientRect().x,y:a.getBoundingClientRect().y})),
      marker:getComputedStyle(links[0],'::before').backgroundColor,
      heading:getComputedStyle(s.querySelector('h2')).textAlign};
    })()`);
    assert.deepEqual(state.titles,expected);assert(state.hrefs.every(h=>h==='#'));
    assert.equal(state.columns,width>=992?3:width>=768?2:1);assert(!state.overflow);assert(!state.clipped);assert(state.touch);
    assert.equal(state.marker,'rgb(233, 101, 0)');assert.equal(state.heading,'center');
    for(let i=1;i<state.columns;i++) assert.equal(state.positions[i].y,state.positions[0].y);
    assert(state.positions[state.columns].y>state.positions[0].y);
    results.push(state);
    await evaluate(`document.querySelector('.completed-works').scrollIntoView({block:'start',behavior:'instant'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile('artifacts/completed-works/'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await send('DOM.enable');await send('CSS.enable');
  const {root}=await send('DOM.getDocument');
  const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'.completed-works__link'});
  await send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['hover']});await pause(200);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.completed-works__link')).color`),'rgb(171, 72, 0)');
  await send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['active']});await pause(200);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.completed-works__link')).color`),'rgb(41, 39, 34)');
  await send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]});
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
  await evaluate(`document.querySelector('.completed-works__link').focus()`);
  assert(await evaluate(`document.activeElement.matches(':focus-visible') && getComputedStyle(document.activeElement).outlineWidth==='3px'`));
  for(let i=1;i<6;i++) {
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
    assert.equal(await evaluate('document.activeElement.textContent'),expected[i]);
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert(await evaluate(`parseFloat(getComputedStyle(document.querySelector('.completed-works__link')).transitionDuration)<=0.00001`));
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  await send('Page.navigate',{url:baseUrl+'/'});await pause(400);
  assert.equal(await evaluate(`document.querySelectorAll('.completed-works__link').length`),6);
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/completed-works/results.json',JSON.stringify(results,null,2));
  console.log('Passed: four widths, row order, exact content/hrefs, markers, touch targets, hover/active/focus, keyboard order, reduced motion, no JS, no browser errors.');
} finally {socket?.close();chrome.kill();}

