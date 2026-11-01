import type { ProductItem } from '../types/product';

const base: ProductItem = {
  id: 1001, name: 'ASTON 12 со стеклянной дверцей', img: 'assets/images/products/aston12s.jpg', url: '#',
  price: '51 900', old_price: '', new: 0, hit: 0, sale: 0, inStock: 1, discount: '', canBuy: true,
};
/** Synthetic UI states and prices; not a commercial offer. Images are repository assets. */
export const productsDemo: { label: string; product: ProductItem }[] = [
  { label: 'Обычный товар', product: { ...base } },
  { label: 'Скидка и старая цена', product: { ...base, id: 1002, price: '51 900', old_price: '54 900', discount: '−5%' } },
  { label: 'Новинка', product: { ...base, id: 1003, new: 1, img: 'assets/images/products/atmosfera_m_2_prev.jpg' } },
  { label: 'Хит', product: { ...base, id: 1004, hit: true, img: 'assets/images/products/everest_8.jpg' } },
  { label: 'Акция', product: { ...base, id: 1005, sale: 1 } },
  { label: 'Все лейблы и скидка', product: { ...base, id: 1006, new: true, hit: 1, sale: true, discount: '−15%', old_price: '59 900' } },
  { label: 'Без наличия, покупка разрешена', product: { ...base, id: 1007, inStock: false, canBuy: 1 } },
  { label: 'В наличии, покупка запрещена', product: { ...base, id: 1008, inStock: true, canBuy: false } },
  { label: 'Цена по запросу', product: { ...base, id: 1009, price: '', old_price: '54 900', canBuy: true } },
  { label: 'Длинное название', product: { ...base, id: 1010, name: 'Демонстрационный товар с очень длинным названием: печь для бани со стеклянной дверцей, выносным топочным тоннелем и дополнительными принадлежностями' } },
  { label: 'Без наличия, покупка запрещена', product: { ...base, id: 1011, inStock: 0, canBuy: 0 } },
  { label: 'Без цены и наличия', product: { ...base, id: 1012, price: '', inStock: 0, canBuy: 0 } },
];
