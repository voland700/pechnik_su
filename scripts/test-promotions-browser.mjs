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
  await pause(1000);
  await mkdir('artifacts/promotions', {recursive:true});
  const results = [];
  for (const width of [360,390,576,768,992,1200,1440,1920]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height:1100,deviceScaleFactor:1,mobile:false});
    await evaluate(`document.querySelector('.promotions-showcase').scrollIntoView(); Promise.all([...document.querySelectorAll('.promotion-card__image')].map(i => { i.loading='eager'; return i.decode(); }))`);
    await evaluate(`document.fonts.ready.then(() => { document.querySelector('.promotions-showcase').scrollIntoView(); return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); })`);
    const state = await evaluate(`(() => {
      const s=document.querySelector('.promotions-showcase'), g=s.querySelector('ul'), cards=[...g.querySelectorAll('a')];
      return {width:innerWidth, count:cards.length, columns:getComputedStyle(g).gridTemplateColumns.split(' ').length,
        overflow:document.documentElement.scrollWidth>innerWidth,
        images:[...s.querySelectorAll('img')].every(i=>i.naturalWidth===550 && i.naturalHeight===309 && getComputedStyle(i).objectFit==='contain'),
        clipped:[...s.querySelectorAll('h3')].some(t=>t.scrollHeight>t.clientHeight+1),
        equal:cards.every(c=>Math.abs(c.getBoundingClientRect().height-cards[0].getBoundingClientRect().height)<1)};
    })()`);
    assert.equal(state.count,4); assert.equal(state.columns,width>=992?4:width>=576?2:1);
    assert.equal(state.overflow,false); assert.equal(state.images,true); assert.equal(state.clipped,false);
    if(width>=992) assert.equal(state.equal,true);
    results.push(state);
    const clip=await evaluate(`(() => {const b=document.querySelector('.promotions-showcase').getBoundingClientRect(); return {x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height,scale:1};})()`);
    const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
    await writeFile(`artifacts/promotions/${width}.png`,Buffer.from(screenshot.data,'base64'));
  }
  const y=await evaluate('scrollY');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.promotion-card__title')].map(t=>t.textContent)`),[
    'При покупке банной печи 100 кг. камней - в подарок!', 'Дымоходы - полный комплект со скидкой',
    'Камины из Европы – скидки и подарки!', 'Банные печи Атмосфера – скидки и подарки!']);
  await evaluate(`document.querySelector('.promotion-card').click(); document.querySelector('.promotions-showcase__all-link').click()`);
  assert.equal(await evaluate('scrollY'),y);
  // Emulate pseudo states directly: full-page captures can alter CDP viewport coordinates.
  await send('DOM.enable'); await send('CSS.enable');
  const {root}=await send('DOM.getDocument');
  const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'.promotion-card'});
  await send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['hover']});
  await pause(350);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.promotion-card')).color`),'rgb(171, 72, 0)');
  await send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['active']});
  await pause(350);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.promotion-card')).boxShadow`),'none');
  await send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]});
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
  await evaluate(`document.querySelector('.promotion-card').focus()`);
  assert.equal(await evaluate(`document.activeElement.matches(':focus-visible') && getComputedStyle(document.activeElement).outlineWidth==='3px'`),true);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.promotion-card')).transform`),'none');
  await send('Page.navigate',{url:baseUrl+'/promotions-test/'}); await pause(500);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.promotions-showcase')].map(s=>s.querySelectorAll('.promotion-card').length)`),[1,4,2,1]);
  await evaluate(`document.querySelector('a[href="#real-target"]').click()`);
  assert.equal(await evaluate('location.hash'),'#real-target');
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  await send('Page.navigate',{url:baseUrl+'/'}); await pause(500);
  assert.equal(await evaluate(`document.querySelectorAll('.promotion-card').length`),4);
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/promotions/results.json',JSON.stringify(results,null,2));
  console.log('Passed: eight widths, images, grid, titles, demo/real links, focus, reduced motion, fixtures, no JS rendering, browser errors.');
} finally { socket?.close(); chrome.kill(); }

