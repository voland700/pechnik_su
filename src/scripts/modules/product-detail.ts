import Swiper from 'swiper';
import { Navigation, A11y } from 'swiper/modules';
import { Fancybox } from '@fancyapps/ui/dist/fancybox/';
import { initProductCards } from './product-card';
const initialized = new WeakSet<HTMLElement>();
export function initProductDetails() {
  initProductCards();
  for (const detail of document.querySelectorAll<HTMLElement>('[data-product-detail]')) {
    if (initialized.has(detail)) continue;
    initialized.add(detail);
    const gallery = detail.querySelector<HTMLElement>('[data-product-gallery]');
    if (gallery) {
      const images: string[] = JSON.parse(gallery.dataset.images ?? '[]');
      const main = gallery.querySelector<HTMLImageElement>('[data-gallery-image]');
      const open = gallery.querySelector<HTMLAnchorElement>('[data-gallery-open]');
      const thumbs = gallery.querySelector<HTMLElement>('[data-gallery-thumbs]');
      let active = 0;
      if (thumbs) new Swiper(thumbs, {
        modules: [Navigation, A11y], slidesPerView: 3, spaceBetween: 8, watchOverflow: true,
        breakpoints: { 414: { slidesPerView: 4 }, 1200: { slidesPerView: 5 } },
        navigation: { prevEl: gallery.querySelector<HTMLElement>('[data-gallery-prev]'), nextEl: gallery.querySelector<HTMLElement>('[data-gallery-next]') },
        a11y: { prevSlideMessage:'Предыдущие фотографии', nextSlideMessage:'Следующие фотографии', slideLabelMessage:'{{index}} из {{slidesLength}}' },
      });
      gallery.addEventListener('click', event => {
        const thumb = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-gallery-index]') : null;
        if (!thumb || !main || !open) return;
        active = Number(thumb.dataset.galleryIndex);
        main.src = images[active];
        open.href = images[active];
        gallery.querySelectorAll<HTMLElement>('[data-gallery-index]').forEach(el => el.setAttribute('aria-pressed', String(el === thumb)));
      });
      open?.addEventListener('click', event => {
        event.preventDefault();
        Fancybox.show(images.map((src,index) => ({src, type:'image', caption:`Фото ${index+1} из ${images.length}`})), { startIndex:active });
      });
    }
    detail.querySelectorAll<HTMLTableElement>('.product-detail__content table').forEach(table => {
      const wrapper = document.createElement('div');
      wrapper.className = 'product-detail__table'; wrapper.tabIndex = 0;
      wrapper.setAttribute('role','region'); wrapper.setAttribute('aria-label','Таблица: горизонтальная прокрутка');
      table.before(wrapper); wrapper.append(table);
    });
    detail.querySelectorAll<HTMLIFrameElement>('iframe').forEach(frame => {
      if (!frame.title) frame.title = frame.src.includes('catalog.arguv') ? 'Интерактивный 3D-обзор товара' : 'Видеообзор товара';
      frame.loading = 'lazy';
      if (frame.src.includes('catalog.arguv')) frame.classList.add('product-detail__3d');
    });
    detail.addEventListener('click', event => {
      const button = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-product-information]') : null;
      if (!button) return;
      const template = detail.querySelector<HTMLTemplateElement>(`template[data-product-information-content="${button.dataset.productInformation}"]`);
      if (template) Fancybox.show([{html:template.innerHTML}], {
        closeButton: true,
        mainClass: 'product-information-modal',
        l10n: { CLOSE: 'Закрыть окно' },
      });
    });
  }
}

