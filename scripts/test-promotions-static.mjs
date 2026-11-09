import { readFile, writeFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const fixture = new URL('../src/pages/promotions-test.astro', import.meta.url);
const run = (...args) => {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', windowsHide: true });
  assert.equal(result.status, 0, args.join(' '));
};
let created = false;
try {
  await writeFile(fixture, await readFile(new URL('./fixtures/promotions.astro.txt', import.meta.url)), {flag:'wx'});
  created = true;
  run('node_modules/astro/bin/astro.mjs', 'build');
  const html = await readFile(new URL('../dist/promotions-test/index.html', import.meta.url), 'utf8');
  const sections = html.match(/<section class="promotions-showcase"[\s\S]*?<\/section>/g);
  assert.deepEqual(sections.map(s => (s.match(/class="promotion-card promotion-card__link"/g) ?? []).length), [1,4,2,1]);
  assert(!html.includes('>Empty</h2>'));
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  if (process.argv.includes('--browser')) run('scripts/test-promotions-browser.mjs');
  console.log('Passed: real Astro rendering, empty/single/many/custom limits, frozen input, unique IDs.');
} finally {
  if (created) {
    await unlink(fixture);
    run('node_modules/astro/bin/astro.mjs', 'build');
    run('scripts/finalize-css.mjs');
    run('scripts/verify-dist.mjs');
  }
}
