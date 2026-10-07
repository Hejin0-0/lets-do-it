// Folds dist/index.html and the assets it references into ONE self-contained HTML file that
// opens from file:// in Chrome. A module script loaded by URL from file:// is blocked (origin
// "null"); the same script inlined is not. Run after `vite build`.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dist = join(import.meta.dirname, '..', 'dist')
let html = readFileSync(join(dist, 'index.html'), 'utf8')

html = html.replace(/<link rel="stylesheet"[^>]*href="\.?\/?([^"]+\.css)"[^>]*>/g, (_, href) =>
  `<style>${readFileSync(join(dist, href), 'utf8')}</style>`)
html = html.replace(/<script type="module"[^>]*src="\.?\/?([^"]+\.js)"[^>]*><\/script>/g, (_, src) =>
  // '</script' inside the bundle would close the tag early.
  `<script type="module">${readFileSync(join(dist, src), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`)
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '')

if (/src="\.?\/?assets\//.test(html) || /href="\.?\/?assets\//.test(html)) {
  throw new Error('inline-single-file: an asset reference survived inlining')
}
const out = join(dist, 'war-library.html')
writeFileSync(out, html)
console.log(`inline-single-file: ${out} (${(html.length / 1024).toFixed(0)} KB)`)
