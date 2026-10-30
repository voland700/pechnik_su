import { readFile, writeFile, readdir } from 'node:fs/promises';
import postcss from 'postcss';
import cssnano from 'cssnano';
const dist = new URL('../dist/', import.meta.url);
const cssUrl = new URL('css/style.css', dist);
const css = await readFile(cssUrl, 'utf8');
const result = await postcss([cssnano({ preset: 'default' })]).process(css, { from: cssUrl.pathname, map: false });
await writeFile(new URL('css/style.min.css', dist), result.css);
for (const entry of await readdir(dist, { recursive: true })) {
  if (!entry.endsWith('.html')) continue;
  const url = new URL(entry.replaceAll('\\', '/'), dist);
  const html = await readFile(url, 'utf8');
  await writeFile(url, html.replaceAll('/css/style.css', '/css/style.min.css'));
}
console.log(`CSS: ${Buffer.byteLength(css)} → ${Buffer.byteLength(result.css)} bytes`);
