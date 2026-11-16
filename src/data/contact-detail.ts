import type { ImageMetadata } from 'astro';
import scheme from '../../assets/images/contact/map_new_3.jpg';
import yandex from '../../assets/images/contact/PC_yandex_map.jpg';
import google from '../../assets/images/contact/PC_google.jpg';
import qr from '../../assets/images/contact/QR-pcy.png';
import location from '../../assets/images/icons/location-dot.svg?url';
import email from '../../assets/images/icons/envelope-open.svg?url';
import time from '../../assets/images/icons/time.svg?url';
import navigation from '../../assets/images/icons/location-arrow.svg?url';

const photos = import.meta.glob<{ default: ImageMetadata }>('../../assets/images/contact/*.jpg', { eager: true });
const photo = (name: string) => photos[`../../assets/images/contact/${name}.jpg`].default;
const captions = [
  'Здание магазина и выставочного зала', 'Выставочный зал печей и каминов',
  'Экспозиция отопительных печей', 'Печи и камины в торговом зале',
  'Ассортимент печей-каминов', 'Чугунные печи в экспозиции',
  'Печи и аксессуары Morso', 'Склад печей и оборудования',
  'Печной кирпич и строительные материалы', 'Печное литьё в магазине',
  'Кирпич на территории склада', 'Склад строительных материалов',
];

export const contactDetail = {
  title: 'Печной Центр Ясенево — Центральный склад',
  scheme,
  icons: { location, email, time, navigation },
  address: 'г. Москва, 38 км МКАД, внутренняя сторона. Ориентир: садовый центр «ЯСЕНЕВО», 1-й въезд.',
  emails: ['info@pechnik.su', 'c9150368017@yandex.ru'],
  hours: 'Время работы: с 9:00 до 18:00 (без выходных).',
  coordinates: '55.59578106433156, 37.51456298864375',
  departments: [
    { description: 'Материалы для печей: печной кирпич, литьё, смеси, банные и отопительные печи.', phone: '8 (916) 881-83-99', href: 'tel:+79168818399' },
    { description: 'Каминная галерея: печи-камины JOTUL, MORSO, топки, дымоходы Schiedel.', phone: '8 (985) 308-83-16', href: 'tel:+79853088316' },
  ],
  mapLinks: [
    { title: 'На Яндекс Картах', image: yandex, href: 'https://yandex.ru/maps/-/CCU8N0S~GD', alt: 'Расположение Печного Центра Ясенево на Яндекс Картах' },
    { title: 'На Google Картах', image: google, href: 'https://goo.gl/maps/yUFxNMFBpT2hUAze6', alt: 'Расположение Печного Центра Ясенево на Google Maps' },
  ],
  qr,
  gallery: captions.map((alt, index) => ({ img: photo(`image_${index + 1}`), preview: photo(`preview_${index + 1}`), alt })),
};
