import { Color, MeshBasicMaterial } from 'three'
import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import type { Post } from '../gfx/post'
import { CORRIDOR, START_Z, WALK_END_Z } from '../world/placement'

/**
 * Contact sheet.
 *
 * Three hero shots chosen to flatter tell you nothing about repetition, and
 * repetition is the complaint this is meant to answer. A grid of frames taken at
 * fixed intervals down the block, viewed together, shows immediately whether the
 * street reads as one place or as the same twenty metres four times — which is
 * what "the assets are monotonous" actually means and what no single screenshot
 * can settle.
 *
 * It also gives the next blind-critic pass something representative to judge.
 *
 *   npm run dev  ->  http://localhost:5173/?sweep
 *   node tools/shotserver.mjs shots     (in another terminal)
 */

const COLS = 4
const ROWS = 6
const CELL_W = 480

/**
 * How much of a frame has nothing to look at.
 *
 * This replaces a colour-histogram "flatness" measure that turned out to be
 * measuring the opposite of what the criterion meant. Binning colours scores a
 * smooth gradient across a blank wall as *varied* — the gradient spreads over
 * dozens of bins — while a large expanse of even night sky concentrates into one
 * bin and scores as flat. Checked against the sheet, the emptiest frames in it
 * were scoring best and the busiest worst. A metric that is anti-correlated with
 * the thing it is named after is worse than no metric, because it launders a
 * judgement call into a number.
 *
 * What "nothing to look at" actually means is an absence of *edges*: brickwork
 * with a downpipe, a window and a string course across it has local contrast
 * everywhere, and a wall lit by a soft wash has none. So the frame is cut into
 * tiles, each tile is scored by how many of its pixels sit on a luminance
 * gradient, and the result is the share of tiles with essentially no structure.
 */
const TILES_X = 8
const TILES_Y = 6
/** Luminance step, 0..255, that counts as an edge. */
const EDGE = 7
/** A tile with fewer than this share of edge pixels is blank. */
const BLANK_BELOW = 0.06

/**
 * `sky` marks which sampled pixels were sky, so they can be left out.
 *
 * They have to be left out. The first version of this counted them, and the sky
 * alone is a third of a frame looking down a street — smooth, dark, and utterly
 * unfixable by anything done to a building. A whole pass of facade work (ghost
 * signs, second downpipes, hoppers, crossing conduit, stronger normals, bricked
 * up openings) moved the number by 0.001, which is not a verdict on the work,
 * it is a verdict on the measurement. Twice now this metric has been measuring
 * a region the criterion was never about.
 */
/**
 * Blank, split into the part that is actionable and the part that is not.
 *
 * The criterion this feeds has now been re-derived three times, and the reason
 * it kept going stale is that a single number cannot tell "there is nothing on
 * this wall" from "it is night and that wall is thirty metres from a lamp". The
 * first is a defect. The second is the scene being correct, and every attempt to
 * drive it down has meant putting light where the street does not have any.
 *
 * So the tiles are now split by how *lit* they are. A tile with no structure and
 * almost no light in it is dark, and dark is the answer; a tile with no
 * structure that is sitting in a lamp's pool is empty, and empty is a bug. Only
 * the second is worth chasing, and unlike the blended figure it does not move
 * when the grade does — which is the property the old target never had.
 */
interface Blank {
  /** Share of scored tiles with no local structure. The old number. */
  share: number
  /** Of those, the share that are also well enough lit to have shown some. */
  litShare: number
}

