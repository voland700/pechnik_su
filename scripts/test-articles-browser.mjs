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
  await mkdir('artifacts/articles',{recursive:true});
  const results=[];
  for(const width of [375,768,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});await pause(150);
    await evaluate(`document.fonts.ready.then(()=>{document.querySelector('.articles-list').scrollIntoView({behavior:'instant'});return Promise.all([...document.querySelectorAll('.article-card__image')].map(i=>{i.loading='eager';return i.decode()}))})`);
    const state=await evaluate(`(()=>{const s=document.querySelector('.articles-list'),g=s.querySelector('ul'),cards=[...s.querySelectorAll('.article-card')],links=cards.map(c=>c.querySelector('a'));return {
      width:innerWidth,count:cards.length,columns:getComputedStyle(g).gridTemplateColumns.split(' ').length,
      overflow:document.documentElement.scrollWidth>innerWidth,
      images:s.querySelectorAll('img').length===10&&[...s.querySelectorAll('img')].every(i=>i.naturalWidth>0&&getComputedStyle(i).objectFit==='contain'),
      horizontal:links.every(a=>{const m=a.querySelector('.article-card__media').getBoundingClientRect(),c=a.querySelector('.article-card__content').getBoundingClientRect();return c.x>m.x+m.width-1}),
      clippedTitles:[...s.querySelectorAll('h3')].some(t=>t.scrollHeight>t.clientHeight+1||t.scrollWidth>t.clientWidth+1),
      clamp:[...s.querySelectorAll('p')].every(p=>getComputedStyle(p).webkitLineClamp===String(innerWidth>=768?4:5)),
      links:links.every(a=>a.getAttribute('href')==='#'&&a.querySelectorAll('a,button').length===0),
      heading:getComputedStyle(s.querySelector('h2')).textAlign,
      rows:cards.filter(c=>Math.abs(c.getBoundingClientRect().x-cards[0].getBoundingClientRect().x)<1).length};})()`);
    assert.equal(state.count,10);assert.equal(state.columns,width>=992?2:1);assert.equal(state.rows,width>=992?5:10);
    assert(!state.overflow);assert(state.images);assert.equal(state.horizontal,width>=768);assert(!state.clippedTitles);assert(state.clamp);assert(state.links);assert.equal(state.heading,'center');
    results.push(state);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile('artifacts/articles/'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await send('DOM.enable');await send('CSS.enable');const {root}=await send('DOM.getDocument');
  const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'.article-card__link'});
  await send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['hover']});await pause(200);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.article-card__title')).color`),'rgb(171, 72, 0)');
  await send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['active']});await pause(200);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.article-card__title')).color`),'rgb(41, 39, 34)');
  await send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]});
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
  await evaluate(`document.querySelector('.article-card__link').focus()`);
  assert(await evaluate(`document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).outlineWidth==='3px'`));
  for(let i=1;i<10;i++){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});assert.equal(await evaluate(`[...document.querySelectorAll('.article-card__link')].indexOf(document.activeElement)`),i);}
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert(await evaluate(`parseFloat(getComputedStyle(document.querySelector('.article-card__title')).transitionDuration)<=0.00001`));
  if(process.argv.includes('--fixtures')) {
    await send('Page.navigate',{url:baseUrl+'/articles-test/'});await pause(500);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.articles-list')].map(s=>s.querySelectorAll('article').length)`),[1,2,3,4,5,6,7,8,9,10,10,1]);
    for(const width of [375,768,1024,1440]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});await pause(100);
      assert(await evaluate(`(()=>{const s=[...document.querySelectorAll('.articles-list')].at(-1),p=s.querySelector('p'),h=s.querySelector('h3');return p.textContent.length>5000&&p.scrollHeight>p.clientHeight&&p.clientHeight<=parseFloat(getComputedStyle(p).lineHeight)*(innerWidth>=768?4:5)+1&&h.scrollHeight<=h.clientHeight+1&&document.documentElement.scrollWidth<=innerWidth})()`));
    }
  }
  await send('Emulation.setScriptExecutionDisabled',{value:true});await send('Page.navigate',{url:baseUrl+'/'});await pause(400);
  assert.equal(await evaluate(`document.querySelectorAll('.article-card').length`),10);
  assert.deepEqual(errors,[]);await writeFile('artifacts/articles/results.json',JSON.stringify(results,null,2));
  console.log('Passed: four widths, 10 images/cards, grid, image composition, titles, clamp, links, hover/active/focus/Tab, reduced motion, long text fixture, no JS, console.');
} finally {socket?.close();chrome.kill();}
