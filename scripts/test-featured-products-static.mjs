import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// A temporary build route exercises the real Astro component and ProductCard.
const fixture = new URL('../src/pages/featured-products-test.astro', import.meta.url);
const build = () => {
  const result = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], { stdio: 'inherit', windowsHide: true });
  assert.equal(result.status, 0, 'Astro build');
};
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
let created = false;
try {
  await writeFile(fixture, `---
import FeaturedProductsTabs from '../components/home/featured-products/FeaturedProductsTabs.astro';
import data from '../../assets/tabsData.json';
import type { FeaturedCategory } from '../types/featured-products';
const categories = data as FeaturedCategory[];
const many = [{ category: 'Many', products: [...categories[0].products, ...categories[1].products] }];
---
<FeaturedProductsTabs title="Empty" categories={[]} />
<FeaturedProductsTabs title="Single" categories={[{category:'Empty category',products:[]}]} initialTab={99} />
<FeaturedProductsTabs title="Limit" categories={many} maxProducts={99} />
<FeaturedProductsTabs title="Custom limit" categories={many} maxProducts={3} />
<FeaturedProductsTabs title="Initial" categories={categories} initialTab={4} />
`, { flag: 'wx' });
  created = true;
  build();
  const html = await read('../dist/featured-products-test/index.html');
  const sections = html.match(/<section\b[\s\S]*?<\/section>/g);
  assert.equal(sections.length, 4, 'Empty categories omit the section');
  const counts = sections.map(section => (section.match(/data-product-card/g) ?? []).length);
  assert.deepEqual(counts, [0, 10, 3, 68]);
  assert(sections[0].includes('В этой категории пока нет товаров'));
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'Unique IDs across instances');
  for (const [i, section] of sections.entries()) {
    const panels = section.match(/<div[^>]*data-featured-panel[^>]*>/g);
    assert.equal(panels.filter(panel => !/\shidden(?:\s|[=>])/.test(panel)).length, 1);
    const buttons = section.match(/<button[^>]*data-featured-tab[^>]*>/g);
    const selected = buttons.findIndex(button => button.includes('aria-selected="true"'));
    assert.equal(selected, i === 3 ? 4 : 0);
    assert(buttons[selected].includes('tabindex="0"'));
    assert(panels[selected].includes('behold'));
  }
  const home = await read('../dist/index.html');
  const data = JSON.parse(await read('../assets/tabsData.json'));
  assert.equal(data.length, 8);
  assert.deepEqual(data.map(c => c.products.length), [10,10,10,10,6,6,8,8]);
  let position = home.indexOf('data-featured-tabs');
  for (const category of data) {
    const next = home.indexOf(`>${category.category}</button>`, position);
    assert(next > position, 'Original category order');
    position = next;
  }
  assert(home.includes('5 3000 руб.'));
  console.log('Passed: real Astro rendering, empty/single categories, invalid/valid initialTab, limits, 68 products, order, unique IDs, initial ARIA/hidden/behold, unchanged price.');
} finally {
  if (created) {
    await unlink(fixture);
    // Restore production output without the test route, including CSS finalization.
    build();
    for (const script of ['scripts/finalize-css.mjs', 'scripts/verify-dist.mjs']) {
      const result = spawnSync(process.execPath, [script], { stdio: 'inherit', windowsHide: true });
      assert.equal(result.status, 0, script);
    }
  }
}
