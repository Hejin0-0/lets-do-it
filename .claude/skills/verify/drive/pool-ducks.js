// Ducks by the hook (the page has no controls of its own yet): add(5) brings five ducks dropping into the big pool;
// a picked duck takes the chosen design and hat.
(async () => {
  const h = window.__pool, wait = (ms) => new Promise((r) => setTimeout(r, ms))
  h.world.arrivals = false   // no duck of its own coming in the middle of the count
  const n0 = h.state().ducks
  h.add(5)
  await wait(4000)
  const n1 = h.state().ducks
  h.select(0); h.colour(5); h.hat(3)
  const duck = h.world.ducks[0]
  if (n1 !== n0 + 5 || duck.colour !== 5 || duck.hat !== 3) throw new Error(`ducks ${n0} -> ${n1}, colour ${duck.colour}, hat ${duck.hat}`)
  return JSON.stringify({ ducks: [n0, n1], dressed: { name: duck.name, colour: duck.colour, hat: duck.hat } })
})()
