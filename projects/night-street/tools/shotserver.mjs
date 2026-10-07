import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Frame grabber for the visual-critic loop.
 *
 * The brief's build instructions require a critic that "should only see the
 * rendered output, not the code", and that only works if getting the rendered
 * output is cheap. Driving a browser's own screenshot is not: a backgrounded or
 * offscreen pane does not composite, so the capture silently returns the last
 * frame that happened to be presented — which looks like a working screenshot
 * of a stale scene, and is the worst possible failure mode for a loop whose
 * whole job is to compare before and after.
 *
 * So the page renders, reads its own drawing buffer with toDataURL, and POSTs
 * it here. What lands on disk is exactly what the renderer produced, at a size
 * this script chose, with no compositor in the path.
 *
 *   node tools/shotserver.mjs [outDir] [port]
 *
 * Then, in the page console:
 *   await __shot('hero', { w: 1280, h: 720, pos: [-7.4, 1.68, -6] })
 */

const outDir = resolve(process.argv[2] ?? 'shots')
const port = Number(process.argv[3] ?? 7788)
mkdirSync(outDir, { recursive: true })

const server = createServer((req, res) => {
  // The page is served from a different port, so this is cross-origin.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.writeHead(200, { 'content-type': 'text/plain' }).end(`shotserver -> ${outDir}\n`)
    return
  }

  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    try {
      const { name, dataUrl } = JSON.parse(Buffer.concat(chunks).toString())
      const comma = dataUrl.indexOf(',')
      const ext = dataUrl.slice(11, dataUrl.indexOf(';')) === 'jpeg' ? 'jpg' : 'png'
      const safe = String(name).replace(/[^a-z0-9._-]/gi, '_')
      const file = resolve(outDir, `${safe}.${ext}`)
      writeFileSync(file, Buffer.from(dataUrl.slice(comma + 1), 'base64'))
      console.log(`${file}  ${(dataUrl.length / 1365).toFixed(0)} KB`)
      res.writeHead(200, { 'content-type': 'text/plain' }).end(file)
    } catch (err) {
      console.error('bad shot:', err.message)
      res.writeHead(400).end(String(err.message))
    }
  })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`shotserver on http://127.0.0.1:${port} -> ${outDir}`)
})
