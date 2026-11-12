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
  const productItems=JSON.parse(await readFile('assets/products.json','utf8')).slice(0,32);
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
    const sorting=await evaluate(`(()=>{
      const panel=document.querySelector('.catalog-sorting');
      const fields=[...panel.querySelectorAll('select')];
      const groups=[...panel.children].map(x=>x.getBoundingClientRect());
      const bounds=panel.getBoundingClientRect();
      return {
        fields:fields.map(x=>({id:x.id,value:x.value,label:x.labels[0]?.textContent,
          options:[...x.options].map(o=>[o.value,o.textContent,o.hasAttribute('selected')])})),
        unique:fields.every(x=>document.querySelectorAll('[id="'+x.id+'"]').length===1),
        noForm:!panel.closest('form'),
        noHandlers:![panel,...panel.querySelectorAll('*')].some(x=>[...x.attributes].some(a=>a.name.startsWith('on'))),
        within:fields.every(x=>{const r=x.getBoundingClientRect();return r.left>=bounds.left&&r.right<=bounds.right&&r.height>=44}),
        horizontal:Math.abs(groups[0].top-groups[1].top)<1,
        edges:Math.abs(groups[0].left-bounds.left-17)<1&&Math.abs(bounds.right-groups[1].right-17)<1,
        vertical:groups[0].bottom<=groups[1].top,
        afterCategories:!!(document.querySelector('.catalog-subcategories').compareDocumentPosition(panel)&Node.DOCUMENT_POSITION_FOLLOWING)
      };
    })()`);
    assert.deepEqual(sorting.fields,[
      {id:'sortSelected',value:'default',label:'Сортировать:',options:[
        ['default','По порядку',true],['price_asc','По цене (возрастанию)',false],
        ['price_desc','По цене (убыванию)',false],['name_asc','По названию (А - Я)',false],['name_desc','По названию (Я - А)',false]]},
      {id:'sortCount',value:'32',label:'Показывать по:',options:['12','24','32','44','60','72'].map(x=>[x,x,x==='32'])}
    ]);
    for(const key of ['unique','noForm','noHandlers','within','afterCategories'])assert(sorting[key],key);
    assert(width>=1024?sorting.horizontal&&sorting.edges:sorting.vertical,'sorting layout at '+width);
    state.sorting=sorting;
    await evaluate("Promise.all([...document.querySelectorAll('.catalog-products img')].map(i=>{i.loading='eager';return i.decode()}))");
    const products=await evaluate(`(()=>{
      const grid=document.querySelector('.catalog-products');
      const cards=[...grid.querySelectorAll('.product-card')];
      const style=getComputedStyle(grid),bounds=grid.getBoundingClientRect();
      const rects=cards.map(x=>x.getBoundingClientRect());
      return {
        ids:cards.map(x=>x.querySelector('[name="productId"]').value),
        names:cards.map(x=>x.querySelector('.product-card__title').textContent),
        columns:style.gridTemplateColumns.split(' ').length,
        rows:new Set(rects.map(x=>Math.round(x.top))).size,
        equalWidths:rects.every(x=>Math.abs(x.width-rects[0].width)<1),
        within:rects.every(x=>x.left>=bounds.left&&x.right<=bounds.right+1),
        images:cards.every(x=>{const i=x.querySelector('img');return i&&i.naturalWidth>0&&getComputedStyle(i).objectFit==='contain'}),
        cardBorders:cards.every(x=>getComputedStyle(x).borderTopWidth==='1px'),
        noFrame:['Top','Right','Bottom','Left'].every(side=>style['border'+side+'Width']==='0px')&&style.outlineStyle==='none'&&style.boxShadow==='none',
        internalFit:cards.every(x=>[...x.querySelectorAll('img,.product-card__quantity,.product-card__add-button,.product-card__prices')].every(el=>{
          const r=el.getBoundingClientRect(),c=x.getBoundingClientRect();return r.left>=c.left&&r.right<=c.right+1;
        })),
        afterSorting:document.querySelector('.catalog-sorting').nextElementSibling===grid,
        overflow:document.documentElement.scrollWidth>innerWidth
      };
    })()`);
    assert.deepEqual(products.ids,productItems.map(x=>String(x.id)));
    assert.deepEqual(products.names,productItems.map(x=>x.name));
    assert.equal(products.columns,width>=1200?4:width>=992?3:width>=576?2:1);
    assert.equal(products.rows,Math.ceil(productItems.length/products.columns));
    for(const key of ['equalWidths','within','images','cardBorders','noFrame','internalFit','afterSorting'])assert(products[key],key+' at '+width);
    assert.equal(products.overflow,false);
    state.products=products;
    results.push({width,...state});
    await evaluate("document.querySelector('.page-heading').scrollIntoView()");
    const shot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile('artifacts/catalog-section/'+width+'.png',Buffer.from(shot.data,'base64'));
    await evaluate("document.querySelector('.catalog-sorting').scrollIntoView({block:'center'})");
    const sortingShot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile('artifacts/catalog-section/sorting-'+width+'.png',Buffer.from(sortingShot.data,'base64'));
    await evaluate("document.querySelector('.catalog-products').scrollIntoView({block:'start'})");
    const productsShot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile('artifacts/catalog-section/products-'+width+'.png',Buffer.from(productsShot.data,'base64'));
  }
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});
  await evaluate("document.querySelector('.catalog-subcategories__link').focus()");
  assert(await evaluate("document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).outlineWidth==='3px'"));
  await evaluate("document.querySelector('#sortSelected').focus()");
  assert(await evaluate("document.activeElement.id==='sortSelected'&&document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).outlineWidth==='3px'"));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert(await evaluate("document.activeElement.id==='sortCount'&&document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).outlineWidth==='3px'"));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert(await evaluate("getComputedStyle(document.querySelector('.catalog-subcategories__link')).transitionDuration.split(',').every(x=>parseFloat(x)<=0.00001)"));
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/catalog-section/results.json',JSON.stringify(results,null,2));
  console.log('Passed: categories, notices and sorting regression; first 32 products in JSON order, names/IDs, images, 4/3/2/1/1 columns at 1440/1024/768/390/320, 8 desktop rows, equal widths, no wrapper frame, preserved card borders, internal controls and page without overflow; focus and tab order; JS disabled.');
} finally {socket?.close();chrome.kill();}
