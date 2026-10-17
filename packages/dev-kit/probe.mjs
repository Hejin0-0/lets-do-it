// probe.mjs — run index.html in real Chrome, report console errors + runtime stats + a screenshot.
// Zero dependencies: drives Chrome over CDP using Node 22's global WebSocket.
//
// usage: node tools/probe.mjs [--wait 6000] [--shot out.png] [--url file://...] [--eval "expr"]
//        [--w 1600] [--h 900] [--mobile] [--headful] [--webgpu] [--serve dist --path '#11']
// --serve serves a built folder (a project's dist/) on a free local port for this run only, and --path is
// appended to its address. --webgpu turns WebGPU on (the Mac's GPU, headless). --mobile is a 390x844 phone.
// Exit code 1 when the page logs an error or throws, or the --eval script throws.

import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync, existsSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, extname } from 'node:path'

const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i === -1 ? d : argv[i + 1] }
const flag = (k) => argv.includes('--' + k)

const WAIT = +arg('wait', 6000)
const MOBILE = flag('mobile')
const W = +arg('w', MOBILE ? 390 : 1600)
const H = +arg('h', MOBILE ? 844 : 900)
const SHOT = arg('shot', 'screenshots/probe.png')
const EVAL = arg('eval', 'JSON.stringify(window.__PROBE ? window.__PROBE() : null)')
const SERVE = arg('serve', null)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.wasm': 'application/wasm' }
const server = SERVE && createServer((q, r) => {
  let p = join(resolve(SERVE), decodeURIComponent(q.url.split(/[?#]/)[0]))
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html')
  if (!p.startsWith(resolve(SERVE)) || !existsSync(p)) { r.writeHead(q.url === '/favicon.ico' ? 204 : 404); r.end(); return }   // (a missing favicon is the browser's ask, not the page's error)
  r.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p))
})
if (server) await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const URL_ = server ? `http://127.0.0.1:${server.address().port}/${arg('path', '')}` : arg('url', 'file://' + resolve('index.html'))

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
].find(existsSync)
if (!CHROME) { console.error('no Chrome found'); process.exit(2) }

const profile = mkdtempSync(join(tmpdir(), 'probe-'))
const chrome = spawn(CHROME, [
  flag('headful') ? '--no-first-run' : '--headless=new',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--allow-file-access-from-files',
  '--enable-unsafe-swiftshader',        // permit software WebGL when there is no GPU
  '--use-angle=default',
  '--hide-scrollbars', '--mute-audio',
  ...(flag('webgpu') ? ['--enable-unsafe-webgpu', '--enable-gpu'] : []),
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] })

const wsUrl = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('timed out waiting for DevTools port')), 20000)
  let buf = ''
  chrome.stderr.on('data', (d) => {
    buf += d
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/)
    if (m) { clearTimeout(t); res(m[1]) }
  })
  chrome.on('exit', (c) => { clearTimeout(t); rej(new Error('chrome exited early, code ' + c)) })
})

// --- minimal CDP client -------------------------------------------------
const ws = new WebSocket(wsUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0
const pending = new Map()
const events = []
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id); pending.delete(msg.id)
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result)
  } else if (msg.method) events.push(msg)
}
const send = (method, params = {}, sessionId) =>
  new Promise((res, rej) => {
    const id = ++seq
    pending.set(id, { res, rej })
    ws.send(JSON.stringify({ id, method, params, sessionId }))
  })

// attach to a page target
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const S = (m, p) => send(m, p, sessionId)

const logs = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.sessionId !== sessionId) return
  if (m.method === 'Runtime.consoleAPICalled') {
    logs.push({ kind: m.params.type, text: m.params.args.map(a => a.value ?? a.description ?? a.type).join(' ') })
  } else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails
    logs.push({ kind: 'exception', text: (d.exception?.description || d.text) + (d.url ? ` @${d.url}:${d.lineNumber}` : '') })
  } else if (m.method === 'Log.entryAdded') {
    logs.push({ kind: m.params.entry.level, text: m.params.entry.text + (m.params.entry.url ? ` <${m.params.entry.url}>` : '') })
  }
})

await S('Runtime.enable'); await S('Log.enable'); await S('Page.enable')
await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: MOBILE ? 2 : 1, mobile: MOBILE })
if (MOBILE) await S('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

const t0 = Date.now()
await S('Page.navigate', { url: URL_ })
await new Promise(r => setTimeout(r, WAIT))

let stats = null, evalErr = null
try {
  const r = await S('Runtime.evaluate', { expression: EVAL, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) evalErr = r.exceptionDetails.exception?.description || r.exceptionDetails.text
  else stats = r.result.value
} catch (e) { evalErr = String(e) }

try {
  const { data } = await S('Page.captureScreenshot', { format: 'png' })
  writeFileSync(SHOT, Buffer.from(data, 'base64'))
} catch (e) { logs.push({ kind: 'error', text: 'screenshot failed: ' + e.message }) }

// --- report -------------------------------------------------------------
const bad = logs.filter(l => l.kind === 'exception' || l.kind === 'error')
const warns = logs.filter(l => l.kind === 'warning')
console.log(`--- probe ${URL_}`)
console.log(`elapsed ${Date.now() - t0}ms  waited ${WAIT}ms  viewport ${W}x${H}  shot ${SHOT}`)
console.log(`\nERRORS (${bad.length}):`)
for (const l of bad.slice(0, 40)) console.log('  ✖ ' + l.text.split('\n').slice(0, 6).join('\n    '))
console.log(`\nWARNINGS (${warns.length}):`)
for (const l of warns.slice(0, 15)) console.log('  ! ' + l.text.slice(0, 300))
const notes = logs.filter(l => l.kind === 'log' || l.kind === 'info')
if (notes.length) { console.log(`\nLOG (${notes.length}):`); for (const l of notes.slice(0, 25)) console.log('  · ' + l.text.slice(0, 300)) }
console.log('\nPROBE STATS:'); console.log(typeof stats === 'string' ? stats : JSON.stringify(stats))
if (evalErr) console.log('probe eval error: ' + evalErr)

ws.close(); chrome.kill('SIGKILL'); server?.close()
process.exit(bad.length || evalErr ? 1 : 0)
