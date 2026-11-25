import { defineConfig } from 'vite';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

// The props' meshes (12 MB) go out gzipped, a third of that: hosts do not compress application/octet-stream. props.js
// inflates a file that comes gzipped; the dev server and the tests read them as they are.
function gzipProps() {
  let dir;
  return {
    name: 'gzip-props', apply: 'build',
    configResolved: (c) => { dir = resolve(c.root, c.build.outDir, 'props'); },
    closeBundle() { for (const f of readdirSync(dir)) if (f.endsWith('.bin')) writeFileSync(resolve(dir, f), gzipSync(readFileSync(resolve(dir, f)), { level: 9 })); },
  };
}

// base './': the hub serves the build from /p/<slug>/ inside an iframe.
export default defineConfig({
  base: './',
  plugins: [gzipProps()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        sanctuary: resolve(import.meta.dirname, 'sanctuary.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/examples/')) return 'three-addons';
          if (id.includes('node_modules/three/build/three.core')) return 'three-core';
          if (id.includes('node_modules/three/build/')) return 'three-webgl';
          if (id.includes('/src/sanctuary/watercolor/')) return 'watercolor';
        },
      },
    },
  },
});
