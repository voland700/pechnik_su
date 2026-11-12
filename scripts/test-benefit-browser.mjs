// Optional smoke check using installed Chrome and Node's native CDP/WebSocket.
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const baseUrl = process.env.SHOWCASE_BASE_URL ?? 'http://127.0.0.1:4321';
const profile = await mkdtemp(join(tmpdir(), 'pechnik-header-'));
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: ['ignore','ignore','ignore','pipe','pipe'] });
let socket;
try {
  let buffer='';
  socket={close(){chrome.stdio[3].end();},send(value){chrome.stdio[3].write(value+'\0');},
    addEventListener(_type,handler){chrome.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\0'))>=0){const data=buffer.slice(0,end);buffer=buffer.slice(end+1);if(data)handler({data});}});}};
  let sessionId;
  let id = 0;
  const pending = new Map();
  const errors = [];
  let pageLoadedResolve;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Page.loadEventFired') pageLoadedResolve?.();
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
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  const loaded = new Promise(resolve => { pageLoadedResolve = resolve; });
  await send('Page.navigate', { url: baseUrl + '/benefits/' });
  await loaded;
  await evaluate('document.fonts.ready');
  await evaluate("Promise.all([...document.querySelectorAll('.benefit img')].map(i=>{i.loading='eager';return i.decode()}))");
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir('artifacts/benefits', { recursive: true });
  const report = [];
  for (const width of [320, 390, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height:1100,deviceScaleFactor:1,mobile:false});
    const state = await evaluate(`(() => {
      const blocks = [...document.querySelectorAll('.benefit')];
      return {
        count: blocks.length,
        overflow: document.documentElement.scrollWidth > innerWidth,
        blocksOverflow: blocks.some(b=>b.scrollWidth>b.clientWidth),
        images: blocks.every(b=>b.querySelector('img').naturalWidth>0),
        links: blocks.map(b=>[...b.querySelectorAll('a')].map(a=>a.getAttribute('href'))),
        imageFit: blocks.every(b=>getComputedStyle(b.querySelector('img')).objectFit==='contain'),
        plainList: getComputedStyle(blocks[0].querySelector('ul')).listStyleType,
        markedList: getComputedStyle(blocks[6].querySelector('ul')).listStyleType
      };
    })()`);
    assert.equal(state.count, 7);
    assert(!state.overflow && !state.blocksOverflow, JSON.stringify(state));
    assert(state.images && state.imageFit);
    assert.deepEqual(state.links[4], ['#benefits-all','#benefits-all']);
    assert(state.links.filter((_,i)=>i!==4).every(links=>links.length===0));
    assert.equal(state.plainList,'none');
    assert.equal(state.markedList,'disc');
    report.push({width,...state});
    await evaluate("document.querySelector('.benefits-demo').scrollIntoView()");
    const screenshot = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(`artifacts/benefits/${width}.png`,Buffer.from(screenshot.data,'base64'));
  }
  await evaluate("document.querySelector('.benefits-demo__narrow').style.width='210px'");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.benefits-demo__narrow .benefit__content')).gridTemplateColumns.split(' ').length"), 1);
  await evaluate("document.querySelector('.benefit__title-link').focus()");
  const focus = await evaluate("({visible:document.activeElement.matches(':focus-visible'),outline:getComputedStyle(document.activeElement).outlineStyle})");
  assert(focus.visible && focus.outline==='solid');
  assert.equal(errors.length,0,JSON.stringify(errors));
  await writeFile('artifacts/benefits/results.json',JSON.stringify({report,focus,narrowStacked:true},null,2));
  console.log('Benefit browser checks passed at 320/390/768/1024/1440 px; 210px column, links, images, lists, focus, no JS.');
} finally {
  socket?.close();
  chrome.kill();
}
