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
  const { readFile, readdir } = await import('node:fs/promises');
  const { transform } = await import('esbuild');
  const loadData = async path => {
    const { code } = await transform(await readFile(path, 'utf8'), { loader: 'ts', format: 'esm' });
    return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  };
  const { catalogData } = await loadData('src/data/catalog.ts');
  const { showcaseData } = await loadData('src/data/showcase.ts');
  assert.equal(catalogData.length, 22);
  assert.deepEqual(catalogData.map(x=>[x.name,x.img]), showcaseData.map(x=>[x.name,x.img]));
  assert.deepEqual(catalogData.map(x=>x.children.length), [7,17,4,9,8,12,1,2,6,8,0,0,0,0,0,4,8,0,1,0,3,0]);
  const files = await readdir('assets/images/catalog');
  for (const item of catalogData) assert(files.includes(item.img.split('/').at(-1)), item.img);
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await send('Page.navigate', { url: baseUrl + '/catalog/' }); await pause(500);
  await mkdir('artifacts/catalog', { recursive: true });
  const results = [];
  for (const width of [375,768,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false });
    await evaluate(`document.fonts.ready.then(()=>Promise.all([...document.querySelectorAll('.catalog-category img')].map(i=>{i.loading='eager';return i.decode()})))`);
    const state = await evaluate(`(()=>{const cards=[...document.querySelectorAll('.catalog-category')],sidebar=document.querySelector('.catalog-sidebar'),grid=document.querySelector('.catalog-categories');return {
      h1:[...document.querySelectorAll('h1')].map(x=>x.textContent),main:document.querySelectorAll('main').length,
      breadcrumbs:document.querySelector('h1').nextElementSibling.matches('.breadcrumbs'),home:document.querySelector('.breadcrumbs a').getAttribute('href'),current:document.querySelector('.breadcrumbs [aria-current]').textContent,
      sidebar:getComputedStyle(sidebar).display,nav:[...sidebar.querySelectorAll('a')].map(x=>x.textContent),columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      titles:cards.map(x=>x.querySelector('h2').textContent),children:cards.map(x=>[...x.querySelectorAll('li a')].map(a=>a.textContent)),emptyLists:cards.some(x=>x.querySelector('ul:empty')),
      links:[...document.querySelectorAll('.catalog-layout a')].every(a=>a.getAttribute('href')==='#'&&(a.textContent.trim()||a.getAttribute('aria-label'))),nested:!!grid.querySelector('a a'),
      images:cards.every(x=>{const i=x.querySelector('img');return i.naturalWidth>0&&getComputedStyle(i).objectFit==='contain'&&i.hasAttribute('width')&&i.hasAttribute('height')}),
      horizontal:cards.every(x=>x.querySelector('img').getBoundingClientRect().right<=x.querySelector('h2').getBoundingClientRect().left),overflow:document.documentElement.scrollWidth>innerWidth,
      unclipped:cards.every(x=>x.scrollHeight<=x.clientHeight&&[...x.querySelectorAll('a')].every(a=>a.getBoundingClientRect().right<=x.getBoundingClientRect().right)),
      sidebarLeft:sidebar.getBoundingClientRect().right<=grid.getBoundingClientRect().left,
      rows:new Set(cards.map(x=>x.getBoundingClientRect().top)).size
    }})()`);
    assert.deepEqual(state.h1,['Каталог товаров']); assert.equal(state.main,1);
    assert(state.breadcrumbs); assert.equal(state.home,'/'); assert.equal(state.current,'Каталог товаров');
    assert.equal(state.sidebar,width<768?'none':'block'); assert.equal(state.columns,width>=992?2:1);
    if(width>=768)assert(state.sidebarLeft);
    assert.deepEqual(state.nav,showcaseData.map(x=>x.name)); assert.deepEqual(state.titles,catalogData.map(x=>x.name));
    assert.deepEqual(state.children,catalogData.map(x=>x.children)); assert.equal(state.rows,width>=992?11:22);
    for(const key of ['links','images','horizontal','unclipped'])assert.equal(state[key],true,key);
    for(const key of ['emptyLists','nested','overflow'])assert.equal(state[key],false,key);
    results.push({width,...state});
    await evaluate(`document.querySelector('.page-heading').scrollIntoView()`);
    const shot = await send('Page.captureScreenshot', {format:'png'});
    await writeFile(`artifacts/catalog/${width}.png`, Buffer.from(shot.data,'base64'));
  }
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});
  await evaluate(`document.querySelector('.catalog-category__title a').focus()`);
  assert(await evaluate(`document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).outlineWidth==='3px'`));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert(await evaluate(`getComputedStyle(document.querySelector('.catalog-category a')).transitionDuration.split(',').every(x=>parseFloat(x)<=0.00001)`));
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/catalog/results.json',JSON.stringify(results,null,2));
  console.log('Passed: all 22 categories, exact order/names/children, local file case, images, placeholder links, empty lists, H1/breadcrumbs, desktop/tablet/mobile layout at four widths, overflow, focus, reduced motion; JS disabled and no browser errors.');
} finally {socket?.close();chrome.kill();}





