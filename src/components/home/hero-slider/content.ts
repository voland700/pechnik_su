import { safeUrl } from '../../../utils/url';
export { safeUrl } from '../../../utils/url';

const assets = import.meta.glob<string>('../../../../assets/images/slider/*', {
  eager: true, query: '?url', import: 'default',
});

export function imageUrl(value?: string) {
  if (!value) return undefined;
  return assets[`../../../../${value}`] ?? safeUrl(value);
}

export const defaultHeroOverlay = 'linear-gradient(90deg, rgba(0, 35, 50, .92), rgba(0, 35, 50, .65) 55%, rgba(0, 35, 50, .6))';
export function safeOverlay(value?: string) {
  // Deliberately narrow grammar: no URLs, variables, declarations or CSS functions beyond colors/gradients.
  if (!value) return undefined;
  if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) return value;
  if (/^(?:linear|radial)-gradient\([\da-f#.,%\s()+-]*(?:(?:rgba?|hsla?|deg|to|left|right|top|bottom|circle|ellipse|at)[\da-f#.,%\s()+-]*)*\)$/i.test(value)) return value;
  return undefined;
}

/** Defense in depth for controlled fixtures. CMS must still use a server HTML sanitizer. */
export function descriptionHtml(value = '') {
  const tags = new Set(['p', 'ul', 'li', 'br', 'span', 'strong', 'em']);
  return value.split(/(<[^>]*>)/g).map(part => {
    if (part.startsWith('<')) {
      const match = /^<\s*(\/?)\s*([a-z]+)\b[^>]*>$/i.exec(part);
      return match && tags.has(match[2].toLowerCase()) ? `<${match[1]}${match[2].toLowerCase()}>` : '';
    }
    return part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }).join('');
}
