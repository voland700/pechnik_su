// Optional smoke check using installed Chrome and Node's native CDP/WebSocket.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const baseUrl = process.env.SHOWCASE_BASE_URL ?? 'http://127.0.0.1:4322';
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

  await send('Page.navigate', {url: baseUrl + '/hero-showcase/'});
  await pause(1200);
  await mkdir('artifacts/hero-showcase', {recursive:true});
  await evaluate(`void document.querySelector('[data-hero-slider]').swiper.autoplay.stop()`);
  const results=[];
  for (const width of [390,576,768,1024,1200,1440,1920]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
    await pause(200);
    for (let index=0;index<4;index++) {
      await evaluate(`void document.querySelector('[data-hero-slider]').swiper.slideToLoop(${index},0)`);
      await pause(80);
      const state=await evaluate(`(() => {
        const el=document.querySelector('[data-hero-slider]'), active=el.querySelector('.swiper-slide-active');
        const rect=e=>{const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,right:r.right};};
        const text=rect(active.querySelector('.hero-slider__text')), image=rect(active.querySelector('.hero-slider__image'));
        return {width:innerWidth,index:el.swiper.realIndex,overflow:document.documentElement.scrollWidth>innerWidth,
          images:[...document.querySelectorAll('.hero-showcase img')].every(i=>i.complete&&i.naturalWidth>0),
          overlap:innerWidth<768?text.b>image.y:text.right>image.x,
          slider:rect(el), banners:[...document.querySelectorAll('.hero-banner')].map(rect),
          count:document.querySelectorAll('.hero-banner').length,effect:el.swiper.params.effect,crossFade:el.swiper.params.fadeEffect.crossFade,
          speed:el.swiper.params.speed,inactive:[...el.swiper.slides].filter(s=>!s.classList.contains('swiper-slide-active')).every(s=>s.inert)};
      })()`);
      assert.equal(state.overflow,false);assert.equal(state.images,true);assert.equal(state.overlap,false);
      assert.equal(state.count,4);assert.equal(state.effect,'fade');assert.equal(state.crossFade,true);assert.equal(state.speed,1000);assert.equal(state.inactive,true);
      const [a,b,c,d]=state.banners;
      if(width>=1200){assert(a.x<state.slider.x&&c.x>state.slider.x);assert(Math.abs(a.h+b.h+20-state.slider.h)<2);assert(Math.abs(a.w-c.w)<1);}
      else {assert(a.y>=state.slider.b);if(width>=768){assert.equal(a.y,b.y);assert.equal(c.y,d.y);}else{assert(a.y<b.y&&b.y<c.y&&c.y<d.y);}}
      results.push(state);
    }
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    await writeFile(`artifacts/hero-showcase/${width}.png`,Buffer.from(shot.data,'base64'));
  }
  await evaluate(`void document.querySelector('[data-hero-slider]').swiper.slideToLoop(0,0)`); await pause(100);
  await evaluate(`document.querySelector('[data-hero-next]').click()`);await pause(1300);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.realIndex`),1);
  await evaluate(`document.querySelector('[data-hero-pagination] button:nth-child(3)').click()`);await pause(1300);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.realIndex`),2);
  await evaluate(`document.querySelector('[data-hero-next]').focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft'});await pause(1300);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.realIndex`),1);
  await evaluate(`document.activeElement.blur(); document.querySelector('[data-hero-toggle]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.autoplay.running`),true);
  await pause(7300);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.realIndex`),2);
  await evaluate(`document.querySelector('[data-hero-toggle]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.autoplay.running`),false);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await pause(150);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.params.speed`),0);
  assert.equal(await evaluate(`document.querySelector('[data-hero-slider]').swiper.params.parallax.enabled`),false);
  await send('Emulation.setEmulatedMedia',{features:[]});await pause(200);
  await evaluate(`void document.querySelector('[data-hero-slider]').swiper.slideNext()`);await pause(180);
  const layers=await evaluate(`Array.from(document.querySelector('.swiper-slide-active').querySelectorAll('[data-swiper-parallax], [data-swiper-parallax-opacity]')).map(e=>getComputedStyle(e).transform)`);
  assert(layers.some(t=>t!=='none'&&t!=='matrix(1, 0, 0, 1, 0, 0)'), JSON.stringify(layers));
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/hero-showcase/results.json',JSON.stringify(results,null,2));
  console.log('Passed: seven widths, four slides, layout, images, overflow, inert, fade, parallax, arrows, pagination, keyboard, autoplay, pause, reduced motion.');
} finally { socket?.close();chrome.kill(); }





