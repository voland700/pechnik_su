import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const fixture = new URL('../src/pages/articles-test.astro', import.meta.url);
const run = (...args) => {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', windowsHide: true });
  assert.equal(result.status, 0, args.join(' '));
};
let created = false;
try {
  const data = await readFile('src/data/articles.ts', 'utf8');
  const files = await readdir('assets/images/articles');
  const records = [...data.matchAll(/name: '([^']*)',\s*img: '([^']*)',\s*text: '([^']*)',/g)];
  assert.equal(records.length, 10);
  records.forEach(m => assert(files.includes(m[2].split('/').at(-1)), `Incorrect file case: ${m[2]}`));
  await writeFile(fixture, await readFile('scripts/fixtures/articles.astro.txt'), {flag: 'wx'});
  created = true;
  run('node_modules/astro/bin/astro.mjs', 'build');
  run('scripts/finalize-css.mjs');
  run('scripts/verify-dist.mjs');
  const html = await readFile('dist/articles-test/index.html', 'utf8');
  const sections = html.match(/<section class="articles-list"[\s\S]*?<\/section>/g);
  assert.deepEqual(sections.map(s => (s.match(/<article /g) ?? []).length), [1,2,3,4,5,6,7,8,9,10,10,1]);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  const main = (await readFile('dist/index.html', 'utf8')).match(/<section class="articles-list"[\s\S]*?<\/section>/)[0];
  const titles = [...main.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map(m => m[1]);
  const texts = [...main.matchAll(/<p[^>]*>(.*?)<\/p>/g)].map(m => m[1]);
  const normalize = s => s.replace(/&nbsp;/g, '\u00a0').replace(/\s+/g, ' ').trim();
  assert.deepEqual(titles.map(normalize), records.map(m => normalize(m[1])));
  assert.deepEqual(texts.map(normalize), records.map(m => normalize(m[3])));
  assert.equal((main.match(/href="#"/g) ?? []).length, 10);
  assert.equal((main.match(/<img /g) ?? []).length, 10);
  if (process.argv.includes('--browser')) run('scripts/test-articles-browser.mjs', '--fixtures');
  console.log('Passed: exact image case, count 0–10, cap, unique IDs, original data/order in generated HTML.');
} finally {
  if (created) {
    await unlink(fixture);
    run('node_modules/astro/bin/astro.mjs', 'build');
    run('scripts/finalize-css.mjs');
    run('scripts/verify-dist.mjs');
  }
}
