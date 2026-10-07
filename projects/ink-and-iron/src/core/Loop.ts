// One requestAnimationFrame loop: update(dt, t) then render(). dt is clamped so a background tab
// returning does not fast-forward the table.
export class Loop {
  private frameId = 0
  private lastTime = 0
  private running = false
  private readonly update: (dt: number, t: number) => void
  private readonly render: () => void

  constructor(update: (dt: number, t: number) => void, render: () => void) {
    this.update = update
    this.render = render
  }

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
    const dt = Math.min((time - this.lastTime) / 1000, 0.05)
    this.lastTime = time
    this.update(dt, time / 1000)
    this.render()
    this.frameId = requestAnimationFrame(this.tick)
  }
}
