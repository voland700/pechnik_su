import type { ImageMetadata } from 'astro';
import { safeUrl } from '../../../utils/url';

const images = import.meta.glob<ImageMetadata>('../../../../assets/images/catalog/*.{jpg,jpeg,png,webp,avif,svg}', {
  eager: true, import: 'default',
});

export function categoryImage(path: string) {
  const local = images[`../../../../${path}`];
  if (local) return { src: local.src, width: local.width, height: local.height };
  const src = safeUrl(path);
  if (path.startsWith('assets/images/catalog/')) {
    console.warn(`[CategoryShowcase] Missing local image: ${path}`);
    return undefined;
  }
  return src ? { src, width: undefined, height: undefined } : undefined;
}
