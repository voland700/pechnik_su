import Swiper from 'swiper';
import { A11y, Navigation } from 'swiper/modules';

const instances = new WeakMap<HTMLElement, Swiper>();

export function initBrandsSliders(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-brands-slider]').forEach(element => {
    if (instances.has(element)) return;
    const viewport = element.querySelector<HTMLElement>('[data-brands-viewport]');
    if (!viewport) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const swiper = new Swiper(viewport, {
      modules: [Navigation, A11y],
      slidesPerView: 2,
      spaceBetween: 16,
      speed: motion.matches ? 0 : 400,
      loop: false,
      watchOverflow: true,
      breakpoints: {
        768: { slidesPerView: 3, spaceBetween: 24 },
        992: { slidesPerView: 4, spaceBetween: 24 },
        1200: { slidesPerView: 5, spaceBetween: 32 },
      },
      navigation: {
        prevEl: element.querySelector<HTMLElement>('[data-brands-prev]'),
        nextEl: element.querySelector<HTMLElement>('[data-brands-next]'),
      },
      a11y: {
        prevSlideMessage: 'Предыдущие производители', nextSlideMessage: 'Следующие производители',
        firstSlideMessage: 'Первый производитель', lastSlideMessage: 'Последний производитель',
        slideLabelMessage: '{{index}} из {{slidesLength}}',
        scrollOnFocus: true,
      },
    });
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      if (event.key === 'ArrowLeft') swiper.slidePrev(); else swiper.slideNext();
    };
    const updateMotion = () => { swiper.params.speed = motion.matches ? 0 : 400; };
    element.addEventListener('keydown', keydown);
    motion.addEventListener('change', updateMotion);
    instances.set(element, swiper);
    element.classList.add('brands-slider--ready');
    swiper.on('destroy', () => {
      element.removeEventListener('keydown', keydown);
      motion.removeEventListener('change', updateMotion);
      element.classList.remove('brands-slider--ready');
      instances.delete(element);
    });
  });
}
