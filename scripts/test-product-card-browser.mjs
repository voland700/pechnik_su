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
  '--remote-debugging-port=9359', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let targets;
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch('http://127.0.0.1:9359/json')).json(); break; } catch { await pause(100); }
  }
  assert(targets, 'Chrome CDP unavailable');
  const target = targets.find(item => item.type === 'page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
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
    const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error('CDP timeout: ' + method)); }, 10000);
    pending.set(requestId, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: baseUrl + '/products-demo/' });
  await pause(1000);

  await mkdir('artifacts/product-card', { recursive: true });
  const results = [];
  for (const width of [360, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false });
    await evaluate(`Promise.all([...document.querySelectorAll('.product-card__image')].map(async i => { i.loading = 'eager'; await i.decode(); }))`);
    const state = await evaluate(`(() => {
      const cards = [...document.querySelectorAll('[data-product-card]')];
      return {width: innerWidth, count: cards.length, overflow: document.documentElement.scrollWidth > innerWidth,
        images: cards.every(c => {const i=c.querySelector('img'); return i.naturalWidth > 0 && getComputedStyle(i).objectFit === 'contain';}),
        enabled: cards.slice(0,12).map(c => !c.querySelector('[type=submit]').disabled),
        labels: cards[5].querySelectorAll('.product-card__badge').length,
        request: cards[8].querySelector('.product-card__prices').textContent.trim(),
        oldPriceHidden: !cards[8].querySelector('.product-card__old-price'),
        disabled: cards.filter(c => c.querySelector('[type=submit]').disabled).every(c => [...c.querySelectorAll('button, [name=quantity]')].every(e => e.disabled))};
    })()`);
    assert.equal(state.count, 13); assert.equal(state.overflow, false); assert.equal(state.images, true);
    assert.deepEqual(state.enabled, [true,true,true,true,true,true,true,false,false,true,false,false]);
    assert.equal(state.labels, 3); assert.equal(state.request, '???? ?? ???????'); assert(state.oldPriceHidden && state.disabled);
    results.push(state);
  }
  for (const width of [220, 280, 360, 460]) {
    const state = await evaluate(`(() => {const box=document.querySelector('.products-demo__resize');box.style.width='` + width + `px'; const card=box.querySelector('.product-card'); const actions=card.querySelector('form'); const q=card.querySelector('.product-card__quantity').getBoundingClientRect();const b=card.querySelector('[type=submit]').getBoundingClientRect();return {width: card.clientWidth,direction:getComputedStyle(actions).flexDirection,overflow:card.scrollWidth>card.clientWidth, buttonBelow:b.top>=q.bottom};})()`);
    assert.equal(state.overflow,false); assert.equal(state.direction,'row'); assert.equal(state.buttonBelow,false);
    results.push(state);
  }
  const behavior = await evaluate(`(() => {
    const forms=[...document.querySelectorAll('[data-product-form]')];const f=forms[0], input=f.elements.namedItem('quantity');
    const events=[];document.addEventListener('product-card:demo-submit',e=>events.push(e.detail));
    f.querySelector('[data-quantity-step="1"]').click(); const plus=input.value;
    f.querySelector('[data-quantity-step="-1"]').click(); f.querySelector('[data-quantity-step="-1"]').click(); const min=input.value;
    const values=['','0','-3','1.5','1e2','99999','7'].map(v=>{input.value=v;f.requestSubmit();return input.value;});
    forms[7].dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    return {plus,min,values,events,independent:forms[1].elements.namedItem('quantity').value};
  })()`);
  assert.equal(behavior.plus,'2');assert.equal(behavior.min,'1');assert.equal(behavior.independent,'1');
  assert.deepEqual(behavior.values,['1','1','1','1','1','999','7']);assert.equal(behavior.events.length,7);
  assert.deepEqual(behavior.events[6],{productId:'1001',quantity:7});
  const url = await evaluate('location.href');
  await evaluate(`document.querySelector('.product-card__title a').click()`); assert.equal(await evaluate('location.href'),url);
  await send('Input.dispatchKeyEvent', {type:'keyDown',key:'Tab',code:'Tab'});
  await send('Input.dispatchKeyEvent', {type:'keyUp',key:'Tab',code:'Tab'});
  await evaluate(`document.querySelector('.product-card__quantity-input').focus()`);
  assert.equal(await evaluate(`document.activeElement.matches(':focus-visible') && getComputedStyle(document.activeElement).outlineWidth === '3px'`),true);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.product-card')).transitionDuration`),'1e-05s');
  await evaluate(`document.querySelector('.products-demo__resize').scrollIntoView({block:'center'})`);
  const screenshot = await send('Page.captureScreenshot',{format:'png'});
  await writeFile('artifacts/product-card/container.png',Buffer.from(screenshot.data,'base64'));
  assert.deepEqual(errors,[],'Browser errors');
  await writeFile('artifacts/product-card/results.json',JSON.stringify({results,behavior},null,2));
  console.log('Passed: states, images, 3 viewports, 4 container widths, quantity, demo events, disabled, keyboard focus, reduced motion, no browser errors.');
} finally { socket?.close(); chrome.kill(); }
