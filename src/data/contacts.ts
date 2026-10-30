export interface StoreContact {
  id: string;
  name: string;
  note?: string;
  address: string;
  departments: { label: string; phones: { label: string; href: string }[] }[];
  additional?: string;
}
export const contacts: StoreContact[] = [
  { id: 'yasenevo', name: 'Центр «Ясенево»', note: 'центральный склад',
    address: 'Москва, 38 км МКАД, вл. 4Б, стр. 1', departments: [
      { label: 'Литьё, кирпич, смеси', phones: [{ label: '8 (916) 881-83-99', href: 'tel:+79168818399' }] },
      { label: 'Печи, камины, дымоходы', phones: [
        { label: '8 (985) 308-83-16', href: 'tel:+79853088316' },
        { label: '8 (909) 992-84-62', href: 'tel:+79099928462' },
      ] },
    ] },
  { id: 'zaoksk', name: 'Центр «Заокск»', address: 'Тульская обл., Заокский район, д. Панькино',
    departments: [{ label: 'Печи, камины, дымоходы', phones: [{ label: '8 (961) 267-38-80', href: 'tel:+79612673880' }] }],
  },
];
