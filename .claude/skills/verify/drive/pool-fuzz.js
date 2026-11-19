// Seeded random play on the real page: clicks, drags (left and right), wheel steps, keys and held movement keys
// through the browser's own input, sitting by the hook, the seated panel's and an open dialog's controls, ducks
// added, removed, given a random design (of all 24) and hat, mixed up and tapped, a flyer, the hour, Go home, the
// page hidden and shown, the window losing focus. After every step: every duck's position finite and on the
// island's sea, its design in range, the camera finite, the seated panel open only when seated. The probe fails on
// any page error. window.__SEED (default 1) picks the sequence, window.__STEPS (default 220) its length.
(async () => {
  const P = window.__pool, wait = (ms) => new Promise((r) => setTimeout(r, ms)), cv = document.querySelector('canvas')
  let s = (window.__SEED || 1) >>> 0
  const R = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const pick = (a) => a[Math.floor(R() * a.length)], rx = () => 20 + R() * (innerWidth - 40), ry = () => 20 + R() * (innerHeight - 40)
  const menu = () => document.querySelector('.seat-ui dialog')
  const odd = [], did = {}
  const checks = (what) => {
    for (const d of P.world.ducks) {
      const p = d.body.p
      if (!p.every(Number.isFinite)) odd.push({ what, bad: 'non-finite duck', id: d.id })
      else if (Math.hypot(p[0], p[2]) > 400 || p[1] < -20 || p[1] > 60) odd.push({ what, bad: 'duck far out', id: d.id, p: p.map((v) => +v.toFixed(1)) })
      if (!(d.colour >= 0 && d.colour < 24)) odd.push({ what, bad: 'design out of range', colour: d.colour })
    }
    const c = P.state().camera
    if (![c.az, c.el, c.dist, ...c.target].every(Number.isFinite)) odd.push({ what, bad: 'camera non-finite' })
    if (menu()?.open && P.seating.state.phase !== 'seated') odd.push({ what, bad: 'menu open while ' + P.seating.state.phase })
  }
  const acts = {
    click: async () => window.__input([{ click: [rx(), ry()] }]),
    drag: async () => window.__input([{ drag: [rx(), ry(), rx(), ry()], button: pick(['left', 'left', 'right']) }]),
    wheel: async () => cv.dispatchEvent(new WheelEvent('wheel', { deltaY: (R() - 0.5) * 600, clientX: rx(), clientY: ry(), bubbles: true, cancelable: true })),
    key: async () => window.__input([{ key: pick(['w', 'a', 's', 'd', 'r', 'm', 'Escape', 'Tab', 'Enter', ' ', 'ArrowLeft', 'ArrowUp']) }]),
    hold: async () => { const k = pick(['w', 'a', 's', 'd']); await window.__input([{ down: k }]); await wait(150 + R() * 400); await window.__input([{ up: k }]) },
    sit: async () => P.sit(Math.floor(R() * P.spots().seats.length)),
    menuButton: async () => { const b = [...(menu()?.querySelectorAll('button, input, select') || [])].filter((e) => e.offsetParent); if (b.length) { const e = pick(b); if (e.type === 'range') { e.value = String(R() * 24); e.dispatchEvent(new Event('input', { bubbles: true })) } else e.click() } },
    bookButton: async () => { const b = [...document.querySelectorAll('dialog[open] button')].filter((e) => e.offsetParent); if (b.length) pick(b).click() },
    add: async () => P.add(1 + Math.floor(R() * 4)),
    remove: async () => P.remove(),
    colour: async () => { if (P.world.ducks.length) { P.select(Math.floor(R() * P.world.ducks.length)); P.colour(Math.floor(R() * 24)) } },
    hat: async () => { if (P.world.ducks.length) { P.select(Math.floor(R() * P.world.ducks.length)); P.hat(Math.floor(R() * 8)) } },
    mix: async () => P.mix(),
    tap: async () => { if (P.world.ducks.length) P.tap(Math.floor(R() * P.world.ducks.length)) },
    flyer: async () => P.addFlyer(),
    hour: async () => P.hour(R() * 24),
    home: async () => { if (R() < 0.3) P.goHome() },
    hide: async () => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); await wait(100); delete document.hidden; document.dispatchEvent(new Event('visibilitychange')) },
    blur: async () => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')) },
  }
  const names = Object.keys(acts), N = window.__STEPS || 220
  await wait(400)
  for (let i = 0; i < N; i++) {
    const a = pick(names); did[a] = (did[a] || 0) + 1
    await acts[a]()
    await wait(40 + R() * 260)
    checks(i + ':' + a)
    if (odd.length > 20) break
  }
  await wait(1500); checks('end')
  const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null
  const out = { seed: window.__SEED, steps: N, did, ducks: P.world.ducks.length, designs: [...new Set(P.world.ducks.map((d) => d.colour))].length, phase: P.seating.state.phase, heapMB: heap, dom: document.querySelectorAll('*').length, odd: odd.slice(0, 20) }
  if (odd.length) throw new Error('fuzz anomalies: ' + JSON.stringify(out))
  return JSON.stringify(out)
})()
