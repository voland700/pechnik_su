// Optional smoke check using installed Chrome and Node's native CDP/WebSocket.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
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
    try { targets = await (await fetch('http://127.0.0.1:9337/json')).json(); break; } catch { await pause(100); }
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
    pending.set(requestId, { resolve, reject });
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
  const base = process.env.HEADER_TEST_URL ?? 'http://127.0.0.1:4321/';
  await send('Page.navigate', { url: base });
  await pause(1200);
  await mkdir('artifacts/header', { recursive: true });
  const results = [];
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await evaluate('window.scrollTo(0, 0)');
    await pause(150);
    const initial = await evaluate(`(() => {
      const visible = e => !!e && e.getClientRects().length > 0;
      const search = document.querySelector('.header-search').getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth, contacts: visible(document.querySelector('.shop-header__contacts')), phones: [...document.querySelectorAll('.shop-header__contacts a[href^="tel:"]')].map(a => a.getAttribute('href')), search: { top: search.top, width: search.width }, status: document.querySelector('[data-working-status]').textContent };
    })()`);
    assert.equal(initial.overflow, false, `Overflow at ${width}`);
    assert(await evaluate(`!document.querySelector('.store-contacts__additional')`));
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#main')).paddingTop`), '24px');
    assert.equal(initial.contacts, width >= 992);
    assert.deepEqual(initial.phones, ['tel:+79168818399', 'tel:+79853088316', 'tel:+79099928462', 'tel:+79612673880']);
    assert(initial.status === 'Сейчас работаем' || initial.status === 'Магазин закрыт');
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`artifacts/header/${width}.png`, Buffer.from(screenshot.data, 'base64'));
    await evaluate('window.scrollTo(0, 700)');
    await pause(120);
    const sticky = await evaluate(`(() => {
      const main = document.querySelector('[data-header-main]').getBoundingClientRect();
      const search = document.querySelector('.header-search').getBoundingClientRect();
      return { top: main.top, bottom: main.bottom, searchTop: search.top, searchBottom: search.bottom, contactsBottom: document.querySelector('.shop-header__contacts').getBoundingClientRect().bottom };
    })()`);
    assert(sticky.bottom < 0, `Header scrolls out of view at ${width}`);
    assert(sticky.searchTop >= sticky.top && sticky.searchBottom <= sticky.bottom);
    if (width >= 992) assert(sticky.contactsBottom < 0);
    if (width < 1200) {
      await evaluate('document.querySelector("[data-menu-open]").click()');
      await pause(350);
      const menu = await evaluate(`(() => {
        const d = document.querySelector('dialog'); const links = d.querySelectorAll('a[href^="tel:"]');
        return { open: d.open, modal: d.matches(':modal'), focus: d.contains(document.activeElement), phones: links.length, locked: document.body.style.position, expanded: document.querySelector('[data-menu-open]').getAttribute('aria-expanded') };
      })()`);
      assert.deepEqual(menu, { open: true, modal: true, focus: true, phones: 4, locked: 'fixed', expanded: 'true' });
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 8 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
      assert(await evaluate('document.querySelector("dialog").contains(document.activeElement)'));
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
      await pause(350);
      const closed = await evaluate('({ open: document.querySelector("dialog").open, focus: document.activeElement === document.querySelector("[data-menu-open]"), scroll: window.scrollY })');
      assert.deepEqual(closed, { open: false, focus: true, scroll: 700 });
      await evaluate('document.querySelector("[data-menu-open]").click()');
      await pause(350);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: width - 1, y: 500, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: width - 1, y: 500, button: 'left', clickCount: 1 });
      if (width > 416) { await pause(350); assert(await evaluate('!document.querySelector("dialog").open')); }
      else { await evaluate('document.querySelector("[data-menu-close]").click()'); await pause(350); }
      await evaluate('document.querySelector("[data-menu-open]").click()');
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
      await pause(100);
      assert(await evaluate('!document.querySelector("dialog").open && document.body.style.position !== "fixed"'));
    }
    results.push({ width, initial, sticky, passed: true });
  }
  await evaluate(`(() => { const f = document.querySelector('.header-search'); f.addEventListener('submit', e => { e.preventDefault(); window.headerSearchResult = { action: f.getAttribute('action'), entries: [...new FormData(f).entries()] }; }, {once: true}); const input = f.querySelector('input'); input.value = 'печь'; input.focus(); })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.deepEqual(await evaluate('window.headerSearchResult'), { action: '/search/', entries: [['q', 'печь']] });
  if (process.env.HEADER_FIXTURE === '1') {
    await send('Page.navigate', { url: new URL('/header-check/', base).href });
    await pause(700);
    const variants = await evaluate(`([...document.querySelectorAll('[data-header]')].map(h => ({count: h.querySelector('[data-cart-count]').textContent, filled: h.querySelector('[data-cart-count]').classList.contains('header-cart__count--filled'), account: h.querySelector('.shop-header__account').textContent, active: h.querySelector('.header-nav__link.active')?.getAttribute('aria-current')})))`);
    assert.deepEqual(variants, [
      { count: '0', filled: false, account: 'Вход', active: 'page' },
      { count: '7', filled: true, account: 'Личный кабинет', active: 'page' },
      { count: '100', filled: true, account: 'Вход', active: 'page' },
    ]);
    console.log('SSR props: cart 0/7/100, both account states, active/aria-current passed.');
  }
  assert.deepEqual(errors, [], 'Browser errors');
  await writeFile('artifacts/header/results.json', JSON.stringify(results, null, 2));
  console.log('Passed: 390/768/1024/1440/1920, overflow, contacts, non-sticky header/search, main spacing, menu, focus, Escape, overlay, resize, scroll restoration; no browser errors.');
} finally {
  socket?.close();
  chrome.kill();
}
