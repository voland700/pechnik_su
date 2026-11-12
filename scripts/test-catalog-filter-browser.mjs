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
  const loaded = new Promise(resolve => { pageLoadedResolve = resolve; });
  await send('Page.navigate', {url: baseUrl + '/category/'});
  await loaded;
  await evaluate(`new Promise(resolve=>{const check=()=>document.querySelector('[data-filter-dialog]').parentElement===document.body?resolve():setTimeout(check,50);check()})`);
  const report = [];
  await mkdir('artifacts/catalog-filter', {recursive:true});
  for (const width of [1440,1024,768,375,320]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate('new Promise(r=>setTimeout(r,350))');
    assert(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), 'Page overflow '+width);
    assert.equal(await evaluate(`document.querySelectorAll('[data-filter-form]').length`),1);
    if(width>=768) {
      assert(await evaluate(`document.querySelector('.catalog-sidebar').contains(document.querySelector('[data-catalog-filter]'))`));
    } else {
      await evaluate(`document.querySelector('[data-filter-open]').click()`);
      await evaluate('new Promise(r=>setTimeout(r,350))');
      assert(await evaluate(`document.querySelector('[data-filter-dialog]').open&&document.body.style.overflow==='hidden'`));
      assert(await evaluate(`document.querySelector('[data-filter-dialog]').contains(document.activeElement)`));
      await send('Input.dispatchKeyEvent', {type:'keyDown',key:'Tab',code:'Tab',modifiers:1});
      assert(await evaluate(`document.querySelector('[data-filter-dialog]').contains(document.activeElement)`), 'Focus trap');
    }
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-filter-toggle]')).map(x=>x.getAttribute('aria-expanded'))`),['true','false','false','false','false','false','false']);
    await evaluate(`document.querySelectorAll('[data-filter-toggle]').forEach(b=>{if(b.getAttribute('aria-expanded')==='false')b.click()});document.querySelectorAll('input[type=checkbox]')[0].click();document.querySelectorAll('input[type=checkbox]')[2].click()`);
    assert.equal(await evaluate(`document.querySelectorAll('input:checked').length`),2);
    assert(await evaluate(`(()=>{const v=document.querySelectorAll('.catalog-filter__values')[3];return v.scrollHeight>v.clientHeight})()`));
    await evaluate(`(()=>{const n=document.querySelector('[data-range-number=min]');n.value=50000;n.dispatchEvent(new Event('change'));})()`);
    assert.equal(await evaluate(`document.querySelector('[data-range-number=min]').value`),'42490');
    await evaluate(`(()=>{const s=document.querySelector('[data-range-slider=min]');s.focus();})()`);
    await send('Input.dispatchKeyEvent', {type:'keyDown',key:'ArrowLeft',code:'ArrowLeft'});
    assert.equal(await evaluate(`document.querySelector('[data-range-number=min]').value`),'42489');
    await evaluate(`document.querySelector('button[type=reset]').click()`);
    assert.equal(await evaluate(`document.querySelectorAll('input:checked').length`),0);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-range-number]')).map(n=>n.value)`),['0','42490']);
    await evaluate(`document.querySelectorAll('[data-filter-toggle]').forEach((b,i)=>{if(i)b.click()})`);
    const shot = await send('Page.captureScreenshot', {format:'png'});
    await writeFile(`artifacts/catalog-filter/${width}.png`,Buffer.from(shot.data,'base64'));
    if(width<768) {
      for(const method of ['escape','cross','overlay']) {
        if(method!=='escape') await evaluate(`document.querySelector('[data-filter-open]').click()`);
        await evaluate('new Promise(r=>setTimeout(r,350))');
        if(method==='escape') { await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'}); await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'}); }
        if(method==='cross') await evaluate(`document.querySelector('[data-filter-close]').click()`);
        if(method==='overlay') await send('Input.dispatchMouseEvent',{type:'mousePressed',x:width-5,y:400,button:'left',clickCount:1});
        if(method==='overlay') await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:width-5,y:400,button:'left',clickCount:1});
        await evaluate('new Promise(r=>setTimeout(r,350))');
        assert(await evaluate(`!document.querySelector('[data-filter-dialog]').open&&document.body.style.overflow===''&&document.activeElement.matches('[data-filter-open]')`),method);
      }
    }
    report.push({width,passed:true});
  }
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/catalog-filter/results.json',JSON.stringify(report,null,2));
  console.log('Passed: five widths, one form, accordion, multiple choices, range limits and keyboard, reset, modal focus and three close methods, no overflow or browser errors.');
} finally {socket?.close();chrome.kill();}

