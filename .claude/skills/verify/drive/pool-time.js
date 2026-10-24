// The clock by the hook (the page has no controls of its own yet): stopped, the hour stays put; set to 22:00, it is
// night. Proof: the hour before and after a second stopped, the clock's state, the night.
(async () => {
  const P = window.__pool, wait = (ms) => new Promise((r) => setTimeout(r, ms))
  await wait(500)
  P.clock(false); await wait(300)
  const h0 = P.state().hour; await wait(1000); const h1 = P.state().hour
  P.hour(22); await wait(400)
  const st = P.state(), out = { stopped: [h0, h1], clock: st.clock, hour: st.hour, night: st.night }
  if (h0 !== h1 || st.clock !== false || st.hour !== 22 || st.night !== 1) throw new Error(JSON.stringify(out))
  return JSON.stringify(out)
})()
