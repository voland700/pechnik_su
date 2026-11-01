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
  '--remote-debugging-port=9337', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let targets;
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch('http://127.0.0.1:9347/json')).json(); break; } catch { await pause(100); }
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
  await send('Page.navigate', { url: baseUrl + '/' });
  await pause(1000);
  const source = JSON.parse(await (await import('node:fs/promises')).readFile('scripts/fixtures/showcase-reference.json', 'utf8'));
  await mkdir('artifacts/showcase', { recursive: true });
  const results = [];
  for (const width of [360, 390, 576, 768, 1024, 1200, 1440, 1920]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false });
    await evaluate(`document.querySelector('.category-showcase').scrollIntoView()`);
    await pause(150);
    await evaluate(`Promise.all([...document.querySelectorAll('.category-card__image')].map(async image => { image.loading = 'eager'; await image.decode(); }))`);
    const state = await evaluate(`(() => {
      const section = document.querySelector('.category-showcase');
      const grid = section.querySelector('.category-showcase__grid');
      const cards = [...grid.querySelectorAll('.category-card')];
      const titles = [...grid.querySelectorAll('.category-card__title')];
      return { width: innerWidth, count: cards.length, columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        names: titles.map(t => t.textContent), overflow: document.documentElement.scrollWidth > innerWidth,
        images: [...grid.querySelectorAll('img')].every(i => i.complete && i.naturalWidth > 0 && getComputedStyle(i).objectFit === 'contain'),
        links: grid.querySelectorAll('a').length, cursor: getComputedStyle(cards[0]).cursor,
        textClipped: titles.some(t => t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1),
        equalRowHeights: cards.slice(0, getComputedStyle(grid).gridTemplateColumns.split(' ').length).every(c => Math.abs(c.getBoundingClientRect().height - cards[0].getBoundingClientRect().height) < 1),
        imageRatio: grid.querySelector('.category-card__media').getBoundingClientRect().width / grid.querySelector('.category-card__media').getBoundingClientRect().height };
    })()`);
    assert.equal(state.count, 22); assert.deepEqual(state.names, source.map(i => i.name));
    assert.equal(state.columns, width >= 1200 ? 5 : width >= 992 ? 4 : width >= 768 ? 3 : 2);
    assert.equal(state.overflow, false); assert.equal(state.images, true); assert.equal(state.links, 22);
    assert.equal(state.textClipped, false); assert.equal(state.equalRowHeights, true); assert.equal(state.cursor, 'pointer');
    assert(Math.abs(state.imageRatio - 4 / 3) < .01, 'Stable media aspect ratio');
    results.push(state);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`artifacts/showcase/${width}.png`, Buffer.from(screenshot.data, 'base64'));
  }
  await evaluate(`document.querySelector('a.category-card').scrollIntoView({ block: 'center' })`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
  await evaluate(`document.querySelector('a.category-card').focus()`);
  await pause(350);
  assert.equal(await evaluate(`document.activeElement.matches(':focus-visible')`), true);
  assert.equal(await evaluate(`getComputedStyle(document.activeElement).outlineWidth`), '3px');
  assert.equal(await evaluate(`getComputedStyle(document.activeElement).color`), 'rgb(171, 72, 0)');
  await evaluate(`document.activeElement.blur()`);
  const cardBounds = await evaluate(`(() => { const b = document.querySelector('a.category-card').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...cardBounds });
  await pause(350);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('a.category-card')).color`), 'rgb(171, 72, 0)');
  assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('a.category-card')).boxShadow`), 'none');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('a.category-card')].map(a => a.getAttribute('href'))`), Array(22).fill('#'));
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('a.category-card')).transform`), 'none');
  await send('Emulation.setEmulatedMedia', { features: [] });
  if (process.env.SHOWCASE_TEST_FIXTURES) {
    await send('Page.navigate', { url: baseUrl + '/showcase-check/' });
    await pause(500);
    assert.equal(await evaluate(`document.querySelector('[data-empty]').children.length`), 0);
    assert.equal(await evaluate(`document.querySelector('[data-mixed]').querySelectorAll('a.category-card').length`), 5);
    assert.equal(await evaluate(`new Set([...document.querySelectorAll('.category-showcase__heading')].map(e => e.id)).size`), 2);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
    await evaluate(`document.querySelector('a.category-card').focus()`);
    assert.equal(await evaluate(`document.activeElement.matches(':focus-visible')`), true);
    assert.equal(await evaluate(`getComputedStyle(document.activeElement).outlineWidth`), '3px');
    const bounds = await evaluate(`(() => { const b = document.activeElement.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...bounds }); await pause(350);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('a.category-card')).color`), 'rgb(171, 72, 0)');
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-mixed] a.category-card')].map(a => a.getAttribute('href'))`), ['/#main', '#', '#', '#', '#']);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...bounds });
    await pause(350);
    assert.equal(await evaluate(`document.querySelector('a.category-card').matches(':active')`), true);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('a.category-card')).boxShadow`), 'none');
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...bounds });
    await send('Page.navigate', { url: baseUrl + '/showcase-check/' }); await pause(500);
    await evaluate(`document.querySelector('a.category-card').scrollIntoView()`);
    const hover = await evaluate(`(() => {const b = document.querySelector('a.category-card').getBoundingClientRect(); return {x: b.x + 30, y: b.y + 30};})()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...hover });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('a.category-card')).transform`), 'none');
    await evaluate(`document.querySelector('a.category-card').click()`); await pause(600);
    assert.equal(await evaluate('location.pathname + location.hash'), '/#main');
  }
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await send('Page.navigate', { url: baseUrl + '/' }); await pause(500);
  assert.equal(await evaluate(`document.querySelectorAll('.category-showcase .category-card').length`), 22);
  await send('Emulation.setScriptExecutionDisabled', { value: false });
  assert.deepEqual(errors, [], 'Browser errors');
  await writeFile('artifacts/showcase/results.json', JSON.stringify(results, null, 2));
  console.log('Passed: 22 categories/order/images, 8 widths, 2/3/4/5 columns, full titles, media ratio, no overflow; fixtures when enabled; no browser errors.');
} finally { socket?.close(); chrome.kill(); }


