// Pointer -> hex. A press that moves less than a few pixels is a click; a right-drag yaws the
// camera; the wheel steps the zoom. Emits ui:hover / ui:click / ui:cmd on the bus, which is the
// same door the keyboard (ui/Keys.ts) uses, so the Game has exactly one input grammar.
import * as THREE from 'three'
import type { Bus } from '../contract/bus.ts'
import type { BoardView } from '../contract/render-api.ts'
import type { HexId } from '../contract/types.ts'

const CLICK_PX = 6

export class Picking {
  private readonly canvas: HTMLCanvasElement
  private readonly board: BoardView
  private readonly camera: THREE.Camera
  private readonly bus: Bus
  private readonly ndc = new THREE.Vector2()
  private down: { x: number; y: number; button: number; id: number } | null = null
  private lastHover: HexId | null = null
  private readonly offs: (() => void)[] = []

  constructor(canvas: HTMLCanvasElement, board: BoardView, camera: THREE.Camera, bus: Bus) {
    this.canvas = canvas
    this.board = board
    this.camera = camera
    this.bus = bus
    const on = <K extends keyof HTMLElementEventMap>(k: K, f: (e: HTMLElementEventMap[K]) => void) => {
      canvas.addEventListener(k, f as EventListener)
      this.offs.push(() => canvas.removeEventListener(k, f as EventListener))
    }
    on('pointermove', (e) => this.move(e))
    on('pointerdown', (e) => this.press(e))
    on('pointerup', (e) => this.release(e))
    on('pointercancel', () => { this.down = null })
    on('pointerleave', () => this.hover(null))
    on('contextmenu', (e) => e.preventDefault())
    on('wheel', (e) => {
      e.preventDefault()
      this.bus.emit('ui:cmd', { cmd: e.deltaY > 0 ? 'zoom-out' : 'zoom-in' })
    })
  }

  hexAtClient(x: number, y: number): HexId | null {
    const r = this.canvas.getBoundingClientRect()
    this.ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
    return this.board.hexAt(this.ndc, this.camera)
  }

  dispose(): void { for (const f of this.offs) f() }

  private hover(h: HexId | null): void {
    if (h === this.lastHover) return
    this.lastHover = h
    this.bus.emit('ui:hover', { hex: h })
  }

  private move(e: PointerEvent): void {
    if (this.down && this.down.button === 2) {
      this.bus.emit('ui:cmd', { cmd: e.movementX > 0 ? 'yaw-r' : 'yaw-l', arg: String(Math.abs(e.movementX) * 0.25) })
      return
    }
    this.hover(this.hexAtClient(e.clientX, e.clientY))
  }

  private press(e: PointerEvent): void {
    this.down = { x: e.clientX, y: e.clientY, button: e.button, id: e.pointerId }
  }

  private release(e: PointerEvent): void {
    const d = this.down
    this.down = null
    if (!d || d.id !== e.pointerId) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > CLICK_PX) return
    const hex = this.hexAtClient(e.clientX, e.clientY)
    this.bus.emit('ui:click', { hex, button: d.button === 2 ? 2 : 0 })
  }
}
