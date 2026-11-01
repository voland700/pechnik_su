export interface ProductItem {
  id: number | string;
  name: string;
  img: string;
  url?: string;
  price: string;
  old_price: string;
  new: boolean | 0 | 1;
  hit: boolean | 0 | 1;
  sale: boolean | 0 | 1;
  inStock: boolean | 0 | 1;
  discount: string;
  canBuy: boolean | 0 | 1;
}

/** Runtime boundary: strings, including "1", are deliberately not flags. */
export const normalizeFlag = (value: unknown): boolean => value === true || value === 1;
export const productText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
export const PRODUCT_QUANTITY_MAX = 999;
