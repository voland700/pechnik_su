import Swiper from 'swiper';
import { A11y, Autoplay, EffectFade, Navigation, Pagination, Parallax } from 'swiper/modules';

const instances = new WeakMap<HTMLElement, Swiper>();

export function initHeroSliders(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-hero-slider]').forEach(element => {
    if (instances.has(element)) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const multiple = element.querySelectorAll('.hero-slider__slide').length > 1;
    const toggle = element.querySelector<HTMLButtonElement>('[data-hero-toggle]');
    let wantsAutoplay = element.dataset.autoplay === 'true' && multiple;
    let hovered = false;
    const sync = () => {
      const running = wantsAutoplay && !motion.matches && !hovered && !element.contains(document.activeElement) && !document.hidden;
      if (running) { if (!swiper.autoplay.running) swiper.autoplay.start(); }
      else swiper.autoplay.stop();
      if (toggle) {
        toggle.hidden = motion.matches;
        toggle.textContent = wantsAutoplay ? 'Пауза' : 'Продолжить';
        toggle.setAttribute('aria-label', wantsAutoplay ? 'Остановить автопереключение' : 'Возобновить автопереключение');
      }
      element.querySelector('.swiper-wrapper')?.setAttribute('aria-live', running ? 'off' : 'polite');
    };
    const stop = () => { wantsAutoplay = false; sync(); };
    const focusSlides = (swiper: Swiper) => {
      swiper.slides.forEach(slide => { slide.inert = !slide.classList.contains('swiper-slide-active'); });
    };
    const swiper = new Swiper(element, {
      modules: [A11y, Navigation, Pagination, Parallax, Autoplay, EffectFade],
      effect: 'fade',
      fadeEffect: { crossFade: true },
      speed: motion.matches ? 0 : 700,
      loop: multiple && element.dataset.loop === 'true',
      watchOverflow: true,
      parallax: !motion.matches,
      autoplay: { enabled: false, delay: Number(element.dataset.delay) || 6000, disableOnInteraction: true },
      navigation: {
        prevEl: element.querySelector<HTMLElement>('[data-hero-prev]'),
        nextEl: element.querySelector<HTMLElement>('[data-hero-next]'),
      },
      pagination: {
        el: element.querySelector<HTMLElement>('[data-hero-pagination]'), clickable: true,
        bulletElement: 'button',
        renderBullet: (index, className) => `<button type="button" class="${className}" aria-label="Перейти к слайду ${index + 1}"></button>`,
      },
      a11y: {
        prevSlideMessage: 'Предыдущий слайд', nextSlideMessage: 'Следующий слайд',
        firstSlideMessage: 'Первый слайд', lastSlideMessage: 'Последний слайд',
        slideLabelMessage: '{{index}} из {{slidesLength}}', paginationBulletMessage: 'Перейти к слайду {{index}}',
      },
      on: { init: focusSlides, slideChangeTransitionEnd: focusSlides, sliderFirstMove: stop },
    });
    instances.set(element, swiper);
    const updateMotion = () => {
      swiper.params.speed = motion.matches ? 0 : 700;
      if (typeof swiper.params.parallax === 'object') swiper.params.parallax.enabled = !motion.matches;
      element.querySelectorAll<HTMLElement>('[data-swiper-parallax], [data-swiper-parallax-opacity]').forEach(layer => {
        layer.style.removeProperty('transform'); layer.style.removeProperty('opacity'); layer.style.removeProperty('transition-duration');
      });
      swiper.update(); sync();
    };
    motion.addEventListener('change', updateMotion);
    element.addEventListener('mouseenter', () => { hovered = true; sync(); });
    element.addEventListener('mouseleave', () => { hovered = false; sync(); });
    element.addEventListener('focusin', sync);
    element.addEventListener('focusout', () => queueMicrotask(sync));
    document.addEventListener('visibilitychange', sync);
    element.addEventListener('click', event => {
      const target = event.target as Element;
      if (target.closest('a[href="#"]')) event.preventDefault();
      if (target.closest('[data-hero-toggle]')) { wantsAutoplay = !wantsAutoplay; sync(); }
      else if (target.closest('a, button')) stop();
    });
    // Keyboard handling stays local to this carousel; it cannot move other Swipers.
    element.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault(); stop();
      if (event.key === 'ArrowLeft') swiper.slidePrev(); else swiper.slideNext();
    });
    sync();
  });
}
