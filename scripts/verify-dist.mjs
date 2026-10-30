import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const entries = (await readdir(root, { recursive: true })).map((p) => p.replaceAll('\\', '/'));
const files = entries.filter((p) => /\.(html|css|js|mjs)$/.test(p));
const htmlFiles = files.filter((p) => p.endsWith('.html'));
assert(htmlFiles.length > 0, 'No static HTML');
assert(entries.includes('css/style.css'));
assert(entries.includes('css/style.min.css'));
assert(entries.includes('js/main.js'));
assert.equal(entries.filter((p) => p.endsWith('.css')).length, 2, 'Unexpected CSS splitting');
assert(entries.some((p) => /pechnik-icons.*\.woff2$/.test(p)), 'No WOFF2 icon font');
assert(entries.some((p) => /pechnik-icons.*\.woff$/.test(p)), 'No WOFF fallback');
assert(entries.some((p) => /manrope-cyrillic-300.*\.woff2$/.test(p)), 'No local text font');
const css = await readFile(resolve(root, 'css/style.css'), 'utf8');
assert(css.includes('.p-icon-search') && css.includes('.p-icon-cart') && css.includes('.p-icon-arrow'));
let checked = 0;
// Only these intentionally unimplemented CMS page routes may lack local HTML.
const plannedRoutes = new Set(['/about/', '/articles/', '/installation/', '/works/', '/delivery/', '/contacts/', '/offers/', '/catalog/', '/cart/', '/personal/', '/login/', '/search/']);
for (const entry of files) {
  const path = resolve(root, entry);
  const text = await readFile(path, 'utf8');
  if (entry.endsWith('.html')) {
    assert(!text.includes('/@vite/client') && !text.includes('astro-island'), 'Runtime/dev artifact in HTML');
    assert(!/\.scss["']/.test(text), 'Unprocessed SCSS reference');
    assert(text.includes('style.min.css'), 'HTML must load minified CSS');
  }
  const refs = entry.endsWith('.html')
    ? [...text.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((m) => m[1])
    : entry.endsWith('.css')
      ? [...text.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)].map((m) => m[1])
      : [...text.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (entry.endsWith('.html') && plannedRoutes.has(ref)) continue;
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(ref)) continue;
    const clean = decodeURIComponent(ref.split(/[?#]/)[0]);
    if (!clean) continue;
    let target = clean.startsWith('/') ? resolve(root, `.${clean}`) : resolve(dirname(path), clean);
    assert(!relative(root, target).startsWith('..'), `Outside dist: ${ref}`);
    if (clean.endsWith('/')) target = resolve(target, 'index.html');
    await access(target).catch(() => { throw new Error(`Missing resource: ${entry} → ${ref}`); });
    checked++;
  }
}
console.log(`Verified ${htmlFiles.length} HTML page(s), two CSS variants, icon fonts, local resources; ${checked} references checked.`);
