import { defineConfig } from 'astro/config';
import webfont from 'vite-svg-2-webfont';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  output: 'static',
  build: { inlineStylesheets: 'never' },
  vite: {
    plugins: [webfont({
      context: fileURLToPath(new URL('./src/assets/icons/font', import.meta.url)),
      fontName: 'pechnik-icons',
      types: ['woff2', 'woff'],
      baseSelector: '.p-icon',
      classPrefix: 'p-icon-',
      codepoints: { search: 0xe001, cart: 0xe002, arrow: 0xe003 },
      ligature: false,
      generateFiles: false,
    })],
    css: { preprocessorOptions: { scss: { quietDeps: true } } },
    build: {
      cssCodeSplit: false,
      cssMinify: false,
      assetsInlineLimit: 0,
      rollupOptions: { output: {
        assetFileNames: (asset) => asset.names?.some((name) => name.endsWith('.css'))
          ? 'assets/css/style.css' : 'assets/[name]-[hash][extname]',
      } },
    },
  },
});
