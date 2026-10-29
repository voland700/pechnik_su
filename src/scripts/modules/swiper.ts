import Swiper from 'swiper';
import { A11y, Navigation, Parallax } from 'swiper/modules';
const instances = new WeakMap<HTMLElement, Swiper>();
export function initSliders(root: ParentNode = document) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll<HTMLElement>('[data-demo-slider]').forEach((element) => {
    if (instances.has(element)) return;
    const instance = new Swiper(element, {
      modules: [Navigation, Parallax, A11y],
      parallax: !reducedMotion,
      speed: reducedMotion ? 0 : 600,
      navigation: {
        prevEl: element.querySelector<HTMLElement>('[data-slider-prev]'),
        nextEl: element.querySelector<HTMLElement>('[data-slider-next]'),
      },
      a11y: {
        prevSlideMessage: 'Предыдущий слайд', nextSlideMessage: 'Следующий слайд',
        firstSlideMessage: 'Первый слайд', lastSlideMessage: 'Последний слайд',
        slideLabelMessage: '{{index}} из {{slidesLength}}',
      },
    });
    instances.set(element, instance);
  });
}
