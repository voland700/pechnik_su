const menu = (id: string, title: string, titles: string[]) => ({
  id, title, links: titles.map(title => ({ title, href: '#' })),
});

export const footerMenus = [
  menu('company', 'Компания', ['О печном центре', 'Контакты', 'Акции и скидки', 'Новинки', 'Монтаж', 'Статьи', 'Наши работы']),
  menu('catalog', 'Каталог', ['Печи для бани и сауны', 'Отопительные печи', 'Печи-камины', 'Камины и топки', 'Грили, мангалы и барбекю', 'Отопительные котлы', 'Чугунное литьё для печей', 'Дымоходы', 'Чугунная посуда', 'Аксессуары для каминов', 'Аксессуары для бани', 'Материалы для монтажа']),
  menu('help', 'Помощь', ['Доставка и самовывоз', 'Способы оплаты', 'Рассрочка и кредит', 'Политика компании', 'Личный кабинет']),
];

export const socialButtons = [
  { label: 'ВКонтакте', link: 'https://vk.com/pechnik_su', icon: 'vk' },
  { label: 'Telegram', link: 'https://t.me/+79168818399', icon: 'tg' },
  { label: 'YouTube', link: 'https://www.youtube.com/channel/UCniPelN3Qmt6-xj87QM3cyw', icon: 'youtube' },
  { label: 'Авито', link: 'https://www.avito.ru/brands/i307088117/all?sellerId=a7e6daa484a89e40c397cfabc37c0e38', icon: 'avito' },
  { label: 'MAX', link: 'https://max.ru/u/f9LHodD0cOIeM_EqA-2SyfeXQ6GDwhWzLVcjvlfEsHF31_NDcyKdPGoNcZA', icon: 'max' },
];

export const footerContacts: { text: string; icon: string; href?: string }[] = [
  { text: '8 (916) 881-83-99', href: 'tel:+79168818399', icon: 'mobile-screen' },
  { text: 'Пн-Вс: 09:00 - 18:00 Без выходных', icon: 'time' },
  { text: 'info@pechnik.su', href: 'mailto:info@pechnik.su', icon: 'envelope-open' },
  { text: 'Москва, 38 км. МКАД, вл. 4Б стр. 1', icon: 'location-dot' },
];

// Viewports in the supplied horizontal SVG strip (there are no symbol IDs).
export const paymentIcons = [
  { label: 'Наличные', x: 0, width: 21 },
  { label: 'Mastercard', x: 41, width: 30 },
  { label: 'Visa', x: 88, width: 34 },
  { label: 'Яндекс Деньги', x: 142, width: 18 },
  { label: 'WebMoney', x: 181, width: 21 },
  { label: 'QIWI', x: 222, width: 21 },
  { label: 'Сбербанк', x: 263, width: 22 },
  { label: 'Альфа-Банк', x: 304, width: 16 },
  { label: 'Мир', x: 340, width: 36 },
  { label: 'ЮMoney', x: 393, width: 27 },
  { label: 'ЮKassa', x: 438, width: 27 },
  { label: 'Тинькофф', x: 483, width: 59 },
];
