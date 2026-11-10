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
  const { readFile, unlink } = await import('node:fs/promises');
  const { transform } = await import('@astrojs/compiler');
  const { transform: transpile } = await import('esbuild');
  const { experimental_AstroContainer } = await import('astro/container');
  const compiled = await transform(await readFile('src/components/common/Breadcrumbs.astro', 'utf8'), {
    filename: 'Breadcrumbs.astro', internalURL: 'astro/compiler-runtime', astroGlobalArgs: 'undefined',
  });
  // The standalone compiler emits legacy metadata; this pure component has no
  // hydrated children or assets, and Astro 6 no longer exports that helper.
  const code = compiled.code
    .replace(/,\s*createMetadata as \$\$createMetadata/, '')
    .replace(/^export const \$\$metadata = .*;$/m, '');
  const js = await transpile(code, { loader: 'ts', format: 'esm' });
  const temporary = new URL('./.breadcrumbs-test-component.mjs', import.meta.url);
  let Component;
  try {
    await writeFile(temporary, js.code, { flag: 'wx' });
    Component = (await import(temporary.href)).default;
  } finally { await unlink(temporary); }
  const container = await experimental_AstroContainer.create();
  const chains = [
    [{ label: 'UI Kit' }],
    [{ label: 'Каталог', href: '/catalog/' }, { label: 'Печи-камины' }],
    [{ label: 'Каталог', href: '/catalog/' }, { label: 'Печи-камины', href: '/catalog/stoves/' }, { label: 'WIKING', href: '/ignored/' }],
    [...Array.from({ length: 12 }, (_, i) => ({ label: `Раздел ${i}`, href: `/section-${i}/` })), { label: 'Очень длинное название текущей страницы '.repeat(12) }],
    [{ label: 'Нет адреса' }, { label: 'Пустой адрес', href: '' }, { label: 'Заглушка', href: '#' }, { label: 'Товар'.repeat(100) }],
    [{ label: '<script>alert(1)</script>', href: '/ignored/' }],
  ];
  assert.equal((await container.renderToString(Component, { props: { items: [] } })).trim(), '');
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await send('Page.navigate', { url: baseUrl + '/ui-kit/' }); await pause(400);
  assert(await evaluate(`document.querySelector('h1').nextElementSibling.matches('nav.breadcrumbs')`));
  assert(await evaluate(`document.querySelector('#main').firstElementChild.matches('.page-heading') && !document.querySelector('.kit-intro h1, .kit-intro .breadcrumbs')`));
  assert.equal(await evaluate(`document.querySelector('.breadcrumbs__current').textContent`), 'Основа для тёплых решений.');
  const results = [];
  for (const items of chains) {
    const html = await container.renderToString(Component, { props: { items } });
    assert(!html.includes('<script'));
    await evaluate(`document.querySelector('.breadcrumbs').outerHTML = ${JSON.stringify(html)}`);
    const state = await evaluate(`(()=>{const n=document.querySelector('.breadcrumbs');return {label:n.getAttribute('aria-label'),items:[...n.querySelectorAll('ol > li')].map(x=>x.textContent.trim()),links:[...n.querySelectorAll('a')].map(x=>x.getAttribute('href')),current:n.querySelector('[aria-current="page"]').textContent,lastLink:!!n.querySelector('li:last-child a')}})()`);
    assert.equal(state.label, 'Хлебные крошки');
    assert.deepEqual(state.items, ['Главная', ...items.map(i => i.label.trim())]);
    assert.deepEqual(state.links, ['/', ...items.slice(0, -1).filter(i => i.href && i.href !== '#').map(i => i.href)]);
    assert.equal(state.current, items.at(-1).label); assert.equal(state.lastLink, false);
    for (const width of [375, 768, 1024, 1440]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false });
      assert(await evaluate(`document.querySelector('.page-heading').getBoundingClientRect().width === document.querySelector('#main').getBoundingClientRect().width`));
      const geometry = await evaluate(`(()=>{const n=document.querySelector('.breadcrumbs');return {overflow:document.documentElement.scrollWidth>innerWidth,bounds:[...n.querySelectorAll('li,a,span')].every(x=>{const r=x.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}),wrap:getComputedStyle(n.querySelector('ol')).flexWrap,separator:getComputedStyle(n.querySelector('li+li'),'::before').content}})()`);
      assert.equal(geometry.overflow, false); assert.equal(geometry.bounds, true); assert.equal(geometry.wrap, 'wrap'); assert.equal(geometry.separator, '""');
      results.push({ depth: items.length, width, ...geometry });
    }
  }
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
  await evaluate(`document.querySelector('.breadcrumbs a').focus()`);
  assert(await evaluate(`document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).outlineWidth==='3px'`));
  await send('Page.navigate', { url: baseUrl + '/' }); await pause(400);
  assert.equal(await evaluate(`document.querySelectorAll('.breadcrumbs').length`), 0);
  await mkdir('artifacts/breadcrumbs', { recursive: true });
  await writeFile('artifacts/breadcrumbs/results.json', JSON.stringify(results, null, 2));
  console.log('Passed: actual Astro component rendered for six chains and empty input; 24 width/chain checks, URLs, current, escaping, CSS separators, no overflow, focus, UI Kit placement and home absence; JS disabled.');
} finally { socket?.close(); chrome.kill(); }





