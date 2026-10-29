import { mkdir, copyFile } from 'node:fs/promises';
const source = new URL('../node_modules/@fontsource/manrope/', import.meta.url);
const target = new URL('../src/assets/fonts/manrope/', import.meta.url);
await mkdir(target, { recursive: true });
for (const weight of [300, 400, 600, 700]) {
  for (const subset of ['latin', 'cyrillic']) {
    const name = `manrope-${subset}-${weight}-normal.woff2`;
    await copyFile(new URL(`files/${name}`, source), new URL(name, target));
  }
}
await copyFile(new URL('LICENSE', source), new URL('OFL.txt', target));
console.log('Local Manrope WOFF2 files and license prepared.');
