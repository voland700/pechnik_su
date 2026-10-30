import type { HeroSlideData } from '../types/hero-slider';

export const sliderData: HeroSlideData[] = [
  {
    name: 'Печи и камины - в рассрочку',
    text: `<ul class="slider_info_ul">
      <li>Честная рассрочка – до 6 месяцев</li>
      <li>Без процентов и переплат</li>
      <li><span>Купи сейчас – плати потом!</span></li>
    </ul>`,
    link: '#', backgraund: 'assets/images/slider/bg_stovies.jpg',
    img: 'assets/images/slider/stovvies.png', imageWidth: 435, imageHeight: 400,
  },
  {
    name: 'Печи тандыры Амфора',
    text: `<div class="slider_info_txt"><p>Удиви друзей и близких незабываемым вкусом Восточной кухни!<br>
      <span>Невероятно вкусно и полезно!</span></p></div>`,
    link: '#', backgraund: 'assets/images/slider/BG_1280-500.jpg',
    img: 'assets/images/slider/tandyr.png', imageWidth: 430, imageHeight: 400,
  },
  {
    name: 'Уличные печи для пиццы Везувий',
    text: `<ul class="slider_info_ul">
      <li><span>От производителя</span> - гарантия лучшей цены</li>
      <li>Прочные и долговечные - <span>100%</span> чугун</li>
      <li>Невероятно вкусно и полезно!</li></ul>`,
    link: '', backgraund: 'assets/images/slider/bg_ochag-2.jpg',
    img: 'assets/images/slider/pumpkin_3.png', imageWidth: 400, imageHeight: 417,
  },
  {
    name: 'Чугунные печи для бани Атмосфера',
    text: `<ul class="slider_info_ul"><li>Мягкий, целебный пар</li>
      <li>Закрытая каменка и парогенератор</li><li>Гарантия лучшей цены</li>
      <li>Скидка на дымоход до - <span>10%</span></li>
      <li>140 кг камней <span>в подарок</span></li></ul>`,
    link: '', backgraund: 'assets/images/slider/bg_bania_3.jpg',
    img: 'assets/images/slider/atmosfera_2F.png', imageWidth: 435, imageHeight: 400,
  },
];
