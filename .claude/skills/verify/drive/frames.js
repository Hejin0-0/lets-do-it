// frameOverlaps(): the page's own frames (title, panel or its bottom sheet, "how to play") that cover one
// another, as "a x b: WxH px". The phone's fixed switcher bar is left out: content scrolls under it by design.
// Prepended to overlap.js and jelly-tour.js.
const frameOverlaps = () => {
  const pick = (sel) => [...document.querySelectorAll(sel)].filter((e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0 && r.width > 4 && r.height > 4 })
  const frames = [...pick('.mast, .masthead'), ...pick('.dio-panel, .panel'), ...pick('.dio-foot, .foot')]
  const name = (e) => e.id || e.className.toString().split(' ')[0], hits = []
  for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) {
    if (frames[i].contains(frames[j]) || frames[j].contains(frames[i])) continue
    const a = frames[i].getBoundingClientRect(), b = frames[j].getBoundingClientRect()
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
    if (w > 2 && h > 2) hits.push(`${name(frames[i])} x ${name(frames[j])}: ${Math.round(w)}x${Math.round(h)} px`)
  }
  return { frames: frames.map(name), hits }
}
