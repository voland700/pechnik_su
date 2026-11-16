import yasenevo from '../../assets/images/contact/stove_center_Y_W500.jpg';
import zaoksk from '../../assets/images/contact/stove_cente_Z.jpg';
import type { Store } from '../types/store';

export const stores: Store[] = [
  {
    id: 'yasenevo',
    name: 'Печной Центр Ясенево - Центральный склад',
    image: yasenevo,
    url: '#',
    address: '117574 г. Москва, дорога МКАД 38 км, владение 4Б, стр.1',
    workingHours: 'с 9.00 до 18.00 (без выходных)',
    contacts: [
      { department: 'Печной кирпич, литьё, смеси', phone: '8 (916) 881-83-99', phoneHref: 'tel:+79168818399' },
      { department: 'Печи-камины JOTUL, топки, дымоходы', phone: '8 (985) 308-83-16', phoneHref: 'tel:+79853088316' },
    ],
  },
  {
    id: 'zaoksk',
    name: 'Печной Центр Заокск',
    image: zaoksk,
    url: '#',
    address: 'Тульская область, Заокский район, д. Панькино, (Симферопольское шоссе, 112 км. – 10 минут от Серпухова)',
    workingHours: 'с 9.00 до 18.00 (без выходных)',
    contacts: [{ phone: '8 (961) 267-38-80', phoneHref: 'tel:+79612673880' }],
  },
];