function blankShare(
  px: Uint8Array,
  sky: Uint8Array,
  W: number,
  H: number,
  map?: string[],
): Blank {
  const lum = (i: number) => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
  const tileW = Math.floor(W / TILES_X)
  const tileH = Math.floor(H / TILES_Y)
  let blank = 0
  let litBlank = 0
  let scored = 0

  for (let ty = 0; ty < TILES_Y; ty++) {
    let row = ''
    for (let tx = 0; tx < TILES_X; tx++) {
      let edges = 0
      let seen = 0
      let skyPx = 0
      let total = 0
      let light = 0
      const x0 = tx * tileW
      const y0 = ty * tileH
      for (let y = y0 + 2; y < y0 + tileH - 2; y += 2) {
        for (let x = x0 + 2; x < x0 + tileW - 2; x += 2) {
          const i = (y * W + x) * 4
          total++
          if (sky[i] > 128) {
            skyPx++
            continue
          }
          // Central differences two pixels out — far enough to survive the
          // film grain, close enough to catch a mortar line.
          const gx = Math.abs(lum(i + 8) - lum(i - 8))
          const gy = Math.abs(lum(i + W * 8) - lum(i - W * 8))
          if (gx + gy > EDGE) edges++
          light += lum(i)
          seen++
        }
      }
      // A tile that is mostly sky is not a wall with nothing on it.
      if (total > 0 && skyPx / total > 0.7) {
        if (map) row += '~'
        continue
      }
      scored++
      const isBlank = seen > 0 && edges / seen < BLANK_BELOW
      const mean = seen > 0 ? light / seen : 0
      // 34/255. Below this a surface is being carried by ambient alone and has
      // no light to reveal anything with; above it, a lamp or a window is
      // reaching the tile and there is no excuse for it being featureless.
      const lit = mean > 34
      if (isBlank) {
        blank++
        if (lit) litBlank++
      }
      // '#' blank and dark — night. 'X' blank and lit — a defect.
      if (map) row += isBlank ? (lit ? 'X' : '#') : '.'
    }
    if (map) map.push(row)
  }
  return {
    share: scored ? blank / scored : 0,
    litShare: scored ? litBlank / scored : 0,
  }
}

export interface SweepResult {
  file: string
  /** Share of each frame that has no local structure in it, 0..1. */
  blank: number[]
  /**
   * Per-frame share of tiles that are blank *and* lit well enough to have shown
   * something. This is the actionable half, and the one to drive down.
   */
  litBlank: number[]
  meanLitBlank: number
  /**
   * Tile map of the worst frame. '.' has structure, '#' blank and dark (night),
   * 'X' blank and lit (a defect), '~' sky.
   */
  worstMap: string[]
  worstFrame: number
  worstBlank: number
  /** Frames over the 40% budget — the ones with a dead wall filling them. */
  overBudget: number[]
  meanBlank: number
}

