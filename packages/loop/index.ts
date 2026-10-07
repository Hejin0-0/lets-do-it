// The Game Loop / Update Method pattern for a browser game: one requestAnimationFrame loop calls
// update(dt, t) then render(). dt is in seconds, never negative, and clamped (maxDt) so a tab
// that returns from the background does not fast-forward the world. stop() is what a hub's
// unmount() calls.
export class Loop {
  private frameId = 0
  private lastTime = 0
  private running = false
  private readonly update: (dt: number, t: number) => void
  private readonly render: () => void
  private readonly maxDt: number

  constructor(update: (dt: number, t: number) => void, render: () => void, maxDt = 0.05) {
    this.update = update
    this.render = render
    this.maxDt = maxDt
  }

  get isRunning(): boolean { return this.running }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.frameId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.frameId)
  }

  private readonly tick = (time: number): void => {
    if (!this.running) return
    // max(0): Chrome may stamp the first frame after start() a little before the
    // performance.now() that start() read.
    const dt = Math.max(0, Math.min((time - this.lastTime) / 1000, this.maxDt))
    this.lastTime = time
    this.update(dt, time / 1000)
    this.render()
    this.frameId = requestAnimationFrame(this.tick)
  }
}
