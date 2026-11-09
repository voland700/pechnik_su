import type { ImageMetadata } from 'astro';
import { safeUrl } from '../../../utils/url';

const images = import.meta.glob<ImageMetadata>('../../../../assets/images/articles/*.{jpg,jpeg,png,webp,avif,svg}', {
  eager: true, import: 'default',
});

export function articleImage(path: string) {
  const local = images[`../../../../${path}`];
  if (local) return { src: local.src, width: local.width, height: local.height };
  if (path.startsWith('assets/images/articles/')) {
    console.warn(`[ArticlesList] Missing local image: ${path}`);
    return undefined;
  }
  const src = safeUrl(path);
  return src ? { src, width: undefined, height: undefined } : undefined;
}
