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





  await send('Page.navigate',{url:baseUrl+'/article/'}); await pause(700);
  await mkdir('artifacts/article-listing',{recursive:true});
  const expected=JSON.parse(await (await import('node:fs/promises')).readFile('artifacts/articles_list.json','utf8'));
  for(const width of [1440,1200,1024,768,576,375,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
    await evaluate(`document.fonts.ready.then(()=>Promise.all([...document.querySelectorAll('.article-card__image')].map(i=>{i.loading='eager';return i.decode()})))`);
    const state=await evaluate(`(()=>{const cards=[...document.querySelectorAll('.article-card')];return {
      titles:cards.map(c=>c.querySelector('h2').textContent),texts:cards.map(c=>c.querySelector('p').textContent),
      columns:getComputedStyle(document.querySelector('.articles-listing')).gridTemplateColumns.split(' ').length,
      overflow:document.documentElement.scrollWidth>innerWidth,
      images:cards.every(c=>{const i=c.querySelector('img');return i.complete&&i.naturalWidth&&i.alt===c.querySelector('h2').textContent&&getComputedStyle(i).objectFit==='contain'}),
      horizontal:cards.every(c=>c.querySelector('.article-card__content').getBoundingClientRect().left>c.querySelector('.article-card__media').getBoundingClientRect().right),
      links:cards.every(c=>c.querySelector('a').getAttribute('href')==='#'&&c.querySelectorAll('a').length===1),
      h1:document.querySelectorAll('h1').length,main:document.querySelectorAll('main').length,
      sidebar:getComputedStyle(document.querySelector('.catalog-sidebar')).display,
      filter:!!document.querySelector('.catalog-filter'),pagination:!!document.querySelector('.pagenavigation [aria-current="page"]'),
      crumbs:[...document.querySelectorAll('.breadcrumbs li')].map(i=>i.textContent.trim())
    }})()`);
    assert.deepEqual(state.titles,expected.map(i=>i.title)); assert.deepEqual(state.texts,expected.map(i=>i.text));
    assert.equal(state.columns,width>=1200?2:1);assert(!state.overflow);assert(state.images&&state.horizontal&&state.links&&state.pagination);assert(!state.filter);assert.equal(state.h1,1);assert.equal(state.main,1);assert.deepEqual(state.crumbs,['Главная','Статьи']);assert.equal(state.sidebar,width<768?'none':'block');
    if(width===1440||width===375){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/article-listing/'+width+'.png',Buffer.from(shot.data,'base64'));}
    console.log('Passed',width);
  }
  await evaluate(`document.querySelector('.article-card__link').focus()`);
  assert(await evaluate(`getComputedStyle(document.activeElement).outlineWidth==='3px'`));
  assert.deepEqual(errors,[]);
} finally {socket?.close();chrome.kill();}
