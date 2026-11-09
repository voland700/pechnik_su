import { readFile, writeFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const fixture = new URL('../src/pages/advantages-test.astro', import.meta.url);
const run = (...args) => {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', windowsHide: true });
  assert.equal(result.status, 0, args.join(' '));
};
let created = false;
try {
  await writeFile(fixture, await readFile(new URL('./fixtures/advantages.astro.txt', import.meta.url)), {flag: 'wx'});
  created = true;
  run('node_modules/astro/bin/astro.mjs', 'build');
  const html = await readFile('dist/advantages-test/index.html', 'utf8');
  const sections = html.match(/<section class="advantages"[\s\S]*?<\/section>/g);
  assert.deepEqual(sections.map(s => (s.match(/class="advantages__item"/g) ?? []).length), [1,2,3,4,5,6,7,8,8,8]);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  const source = await readFile('reference/advantages-exempl.html', 'utf8');
  const original = [...source.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(m => m[0]);
  const main = await readFile('dist/index.html', 'utf8');
  const section = main.match(/<section class="advantages"[\s\S]*?<\/section>/)[0];
  const rendered = [...section.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(m => m[0]);
  assert.equal(rendered.length, 8);
  const geometry = s => [...s.matchAll(/\b(?:d|points|viewBox|transform|cx|cy|r|rx|ry|x1|x2|y1|y2)="[^"]*"/g)].map(m => m[0].replace(/\s+/g, ' '));
  rendered.forEach((svg,i) => assert.deepEqual(geometry(svg), geometry(original[i])));
  const normalize = s => s.replace(/\s*<br\s*\/?\s*>/g, '. ').replace(/\s+/g, ' ').trim();
  const originalText = [...source.matchAll(/<h3>(.*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map(m => [normalize(m[1]), normalize(m[2])]);
  const renderedText = [...section.matchAll(/<h3[^>]*>(.*?)<\/h3>\s*<p[^>]*>(.*?)<\/p>/g)].map(m => [normalize(m[1]), normalize(m[2])]);
  assert.deepEqual(renderedText, originalText);
  assert(!/<a\b|<button\b|<script\b|&lt;br/.test(section));
  console.log('Passed: 0–8 items, cap at eight, defaults, unique IDs, original SVG geometry, content and order.');
} finally {
  if (created) {
    await unlink(fixture);
    run('node_modules/astro/bin/astro.mjs', 'build');
    run('scripts/finalize-css.mjs');
    run('scripts/verify-dist.mjs');
  }
}
