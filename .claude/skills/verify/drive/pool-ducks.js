// The panel's buttons: Add five brings five ducks out of the fountain; a picked duck takes the chosen colour and hat.
(async () => {
  const h = window.__pool, root = document.querySelector('.pool'), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const n0 = h.state().ducks
  root.querySelector('#add5').click()
  await wait(4000)
  const n1 = h.state().ducks
  const duck = h.world.ducks[0]
  h.world.hand.grab(duck.body); h.world.hand.throw(duck.body, [0, 0, 0])
  root.querySelector('.dk-sw[data-colour="5"]').click(); root.querySelector('.dk-chip[data-hat="3"]').click()
  if (n1 !== n0 + 5 || duck.colour !== 5 || duck.hat !== 3) throw new Error(`ducks ${n0} -> ${n1}, colour ${duck.colour}, hat ${duck.hat}`)
  return JSON.stringify({ ducks: [n0, n1], dressed: { colour: duck.colour, hat: duck.hat }, who: root.querySelector('#who').textContent })
})()
