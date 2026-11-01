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
    addEventListener(type,handler){chrome.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\0'))>=0){const data=buffer.slice(0,end);buffer=buffer.slice(end+1);if(data)handler({data});}});}};
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
  await pause(1400);
  await mkdir('artifacts/featured-products', {recursive:true});
  const results=[];
  for (const width of [360,390,576,768,1024,1200,1440,1920]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    const state=await evaluate(`(() => {
      const root=document.querySelector('[data-featured-tabs]');
      const panels=[...root.querySelectorAll('[data-featured-panel]')];
      const tabs=[...root.querySelectorAll('[data-featured-tab]')];
      const grid=panels[0].querySelector('.featured-products__grid');
      return {width:innerWidth,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        counts:panels.map(p=>p.querySelectorAll('[data-product-card]').length),
        selected:tabs.filter(t=>t.getAttribute('aria-selected')==='true').length,
        visible:panels.filter(p=>!p.hidden).length,
        overflow:document.documentElement.scrollWidth>innerWidth,
        cardOverflow:[...grid.children].some(c=>c.scrollWidth>c.clientWidth),
        direction:getComputedStyle(grid.querySelector('form')).flexDirection,
        oneRow:tabs.every(t=>t.offsetTop===tabs[0].offsetTop),
        ids:tabs.every((t,i)=>t.getAttribute('aria-controls')===panels[i].id && panels[i].getAttribute('aria-labelledby')===t.id)};
    })()`);
    assert.equal(state.columns,width>=1200?5:width>=992?4:width>=768?3:2);
    assert.deepEqual(state.counts,[10,10,10,10,6,6,8,8]);
    assert.equal(state.visible,1);assert.equal(state.selected,1);
    assert(!state.overflow && !state.cardOverflow && state.oneRow && state.ids,JSON.stringify(state));
    results.push(state);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1200,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.querySelector('[data-featured-tabs]').scrollIntoView({block:'start'})`);
  const before=await evaluate('scrollY');
  await evaluate(`document.querySelector('[data-featured-tab]').focus({preventScroll:true}); document.querySelector('[data-featured-panel] input[name=quantity]').value='7'`);
  for (const [key, expected] of [['End',7],['ArrowRight',0],['ArrowLeft',7],['Home',0],['ArrowRight',1],['ArrowLeft',0]]) {
    await send('Input.dispatchKeyEvent',{type:'keyDown',key});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key});
    await pause(350);
    const state=await evaluate(`(() => {const t=document.activeElement;const nav=t.parentElement.getBoundingClientRect(),r=t.getBoundingClientRect();return {selected:t.getAttribute('aria-selected'),visible:r.left>=nav.left && r.right<=nav.right,index:[...t.parentElement.children].indexOf(t),scrollY};})()`);
    assert.equal(state.selected,'true');assert(state.visible);assert.equal(state.scrollY,before);
    assert.equal(state.index, expected);
  }
  assert.equal(await evaluate(`document.querySelector('[data-featured-panel] input[name=quantity]').value`),'7');
  const tabs=await evaluate(`[...document.querySelectorAll('[data-featured-tab]')].map(t=>t.textContent.trim())`);
  for(let i=0;i<8;i++) {
    await evaluate(`document.querySelectorAll('[data-featured-tab]')[${i}].click()`);
    assert.equal(await evaluate(`document.querySelectorAll('[data-featured-panel]:not([hidden]).behold').length`),1);
  }
  await evaluate(`document.querySelectorAll('[data-featured-tab]')[0].click()`);
  await pause(600);
  const imageState=await evaluate(`Promise.all([...document.querySelector('[data-featured-panel]').querySelectorAll('img')].map(async i=>{i.loading='eager';await i.decode();return i.naturalWidth>0;}))`);
  assert(imageState.every(Boolean));
  const screenshot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile('artifacts/featured-products/1200.png',Buffer.from(screenshot.data,'base64'));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.featured-products__panel.behold')).animationName`),'none');
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  await send('Page.reload');await pause(800);
  await send('Emulation.setScriptExecutionDisabled',{value:false});
  assert.equal(await evaluate(`[...document.querySelectorAll('[data-featured-panel]')].filter(p=>getComputedStyle(p).display!=='none').length`),8);
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/featured-products/results.json',JSON.stringify({results,tabs,imageState,errors},null,2));
  console.log('Passed: eight widths, all categories and counts, grid, overflow, ARIA, keyboard, scroll, quantity persistence, images, reduced motion, no-JS, no browser errors.');
} finally {socket?.close();chrome.kill();}
