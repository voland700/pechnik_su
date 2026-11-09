// Only explicitly marked demo links: real CMS URLs keep native navigation.
document.addEventListener('click', (event) => {
  const link = event.target instanceof Element ? event.target.closest('a[data-demo-link]') : null;
  if (link?.getAttribute('href') === '#') event.preventDefault();
});

async function initialize() {
  const tasks: Promise<unknown>[] = [];
  if (document.querySelector('[data-brands-slider]')) {
    tasks.push(import('./modules/brands-slider').then(({ initBrandsSliders }) => initBrandsSliders()));
  }
  if (document.querySelector('[data-featured-tabs]')) {
    tasks.push(import('./modules/featured-products-tabs').then(({ initFeaturedProductsTabs }) => initFeaturedProductsTabs()));
  }
  if (document.querySelector('[data-product-card]')) {
    tasks.push(import('./modules/product-card').then(({ initProductCards }) => initProductCards()));
  }
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
