import { readFileSync } from 'node:fs';
import source from '../../assets/products_data.json';
export type DetailProduct = (typeof source)[number];
export const detailProducts = source;
const files = import.meta.glob<string>('../../assets/images/**/*.{jpg,jpeg,png,webp,svg}', { eager: true, query: '?url', import: 'default' });
import placeholder from '../assets/product-placeholder.svg?url';
export function detailImage(path?: string): string { return path ? files[`../../${path}`] ?? placeholder : placeholder; }
export const information = [
  ['2 магазина', 'shops'], ['Доставка', 'delivery'], ['Оплата', 'baying'],
  ['Как купить', 'payment'], ['Возврат', 'return'], ['Монтаж', 'install'],
].map(([title, file]) => {
  let html: string;
  try { html = readFileSync(new URL(`../../assets/${file}.html`, import.meta.url), 'utf8'); }
  catch { html = `<h2>${title}</h2><p>Информация пока не предоставлена. Уточните подробности у менеджера Печного Центра.</p>`; }
  return { title, file, html };
});
export function documentType(href: string) {
  const extension = new URL(href, 'https://www.pechnik.su').pathname.split('.').pop()?.toLowerCase();
  return ({ pdf:'pdf', doc:'word', docx:'word', jpg:'image-jpg', jpeg:'image-jpg', png:'image-png', ppt:'presentation', pptx:'presentation', rtf:'text', txt:'text', tif:'tiff', tiff:'tiff', xls:'excel', xlsx:'excel' } as Record<string,string>)[extension ?? ''] ?? 'unknown';
}
export function detailHtml(html: string): string {
  return html.replace(/(src|href)=(['"])(\/(?:upload|doc)\/[^'"]+)\2/g, '$1=$2https://www.pechnik.su$3$2');
}