export async function runSweep(deps: {
  renderer: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera
  post: Post
  endpoint?: string
}): Promise<SweepResult> {
  const { renderer, scene, camera, post } = deps
  const endpoint = deps.endpoint ?? 'http://127.0.0.1:7788/shot'
  const gl = renderer.getContext()

  const W = renderer.domElement.width
  const H = renderer.domElement.height
  const cellH = Math.round((CELL_W * H) / W)

  const sheet = document.createElement('canvas')
  sheet.width = CELL_W * COLS
  sheet.height = cellH * ROWS
  const sctx = sheet.getContext('2d')!
  sctx.fillStyle = '#111'
  sctx.fillRect(0, 0, sheet.width, sheet.height)

  // Sky mask: everything in the scene forced to black, the sky hidden, and the
  // buffer cleared white. Anything still white was sky. Exact, and cheaper than
  // trying to infer it from colour.
  const maskMat = new MeshBasicMaterial({ color: 0x000000 })
  const skyMesh = scene.children[0]
  const prevClear = renderer.getClearColor(new Color())
  const prevClearAlpha = renderer.getClearAlpha()
  const skyPx = new Uint8Array(W * H * 4)

  const frame = document.createElement('canvas')
  frame.width = W
  frame.height = H
  const fctx = frame.getContext('2d')!
  const px = new Uint8Array(W * H * 4)

  const blank: number[] = []
  const litBlank: number[] = []
  const maps: string[][] = []
  const n = COLS * ROWS
  const span = START_Z - WALK_END_Z
  // Where a walker actually is: in the through-zone, not pressed against the
  // glass. The first version of this stood 2.1 m off the facade and turned to
  // face it, which fills the frame with whatever happens to be within arm's
  // reach and reports "bare wall" for a street that has plenty on it. Looking
  // *across* a street means looking at the far side, nineteen metres away.
  const walkX = (CORRIDOR[0] + CORRIDOR[1]) / 2

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const z = START_Z - t * span
    const side = i % 2 === 0 ? -1 : 1
    // Camera forward is (-sin yaw, -cos yaw). To look *across* from the kerb at
    // x = side*walkX the view has to head toward -side, which means yaw of the
    // same sign as `side` — so the sign is already carried by `side` and must
    // not be applied twice. It was, and every other across-the-street frame
    // turned to face the wall two metres behind the camera instead of the
    // facade nineteen metres in front. Four of the twenty-four frames in the
    // sheet were bare brick for that reason and were read as evidence about the
    // street. A diagnostic that is wrong is worse than no diagnostic.
    const step = i % 6
    const yaw =
      step === 2 ? side * 1.35 // across, angled a little forward
      : step === 3 ? side * 1.95 // across, angled a little back
      : step === 5 ? Math.PI // back the way you came
      : 0
    const pitch = step === 4 ? 0.42 : 0.04 // one frame up at the roofline

    camera.position.set(side * walkX, 1.68, z)
    camera.rotation.set(pitch, yaw, 0, 'YXZ')
    scene.children[0].position.copy(camera.position)

    for (let k = 0; k < 3; k++) {
      post.update(camera, performance.now())
      post.render()
    }

    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)

    skyMesh.visible = false
    scene.overrideMaterial = maskMat
    renderer.setClearColor(0xffffff, 1)
    renderer.setRenderTarget(null)
    renderer.clear()
    renderer.render(scene, camera)
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, skyPx)
    scene.overrideMaterial = null
    skyMesh.visible = true
    renderer.setClearColor(prevClear, prevClearAlpha)
    const img = fctx.createImageData(W, H)
    for (let y = 0; y < H; y++) {
      const s = (H - 1 - y) * W * 4
      img.data.set(px.subarray(s, s + W * 4), y * W * 4)
    }
    for (let a = 3; a < img.data.length; a += 4) img.data[a] = 255
    fctx.putImageData(img, 0, 0)
    const map: string[] = []
    const b = blankShare(px, skyPx, W, H, map)
    blank.push(b.share)
    litBlank.push(b.litShare)
    maps.push(map)

    const cx = (i % COLS) * CELL_W
    const cy = Math.floor(i / COLS) * cellH
    sctx.drawImage(frame, cx, cy, CELL_W, cellH)
    sctx.fillStyle = 'rgba(0,0,0,0.62)'
    sctx.fillRect(cx, cy + cellH - 18, 168, 18)
    sctx.fillStyle = '#e8a35c'
    sctx.font = '12px ui-monospace, Menlo, monospace'
    sctx.fillText(
      `${i + 1}  z=${z.toFixed(0)}  blank ${(blank[i] * 100).toFixed(0)}%`,
      cx + 5,
      cy + cellH - 5,
    )
  }

  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'contact-sheet',
      dataUrl: sheet.toDataURL('image/jpeg', 0.86),
    }),
  })

  // Worst by the *actionable* half. The frame with the most blank tiles is
  // usually just the darkest one, and its map is a wall of '#' that says only
  // that it is night; the frame with the most blank-but-lit tiles is the one
  // with something to fix in it, and its map shows where.
  let worst = 0
  for (let i = 1; i < litBlank.length; i++) if (litBlank[i] > litBlank[worst]) worst = i
  return {
    file: r.ok ? await r.text() : `sweep POST failed: ${r.status}`,
    blank: blank.map((v) => +v.toFixed(3)),
    worstFrame: worst + 1,
    worstBlank: +blank[worst].toFixed(3),
    worstMap: maps[worst],
    overBudget: blank.map((v, i) => (v > 0.4 ? i + 1 : 0)).filter((i) => i > 0),
    meanBlank: +(blank.reduce((a, b) => a + b, 0) / blank.length).toFixed(3),
    litBlank: litBlank.map((v) => +v.toFixed(3)),
    meanLitBlank: +(litBlank.reduce((a, b) => a + b, 0) / litBlank.length).toFixed(3),
  }
}
