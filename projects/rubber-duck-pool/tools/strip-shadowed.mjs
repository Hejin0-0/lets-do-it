// Run after each asset build (npm run assets:props, assets:map, assets:lookdev): props.js's load() spreads the tables
// base, sampling, chair, cooler, lookdev and a later one wins, so a model in props.bin or sampling.bin that a later table
// also carries is downloaded and never drawn. This drops those, copying every other model's bytes as they are.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const order = [['prop-shapes.js', 'props.bin', 20], ['sampling-shapes.js', 'sampling.bin', 40], ['chair-shapes.js'], ['cooler-shapes.js'], ['lookdev-shapes.js']]
const tables = await Promise.all(order.map(async ([js, bin, stride]) => ({ js, bin, stride, S: Object.values(await import(pathToFileURL(join(root, 'src/pool', js))))[0] })))

for (const [i, t] of tables.slice(0, 2).entries()) {
  const drop = new Set(Object.keys(t.S.models).filter((k) => tables.slice(i + 1).some((l) => l.S.models[k])))
  if (!drop.size) continue
  const raw = readFileSync(join(root, 'public/props', t.bin)), { S, stride } = t
  if (raw.length !== S.vertices * stride + S.indices * 4) throw new Error(`${t.bin} does not match ${t.js}`)
  const V = raw.subarray(0, S.vertices * stride), I = raw.subarray(S.vertices * stride), models = {}, vs = [], is = []
  let vertices = 0, indices = 0
  for (const [k, m] of Object.entries(S.models)) {
    if (drop.has(k)) continue
    vs.push(V.subarray(m.vertex * stride, (m.vertex + m.vertices) * stride)); is.push(I.subarray(m.index * 4, (m.index + m.indices) * 4))
    models[k] = { ...m, vertex: vertices, index: indices }; vertices += m.vertices; indices += m.indices
  }
  const out = Buffer.concat([...vs, ...is]), jsPath = join(root, 'src/pool', t.js), src = readFileSync(jsPath, 'utf8')
  writeFileSync(join(root, 'public/props', t.bin), out)
  if (t.bin === 'sampling.bin') {
    writeFileSync(jsPath, src.slice(0, src.indexOf('export const')) + 'export const SAMPLING_SHAPES = ' + JSON.stringify({ ...S, vertices, indices, models }, null, 2) + ';\n')
    const manifest = join(root, 'public/props/sampling-manifest.json'), m = JSON.parse(readFileSync(manifest, 'utf8'))
    writeFileSync(manifest, JSON.stringify({ ...m, models, sources: m.sources.filter((s) => !drop.has(s.model)) }, null, 2) + '\n')
  } else {   // build_props.py's layout: a line a model
    const line = /^ {4}(\w+): \{ vertex: \d+, vertices: (\d+), index: \d+,/
    writeFileSync(jsPath, src.split('\n').filter((l) => !drop.has(l.match(line)?.[1]))
      .map((l) => l.replace(line, (_, k, n) => `    ${k}: { vertex: ${models[k].vertex}, vertices: ${n}, index: ${models[k].index},`))
      .map((l) => l.replace(/^ {2}vertices: \d+, indices: \d+,$/, `  vertices: ${vertices}, indices: ${indices},`)).join('\n'))
  }
  console.log(`${t.bin}: dropped ${[...drop].join(' ')} (drawn from a later table), ${raw.length} -> ${out.length} bytes`)
}
