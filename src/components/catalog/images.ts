import type { ImageMetadata } from 'astro';
import { safeUrl } from '../../utils/url';

const images = import.meta.glob<ImageMetadata>('../../../assets/images/products/*.{jpg,jpeg,png,webp,avif}', {
  eager: true, import: 'default',
});
const publicImages = import.meta.glob('/public/**/*', { eager: true, query: '?url', import: 'default' });

export function productImage(path: string) {
  const local = images[`../../../${path}`];
  if (local) return local;
  const url = safeUrl(path);
  if (url && /^https?:\/\//i.test(url)) return { src: url, width: 400, height: 400 };
  const relative = url?.replace(/^\//, '');
  if (relative && publicImages[`/public/${relative}`]) {
    return { src: `${import.meta.env.BASE_URL}${relative}`, width: 400, height: 400 };
  }
  console.warn(`[ProductCard] Missing or unsafe image: ${path}`);
  return undefined;
}
