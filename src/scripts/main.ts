async function initialize() {
  const tasks: Promise<unknown>[] = [];
  if (document.querySelector('[data-hero-slider]')) {
    tasks.push(import('./modules/hero-slider').then(({ initHeroSliders }) => initHeroSliders()));
  }
  if (document.querySelector('[data-header]')) {
    tasks.push(import('./modules/header').then(({ initHeader }) => initHeader()));
  }
  if (document.querySelector('[data-fancybox]')) {
    tasks.push(import('./modules/fancybox').then(({ initFancybox }) => initFancybox()));
  }
  if (document.querySelector('[data-demo-slider]')) {
    tasks.push(import('./modules/swiper').then(({ initSliders }) => initSliders()));
  }
  if (document.querySelector('[data-demo-alert]')) {
    tasks.push(import('./modules/alerts').then(({ initAlerts }) => initAlerts()));
  }
  for (const result of await Promise.allSettled(tasks)) {
    if (result.status === 'rejected') console.error('Component initialization failed', result.reason);
  }
}
void initialize();
