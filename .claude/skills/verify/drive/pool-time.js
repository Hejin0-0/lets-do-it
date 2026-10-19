// The Time controls: the toggle stops the clock (the hour stays put), the slider moves it to 22:00, and it is night;
// the slider's label follows. Proof: the hour before and after a second stopped, the night, the label.
(async () => {
  const P = window.__pool, wait = (ms) => new Promise((r) => setTimeout(r, ms)), $ = (id) => document.getElementById(id)
  await wait(500)
  $('dayRun').click(); await wait(300)
  const h0 = P.state().hour; await wait(1000); const h1 = P.state().hour
  const s = $('hour'); s.value = 88; s.dispatchEvent(new Event('input', { bubbles: true })); await wait(400)
  const st = P.state(), out = { stopped: [h0, h1], run: $('dayRun').getAttribute('aria-label'), hour: st.hour, night: st.night, label: $('hourOut').textContent }
  if (h0 !== h1 || st.hour !== 22 || st.night !== 1 || out.label !== '22:00' || out.run !== 'Start the clock') throw new Error(JSON.stringify(out))
  return JSON.stringify(out)
})()
