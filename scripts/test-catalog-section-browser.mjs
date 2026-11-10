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
  const { readFile, readdir, unlink } = await import('node:fs/promises');
  const { transform: transpile } = await import('esbuild');
  const loadData = async path => {
    const { code } = await transpile(await readFile(path, 'utf8'), {loader:'ts',format:'esm'});
    return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  };
  const { rubtsovskCategories: items } = await loadData('src/data/rubtsovsk-casting.ts');
  assert.equal(items.length,12);
  const files=await readdir('assets/images/categories');
  items.forEach(item=>assert(files.includes(item.img.split('/').at(-1))));
  const { transform }=await import('@astrojs/compiler');
  const { experimental_AstroContainer }=await import('astro/container');
  const container=await experimental_AstroContainer.create();
  const render=async(name,props)=>{
    const compiled=await transform(await readFile('src/components/catalog/'+name+'.astro','utf8'),{
      filename:name+'.astro',internalURL:'astro/compiler-runtime',astroGlobalArgs:'undefined'
    });
    let code=compiled.code.replace(/,\s*createMetadata as \$\$createMetadata/,'').replace(/^export const \$\$metadata = .*;$/m,'');
    // Tests supply an empty asset map and the actual URL guard; no image optimization is needed here.
    code=code.replace(/import.meta.glob[\s\S]*?\}\);/,'({});')
      .replace("from '../../utils/url'","from '../src/utils/url.ts'");
    const js=await transpile(code,{loader:'ts',format:'esm'});
    const temporary=new URL('./.'+name+'-test.mjs',import.meta.url);
    try {
      await writeFile(temporary,js.code,{flag:'wx'});
      return await container.renderToString((await import(temporary.href+'?'+Math.random())).default,{props});
    } finally {await unlink(temporary);}
  };
  for(const name of ['CatalogNotices','CatalogSubcategories']) {
    assert.equal((await render(name,{items:[]})).trim(),'');
    assert.equal((await render(name,{})).trim(),'');
  }
  const noticeHtml=await render('CatalogNotices',{items:[
    'Актуальность стоимости и наличия товаров уточняйте у менеджера.',
    [{text:'Внимание!',strong:true},{text:' Отгрузка, самовывоз кирпича и смесей производится '},{text:'только с Центрального склада.',strong:true}],
    '<script>alert(1)</script>'
  ]});
  assert.equal((noticeHtml.match(/class="catalog-notices__item"/g)||[]).length,3);
  assert(noticeHtml.includes('<strong>Внимание!</strong>'));
  assert(!noticeHtml.includes('<script>'));
  assert((await render('CatalogSubcategories',{items:[{name:'Без изображения',img:'missing.jpg',url:'#'}]})).includes('Изображение недоступно'));
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  await send('Page.navigate',{url:baseUrl+'/catalog/'});
  await pause(400);
  const sidebar=await evaluate("document.querySelector('.catalog-sidebar').outerHTML");
  await send('Page.navigate',{url:baseUrl+'/category/'});
  await pause(400);
  assert.equal(await evaluate("document.querySelector('.catalog-sidebar').outerHTML"),sidebar);
  await mkdir('artifacts/catalog-section',{recursive:true});
  const results=[];
  for(const width of [1440,1024,768,390,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
    await evaluate("document.fonts.ready.then(()=>Promise.all([...document.querySelectorAll('.catalog-subcategories img')].map(i=>{i.loading='eager';return i.decode()})))");
    const state=await evaluate(`(()=>{
      const grid=document.querySelector('.catalog-subcategories'),links=[...grid.querySelectorAll('a')];
      return {
        h1:[...document.querySelectorAll('h1')].map(x=>x.textContent),
        crumbs:[...document.querySelectorAll('.breadcrumbs li')].map(x=>x.textContent.trim()),
        titles:links.map(x=>x.querySelector('.catalog-subcategories__name').textContent),
        columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        sidebar:getComputedStyle(document.querySelector('.catalog-sidebar')).display,
        notices:[...document.querySelectorAll('.catalog-notices__item')].map(x=>x.textContent.trim()),
        links:links.every(x=>x.getAttribute('href')==='#'&&!x.querySelector('a,button')),
        images:links.every(x=>{const i=x.querySelector('img');return i.naturalWidth>0&&getComputedStyle(i).objectFit==='contain'}),
        layout:links.every(x=>{const i=x.querySelector('img').getBoundingClientRect(),n=x.querySelector('.catalog-subcategories__name').getBoundingClientRect();return innerWidth<768?i.right<=n.left:i.bottom<=n.top}),
        overflow:document.documentElement.scrollWidth>innerWidth,
        main:document.querySelectorAll('main').length
      };
    })()`);
    assert.deepEqual(state.h1,['Печное литьё Рубцовское']);
    assert.deepEqual(state.crumbs,['Главная','Каталог','Чугунное и печное литьё','Печное литьё Рубцовское']);
    assert.deepEqual(state.titles,items.map(x=>x.name));
    assert.deepEqual(state.notices,['Актуальность стоимости и наличия товаров уточняйте у менеджера.']);
    assert.equal(state.columns,width>=1200?4:width>=992?3:width>=768?2:1);
    assert.equal(state.sidebar,width>=768?'block':'none');
    assert.equal(state.main,1);
    for(const key of ['links','images','layout'])assert(state[key],key);
    assert.equal(state.overflow,false);
    results.push({width,...state});
    await evaluate("document.querySelector('.page-heading').scrollIntoView()");
    const shot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile('artifacts/catalog-section/'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});
  await evaluate("document.querySelector('.catalog-subcategories__link').focus()");
  assert(await evaluate("document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).outlineWidth==='3px'"));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert(await evaluate("getComputedStyle(document.querySelector('.catalog-subcategories__link')).transitionDuration.split(',').every(x=>parseFloat(x)<=0.00001)"));
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/catalog-section/results.json',JSON.stringify(results,null,2));
  console.log('Passed: component empty/default data, two notices/strong/HTML escaping, missing image fallback; 12 categories, sidebar equality, H1/breadcrumbs, images, geometry, overflow at 1440/1024/768/390/320, focus and reduced motion; JS disabled.');
} finally {socket?.close();chrome.kill();}
