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
  await send('Page.navigate', { url: 'http://127.0.0.1:4321/' });
  await pause(1400);
  await mkdir('artifacts/hero', { recursive: true });
  const results = [];
  for (const width of [390, 576, 768, 1024, 1440, 1920]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await pause(200);
    await evaluate(`document.querySelector('[data-hero-toggle]').click()`);
    for (let index = 0; index < 4; index++) {
      await evaluate(`void document.querySelector('[data-hero-slider]').swiper.slideToLoop(${index}, 0)`);
      await pause(150);
      const state = await evaluate(`(() => {
        const el = document.querySelector('[data-hero-slider]');
        const slide = el.querySelector('.swiper-slide-active');
        const text = slide.querySelector('.hero-slider__text').getBoundingClientRect();
        const image = slide.querySelector('.hero-slider__image').getBoundingClientRect();
        return { width: innerWidth, index: el.swiper.realIndex, overflow: document.documentElement.scrollWidth > innerWidth,
          images: [...slide.querySelectorAll('img')].every(i => i.complete && i.naturalWidth > 0),
          link: !!slide.querySelector('.hero-slider__button'), overlap: innerWidth < 768 ? text.bottom > image.top : text.right > image.left,
          overlay: getComputedStyle(slide.querySelector('.hero-slider__overlay')).backgroundImage,
          opacity: getComputedStyle(slide.querySelector('.hero-slider__title')).opacity,
          textInset: text.left - el.getBoundingClientRect().left,
          controlsInset: parseFloat(getComputedStyle(el.querySelector('.hero-slider__controls')).paddingLeft),
          titleSize: getComputedStyle(slide.querySelector('.hero-slider__title')).fontSize,
          descriptionSize: getComputedStyle(slide.querySelector('.hero-slider__description')).fontSize };
      })()`);
      assert.equal(state.overflow, false); assert.equal(state.images, true); assert.equal(state.overlap, false);
      assert.equal(state.link, index < 2); assert.equal(state.opacity, '1'); assert.notEqual(state.overlay, 'none');
      if (width >= 992) {
        assert(state.textInset >= 48, 'Desktop text inset');
        assert(state.controlsInset >= 48, 'Desktop controls inset');
        assert.equal(state.titleSize, '30px');
      }
      assert.equal(state.descriptionSize, '17.6px');
      assert(state.textInset >= (width >= 768 ? 32 : 20), 'Responsive text inset');
      results.push(state);
    }
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`artifacts/hero/${width}.png`, Buffer.from(screenshot.data, 'base64'));
  }
  await evaluate(`void document.querySelector('[data-hero-slider]').swiper.slideToLoop(0, 0)`);
  await pause(100);
  const before = await evaluate('scrollY');
  await evaluate(`document.querySelector('.swiper-slide-active .hero-slider__button').click()`);
  assert.equal(await evaluate('scrollY'), before);
  await evaluate(`document.querySelector('[data-hero-next]').click()`); await pause(1000);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.realIndex`), 1);
  await evaluate(`document.querySelector('[data-hero-pagination] button:nth-child(3)').click()`); await pause(1000);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.realIndex`), 2);
  await evaluate(`document.querySelector('[data-hero-next]').focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft' });
  await pause(1000);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.realIndex`), 1);
  await evaluate(`document.activeElement.blur(); document.querySelector('[data-hero-toggle]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.autoplay.running`), true);
  await pause(7100);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.realIndex`), 2);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await pause(100);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.autoplay.running`), false);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.params.speed`), 0);
  assert.equal(await evaluate(`document.querySelector('[data-demo-slider]').swiper.slides.length`), 3);
  await send('Emulation.setEmulatedMedia', { features: [] });
  await evaluate(`void document.querySelector('[data-hero-slider]').swiper.slideNext()`);
  await pause(150);
  const layers = await evaluate(`Array.from(document.querySelector('.swiper-slide-active').querySelectorAll('[data-swiper-parallax]')).map(e => getComputedStyle(e).transform)`);
  assert(layers.some(transform => transform !== 'none'), 'Parallax transforms applied');
  if (process.env.HERO_TEST_FIXTURES) {
    await send('Page.navigate', { url: 'http://127.0.0.1:4321/hero-check/' });
    await pause(1000);
    const fixture = await evaluate(`(() => {
      const single = document.querySelector('[data-single] [data-hero-slider]');
      const minimal = document.querySelector('[data-minimal]');
      return { empty: document.querySelector('[data-empty]').children.length,
        controls: single.querySelectorAll('button').length, loop: single.swiper.params.loop,
        autoplay: single.swiper.autoplay.running, links: minimal.querySelectorAll('a').length,
        handlers: minimal.querySelectorAll('[onclick], [onerror], script, [style*="color:red"]').length,
        color: getComputedStyle(minimal.querySelector('.hero-slider__overlay')).backgroundColor };
    })()`);
    assert.deepEqual(fixture, { empty: 0, controls: 0, loop: false, autoplay: false, links: 0, handlers: 0, color: 'rgb(18, 52, 86)' });
  }
  assert.deepEqual(errors, [], 'Browser errors');
  await writeFile('artifacts/hero/results.json', JSON.stringify(results, null, 2));
  console.log('Passed: six widths / four slides, images, overflow, links, overlay, navigation, pagination, keyboard, autoplay, reduced motion, independent demo; no browser errors.');
} finally { socket?.close(); chrome.kill(); }

