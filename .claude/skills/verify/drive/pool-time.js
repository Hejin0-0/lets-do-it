// The clock by the hook (the page has no controls of its own yet): stopped, the hour stays put; set to 22:00, it is
// night. Proof: the stopped hour, and day/night uniforms used by the renderer.
(async () => {
  const P = window.__pool, wait = (ms) => new Promise((r) => setTimeout(r, ms))
  await wait(500)
  P.clock(false); await wait(300)
  const h0 = P.state().hour; await wait(1000); const h1 = P.state().hour
  P.hour(12); P.render(1, 0)
  const day = P.light()
  P.hour(22); await wait(400)
  P.render(1, 0)
  const st = P.state(), light = P.light()
  const out = { stopped: [h0, h1], clock: st.clock, hour: st.hour, day, light }
  if (h0 !== h1 || st.clock !== false || st.hour !== 22 || day.night !== 0 ||
    light.night !== 1 || !(light.exposure > day.exposure)) throw new Error(JSON.stringify(out))
  return JSON.stringify(out)
})()
