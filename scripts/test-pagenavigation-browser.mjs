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
  const { readFile, readdir, unlink } = await import('node:fs/promises');
  const { transform } = await import('@astrojs/compiler');
  const { transform: transpile } = await import('esbuild');
  const { experimental_AstroContainer } = await import('astro/container');
  const iconFile = new URL('./.pagenavigation-icon-test.mjs', import.meta.url);
  const componentFile = new URL('./.pagenavigation-test.mjs', import.meta.url);
  const compile = async (source, filename) => {
    const compiled = await transform(source, {filename, internalURL:'astro/compiler-runtime', astroGlobalArgs:'undefined'});
    const code = compiled.code.replace(/,\s*createMetadata as \$\$createMetadata/, '').replace(/^export const \$\$metadata = .*;$/m, '');
    return (await transpile(code, {loader:'ts',format:'esm'})).code;
  };
  const sources = {};
  for (const file of await readdir('src/assets/icons/inline')) {
    if(file.endsWith('.svg')) sources['../../assets/icons/inline/'+file] = await readFile('src/assets/icons/inline/'+file,'utf8');
  }
  let Component;
  try {
    const icon = (await readFile('src/components/ui/Icon.astro','utf8'))
      .replace(/import\.meta\.glob<string>\([\s\S]*?\}\);/,JSON.stringify(sources)+';');
    await writeFile(iconFile, await compile(icon,'Icon.astro'), {flag:'wx'});
    const source = (await readFile('src/components/common/Pagenavigation.astro','utf8'))
      .replace("'../ui/Icon.astro'", "'./.pagenavigation-icon-test.mjs'")
      .replace("'../../utils/url'", "'../src/utils/url.ts'");
    await writeFile(componentFile, await compile(source,'Pagenavigation.astro'), {flag:'wx'});
    Component = (await import(componentFile.href)).default;
  } finally {
    await unlink(componentFile).catch(()=>{});
    await unlink(iconFile).catch(()=>{});
  }
  const container = await experimental_AstroContainer.create();
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  const loaded = new Promise(resolve => { pageLoadedResolve = resolve; });
  await send('Page.navigate',{url:baseUrl+'/category/'});
  await loaded;
  await evaluate('document.fonts.ready');
  await evaluate("Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode().catch(()=>{})}))");
  assert(await evaluate("document.querySelector('.catalog-products').nextElementSibling.matches('.pagenavigation')"));
  const report=[];
  await mkdir('artifacts/pagenavigation',{recursive:true});
  for(const currentPage of [1,3,5]) {
    const html = await container.renderToString(Component,{props:{currentPage,totalPages:5}});
    assert(!/<script|\son\w+=|<button/.test(html));
    await evaluate('document.querySelector(".pagenavigation").outerHTML='+JSON.stringify(html));
    const state=await evaluate(`(()=>{
      const nav=document.querySelector('.pagenavigation'),current=nav.querySelector('[aria-current]');
      return {current:current.textContent,currentTag:current.tagName,
        disabled:[...nav.querySelectorAll('[aria-disabled]')].map(x=>({tag:x.tagName,label:x.getAttribute('aria-label'),tab:x.tabIndex,href:x.hasAttribute('href')})),
        links:[...nav.querySelectorAll('a')].map(x=>({label:x.getAttribute('aria-label'),href:x.getAttribute('href')})),
        icons:[...nav.querySelectorAll('svg')].every(x=>x.getAttribute('aria-hidden')==='true'&&x.getAttribute('focusable')==='false')};
    })()`);
    assert.equal(state.current,String(currentPage));
    assert.equal(state.currentTag,'SPAN');
    assert.equal(state.disabled.length,currentPage===3?0:1);
    for(const d of state.disabled){assert.equal(d.tag,'SPAN');assert.equal(d.tab,-1);assert.equal(d.href,false);assert.equal(d.label,currentPage===1?'Предыдущая страница':'Следующая страница');}
    assert.equal(state.links.length,currentPage===3?6:5);
    assert(state.links.every(x=>x.href===''));
    assert(state.icons);
    for(const width of [1440,1024,768,390,320]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      await evaluate("document.querySelector('.pagenavigation').scrollIntoView({block:'center',behavior:'instant'})");
      const geometry=await evaluate(`(()=>{
        const nav=document.querySelector('.pagenavigation'),list=nav.querySelector('ul').getBoundingClientRect();
        const items=[...nav.querySelectorAll('li')].map(x=>x.getBoundingClientRect());
        return {overflow:document.documentElement.scrollWidth>innerWidth,
          oneRow:items.every(x=>Math.abs(x.top-items[0].top)<1),
          centered:Math.abs((items[0].left+items.at(-1).right)/2-(list.left+list.right)/2)<1,
          heights:items.every(x=>x.height>=44)};
      })()`);
      assert.equal(geometry.overflow,false);
      for(const key of ['oneRow','centered','heights'])assert(geometry[key],key+' '+currentPage+' '+width);
      report.push({currentPage,width,...geometry});
      if(currentPage===1 && width===1440) {
        const clip=await evaluate("(()=>{const r=document.querySelector('.pagenavigation').getBoundingClientRect();return {x:0,y:Math.max(0,r.top+scrollY-24),width:innerWidth,height:r.height+48,scale:1}})()");
        const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
        await writeFile('artifacts/pagenavigation/'+width+'.png',Buffer.from(shot.data,'base64'));
      }
    }
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await evaluate("document.querySelector('.pagenavigation a').focus()");
    assert(await evaluate("document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).outlineWidth==='3px'"));
  }
  const custom=await container.renderToString(Component,{props:{currentPage:3,totalPages:12,pages:[1,2,3,null,12],links:{1:'/news/',2:'/news/page/2/',4:'/news/page/4/',12:'/news/page/12/'}}});
  await evaluate('document.querySelector(".pagenavigation").outerHTML='+JSON.stringify(custom));
  assert(await evaluate(`(()=>{const n=document.querySelector('.pagenavigation');return n.querySelector('[rel="prev"]').getAttribute('href')==='/news/page/2/'&&n.querySelector('[rel="next"]').getAttribute('href')==='/news/page/4/'&&n.querySelector('.pagenavigation__ellipsis').tagName==='SPAN'&&!n.querySelector('.pagenavigation__ellipsis').hasAttribute('href')&&!n.querySelector('.pagenavigation__ellipsis').hasAttribute('tabindex')})()`));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert(await evaluate("getComputedStyle(document.querySelector('.pagenavigation a')).transitionDuration.split(',').every(x=>parseFloat(x)<=0.00001)"));
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/pagenavigation/results.json',JSON.stringify(report,null,2));
  console.log('Passed: first/middle/last states, current and disabled spans, arrow names, decorative SVGs, custom CMS URLs and ellipsis, centered single row/no overflow at five widths in all states, keyboard focus, reduced motion; JS disabled.');
} finally {socket?.close();chrome.kill();}
