import './styles.css'

// Isolation pages (DESIGN §11.4 G1): each worker's harness renders its module alone and sets
// window.__ready. The full game is the default route.
//   ?room            -> src/dev/roomHarness.ts   (Worker-C)
//   ?asset=<id>      -> src/dev/boardHarness.ts  (Worker-B; ids: board, rifle-br, rifle-de, mg, fieldgun, tank, stoss, ...)
//   ?hud             -> src/dev/hudHarness.ts    (Worker-D)
const q = new URLSearchParams(location.search)
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')
if (!canvas) throw new Error('Missing #game-canvas element.')

async function boot(c: HTMLCanvasElement): Promise<void> {
  if (q.has('room')) return (await import('./dev/roomHarness.ts')).run(c, q)
  if (q.has('asset')) return (await import('./dev/boardHarness.ts')).run(c, q)
  if (q.has('hud')) return (await import('./dev/hudHarness.ts')).run(c, q)
  const { Game } = await import('./game/Game.ts')
  const game = new Game(c)
  game.start()
  if (import.meta.hot) import.meta.hot.dispose(() => game.dispose())
}

boot(canvas).catch((e) => {
  console.error(e)
  document.body.insertAdjacentHTML('beforeend',
    `<pre style="position:fixed;inset:auto 0 0 0;color:#f88;background:#200;padding:8px;margin:0">${String(e?.stack ?? e)}</pre>`)
})
