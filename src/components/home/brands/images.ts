import type { ImageMetadata } from 'astro';
import { safeUrl } from '../../../utils/url';

const images = import.meta.glob<ImageMetadata>('../../../../assets/images/brands/*.{jpg,jpeg,png,webp,avif,svg}', {
  eager: true, import: 'default',
});

export function brandImage(path: string) {
  const local = images[`../../../../${path}`];
  if (local) return { src: local.src, width: local.width, height: local.height };
  if (path.startsWith('assets/images/brands/')) {
    console.warn(`[BrandsSlider] Missing local image: ${path}`);
    return undefined;
  }
  const src = safeUrl(path);
  return src ? { src, width: undefined, height: undefined } : undefined;
}
