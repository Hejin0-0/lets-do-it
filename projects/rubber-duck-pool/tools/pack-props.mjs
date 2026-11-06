// Run after each asset build (npm run assets:props, assets:map, assets:lookdev), on the files load() in props.js reads.
// 1. load() spreads the tables base, sampling, chair, cooler, lookdev and a later one wins, so a model in props.bin or
//    sampling.bin that a later table also carries would be downloaded and never drawn: drop it.
// 2. Write sampling.bin and lookdev.bin at 20 bytes a vertex (decodeProps in props.js): position float32 x3, normal snorm8
//    x3, kind, colour as sRGB bytes x3, a pad, as build_props.py writes props.bin. Half the download; the chair's and the
//    cooler's files stay as their exporters wrote them.
// Every other byte is copied as it is, so running it twice changes nothing.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url)), props = (f) => join(root, 'public/props', f)
const order = [['prop-shapes.js', 'props.bin'], ['sampling-shapes.js', 'sampling.bin', true], ['chair-shapes.js'], ['cooler-shapes.js'], ['lookdev-shapes.js', 'lookdev.bin', true]]
const tables = await Promise.all(order.map(async ([js, bin, pack]) => ({ js, bin, pack, S: Object.values(await import(pathToFileURL(join(root, 'src/pool', js))))[0] })))
const strideOf = (t, raw) => { const s = (raw.length - t.S.indices * 4) / t.S.vertices; if (s !== 20 && s !== 40) throw new Error(`${t.bin} does not match ${t.js}`); return s }
const srgb = (c) => Math.max(0, Math.min(255, Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255)))
const snorm = (c) => Math.max(-127, Math.min(127, Math.round(c * 127)))

function writeTable(t, S) {
  const jsPath = join(root, 'src/pool', t.js), src = readFileSync(jsPath, 'utf8')
  if (t.bin === 'props.bin') {   // build_props.py's layout: a line a model
    const line = /^ {4}(\w+): \{ vertex: \d+, vertices: (\d+), index: \d+,/
    writeFileSync(jsPath, src.split('\n').filter((l) => { const k = l.match(line)?.[1]; return !k || S.models[k] })
      .map((l) => l.replace(line, (_, k, n) => `    ${k}: { vertex: ${S.models[k].vertex}, vertices: ${n}, index: ${S.models[k].index},`))
      .map((l) => l.replace(/^ {2}vertices: \d+, indices: \d+,$/, `  vertices: ${S.vertices}, indices: ${S.indices},`)).join('\n'))
  } else writeFileSync(jsPath, src.slice(0, src.indexOf('=', src.indexOf('export const')) + 2) + JSON.stringify(S, null, 2) + ';\n')
}

for (const [i, t] of tables.entries()) {
  if (!t.bin) continue
  let raw = readFileSync(props(t.bin)), stride = strideOf(t, raw), S = t.S
  const drop = new Set(Object.keys(S.models).filter((k) => tables.slice(i + 1).some((l) => l.S.models[k]))), notes = []
  if (drop.size) {
    const V = raw.subarray(0, S.vertices * stride), I = raw.subarray(S.vertices * stride), models = {}, vs = [], is = []
    let vertices = 0, indices = 0
    for (const [k, m] of Object.entries(S.models)) {
      if (drop.has(k)) continue
      vs.push(V.subarray(m.vertex * stride, (m.vertex + m.vertices) * stride)); is.push(I.subarray(m.index * 4, (m.index + m.indices) * 4))
      models[k] = { ...m, vertex: vertices, index: indices }; vertices += m.vertices; indices += m.indices
    }
    raw = Buffer.concat([...vs, ...is]); S = { ...S, vertices, indices, models }
    notes.push(`dropped ${[...drop].join(' ')} (drawn from a later table)`)
  }
  if (t.pack && stride === 40) {
    const f = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + S.vertices * 40)), out = Buffer.alloc(S.vertices * 20)
    for (let q = 0; q < S.vertices; q++) {
      const v = f.subarray(q * 10, q * 10 + 10), o = q * 20
      for (let k = 0; k < 3; k++) { out.writeFloatLE(v[k], o + 4 * k); out.writeInt8(snorm(v[3 + k]), o + 12 + k); out.writeUInt8(srgb(v[6 + k]), o + 16 + k) }
      out.writeUInt8(v[9], o + 15)
    }
    raw = Buffer.concat([out, raw.subarray(S.vertices * 40)]); stride = 20
    notes.push('packed to 20 bytes a vertex')
  }
  if (!notes.length) continue
  const before = readFileSync(props(t.bin)).length
  writeFileSync(props(t.bin), raw)
  if (drop.size) writeTable(t, S)
  if (t.bin === 'sampling.bin') {
    const manifest = props('sampling-manifest.json'), m = JSON.parse(readFileSync(manifest, 'utf8'))
    writeFileSync(manifest, JSON.stringify({ ...m, vertex_stride: stride, models: S.models, sources: m.sources.filter((s) => !drop.has(s.model)) }, null, 2) + '\n')
  }
  console.log(`${t.bin}: ${notes.join(', ')}; ${before} -> ${raw.length} bytes`)
}
