import products from '../../assets/products.json';
import type { ProductItem } from '../types/product';
import type { CatalogSubcategory } from '../types/catalog-section';
import type { DetailProduct } from './product-detail';

export const relatedBlocks: Record<string, 'products' | 'categories'> = {
  product_1: 'products',
  product_2: 'products',
  product_3: 'categories',
  product_4: 'products',
  product_5: 'categories',
};

export const relatedCategories: CatalogSubcategory[] = [
  { name: 'Дверцы герметичные', img: 'assets/images/categories/dvertsy-germetichnye.jpg', url: '#' },
  { name: 'Дверцы топочные', img: 'assets/images/categories/dvertsy-topochnye.jpg', url: '#' },
  { name: 'Духовки', img: 'assets/images/categories/duhovki.jpg', url: '#' },
  { name: 'Каминное литьё', img: 'assets/images/categories/kaminnoe-lite.jpg', url: '#' },
];

const normalizedName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');

/** Stable build-time selection; detail data has no shared catalogue product ID. */
export function selectRelatedProducts(current: DetailProduct): ProductItem[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>([normalizedName(current.title)]);
  return products.filter(product => {
    const id = String(product.id);
    const name = normalizedName(product.name);
    if (seenIds.has(id) || seenNames.has(name)) return false;
    seenIds.add(id);
    seenNames.add(name);
    return true;
  }).slice(0, 4) as ProductItem[];
}
