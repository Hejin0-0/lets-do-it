// Add a flyer with its button, then let the world's own clock run (the hook steps it: flights have no control) until
// it has flown and in the end gone out to sea. Proof: the flyer's propeller, its height in the air, the toast and
// the panel's Out to sea count.
(async () => {
  const P = window.__pool, W = P.world, wait = (ms) => new Promise((r) => setTimeout(r, ms)), $ = (id) => document.getElementById(id)
  await wait(500)
  const n0 = W.ducks.length; $('addFlyer').click(); await wait(300)
  const d = W.ducks[W.ducks.length - 1], out = { ducks: [n0, W.ducks.length], propeller: d.hat === 8 }
  let high = 0, flights = 0, prev = d.state
  for (let k = 0; k < 120 * 20 && d.state !== 'sea'; k++) {   // up to 20 minutes of the world, a second at a time
    P.step(120); if (d.state === 'fly') high = Math.max(high, d.body.p[1]); if (prev !== 'fly' && d.state === 'fly') flights++; prev = d.state
  }
  P.render(1, 1 / 60); await wait(400)
  Object.assign(out, { flights, high: +high.toFixed(2), atSea: d.state === 'sea', toast: $('toast').textContent, tally: $('nEscaped').textContent })
  if (!out.propeller || !out.atSea || high < 1.6 || out.tally !== '1' || !/out to sea/.test(out.toast)) throw new Error(JSON.stringify(out))
  return JSON.stringify(out)
})()
