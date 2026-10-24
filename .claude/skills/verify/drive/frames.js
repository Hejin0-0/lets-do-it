// frameOverlaps(): the page's own frames (title, panel or its bottom sheet, "how to play", the status pill)
// that cover one another, as "a x b: WxH px". A frame counts where it is painted: its box when it has a
// background or a border, else its lines of text and its boxed children, so a title block's empty width
// beside its text never counts. The phone's fixed switcher bar is left out: content scrolls under it by design.
// Prepended to overlap.js and jelly-tour.js.
const frameOverlaps = () => {
  const pick = (sel) => [...document.querySelectorAll(sel)].filter((e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0 && r.width > 4 && r.height > 4 })
  const frames = [...pick('.mast, .masthead'), ...pick('.dio-panel, .panel'), ...pick('.dio-foot, .foot'), ...pick('.dio-status, .status')]
  const boxed = (e) => { const s = getComputedStyle(e); return !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(s.backgroundColor) || parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth) > 0 }
  const painted = (e) => {
    if (boxed(e)) return [e.getBoundingClientRect()]
    const out = [], walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), range = document.createRange()
    for (let t; (t = walk.nextNode());) if (t.textContent.trim()) { range.selectNodeContents(t); out.push(...range.getClientRects()) }
    for (const d of e.querySelectorAll('*')) if (boxed(d)) out.push(d.getBoundingClientRect())
    return out.filter((r) => r.width > 1 && r.height > 1)
  }
  const name = (e) => e.id || e.className.toString().split(' ')[0], hits = []
  for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) {
    if (frames[i].contains(frames[j]) || frames[j].contains(frames[i])) continue
    let w = 0, h = 0
    for (const a of painted(frames[i])) for (const b of painted(frames[j])) {
      const ow = Math.min(a.right, b.right) - Math.max(a.left, b.left), oh = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (ow > 2 && oh > 2 && ow * oh > w * h) { w = ow; h = oh }
    }
    if (w) hits.push(`${name(frames[i])} x ${name(frames[j])}: ${Math.round(w)}x${Math.round(h)} px`)
  }
  return { frames: frames.map(name), hits }
}
