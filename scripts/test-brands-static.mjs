import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const fixture = new URL('../src/pages/brands-test.astro', import.meta.url);
const run = (...args) => {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', windowsHide: true });
  assert.equal(result.status, 0, args.join(' '));
};
let created = false;
try {
  const data = await readFile('src/data/brands.ts', 'utf8');
  const files = await readdir('assets/images/brands');
  const paths = [...data.matchAll(/img: 'assets\/images\/brands\/([^']+)'/g)].map(m => m[1]);
  assert.equal(paths.length, 17);
  paths.forEach(path => assert(files.includes(path), `Missing file or incorrect case: ${path}`));
  await writeFile(fixture, await readFile('scripts/fixtures/brands.astro.txt'), {flag: 'wx'});
  created = true;
  run('node_modules/astro/bin/astro.mjs', 'build');
  run('scripts/finalize-css.mjs');
  run('scripts/verify-dist.mjs');
  const html = await readFile('dist/brands-test/index.html', 'utf8');
  const sections = html.match(/<section class="brands-slider"[\s\S]*?<\/section>/g);
  assert.deepEqual(sections.map(s => (s.match(/class="brands-slider__link"/g) ?? []).length), [1,3,17]);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  if (process.argv.includes('--browser')) run('scripts/test-brands-browser.mjs', '--fixtures');
  console.log('Passed: exact file case, 17 sources, empty/single/multiple instances, unique IDs.');
} finally {
  if (created) {
    await unlink(fixture);
    run('node_modules/astro/bin/astro.mjs', 'build');
    run('scripts/finalize-css.mjs');
    run('scripts/verify-dist.mjs');
  }
}
