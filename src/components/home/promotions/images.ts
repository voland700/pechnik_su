import type { ImageMetadata } from 'astro';
import { safeUrl } from '../../../utils/url';

const images = import.meta.glob<ImageMetadata>('../../../../assets/images/stocks/*.{jpg,jpeg,png,webp,avif,svg}', {
  eager: true, import: 'default',
});

export function promotionImage(path: string) {
  const local = images[`../../../../${path}`];
  if (local) return { src: local.src, width: local.width, height: local.height };
  if (path.startsWith('assets/images/stocks/')) {
    console.warn(`[PromotionsShowcase] Missing local image: ${path}`);
    return undefined;
  }
  const src = safeUrl(path);
  if (!src) console.warn(`[PromotionsShowcase] Missing or invalid image: ${path}`);
  return src ? { src, width: undefined, height: undefined } : undefined;
}
