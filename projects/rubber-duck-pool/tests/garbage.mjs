// Bytes a function leaves for the collector per call: the heap after a full collection, then after n calls with
// no collection between. Keep n times the bytes well under 8 MB, or a young-generation collection mid-run hides it.
import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'
setFlagsFromString('--expose_gc')
const gc = runInNewContext('gc')
export function garbage(fn, n = 20) {
  fn(); fn(); gc()
  const before = process.memoryUsage().heapUsed
  for (let i = 0; i < n; i++) fn()
  return (process.memoryUsage().heapUsed - before) / n
}
