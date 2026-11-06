// The scene is sampled with elapsed seconds supplied by the page, independent of the world clock.
export const DUSK_SECONDS = 2.5, DARK_SECONDS = 0.3, DAWN_SECONDS = 1.2;
const NIGHT_HOUR = 20, SUNRISE_HOUR = 5.6;

export function homeAt(elapsed, startHour, reduced) {
  const t = Math.max(0, elapsed);
  if (t < DUSK_SECONDS) {
    const k = t / DUSK_SECONDS, fade = k * k * (3 - 2 * k);
    const end = startHour < SUNRISE_HOUR || startHour >= NIGHT_HOUR ? startHour : NIGHT_HOUR;
    return { phase: 'dusk', t, opacity: fade, hour: reduced ? null : startHour + (end - startHour) * fade };
  }
  if (t < DUSK_SECONDS + DARK_SECONDS) return { phase: 'dark', t: t - DUSK_SECONDS, opacity: 1, hour: reduced ? null : (startHour < SUNRISE_HOUR || startHour >= NIGHT_HOUR ? startHour : NIGHT_HOUR) };
  if (t < DUSK_SECONDS + DARK_SECONDS + DAWN_SECONDS) {
    const dawn = t - (DUSK_SECONDS + DARK_SECONDS), k = dawn / DAWN_SECONDS;
    return { phase: 'dawn', t: dawn, opacity: 1 - k * k * (3 - 2 * k), hour: null };
  }
  return null;
}

// Consume pending events first: a send-back or discovery just before reset belongs to the old visit, and so does what
// the boat was bringing home (it ends its trip at once). Returns the ids of the items that trip brought home.
export function startVisit(world, book, visit) {
  const from = world.events.length;
  world.boatHome();
  const landed = world.events.slice(from).flatMap(e => (e.type === 'collected' ? e.ids : []));
  book.observe(world, world.events);
  book.startVisit();
  world.reset({ visit });
  world.collectibles.setCollected(book.pages.filter(page => page.found).map(page => page.id));
  for (const id of book.inPool) world.summon(id);
  return landed;
}
