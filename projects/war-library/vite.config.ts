import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5188,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4188,
    strictPort: true,
  },
  base: './',
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    // One chunk: scripts/inline-single-file.mjs folds it into dist/war-library.html, and a
    // file:// page cannot fetch a second chunk (the ?room/?asset/?hud harnesses are dynamic
    // imports, which would otherwise split).
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
