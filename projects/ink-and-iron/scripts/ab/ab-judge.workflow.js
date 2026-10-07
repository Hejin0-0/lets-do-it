export const meta = {
  name: 'ink-iron-ab-judge',
  description: 'Blind A/B comparison of two Ink & Iron builds (eleven matched captures incl. first screen, pocket book, after-action page, round banner) by two Sonnet 5 judges, order swapped',
  phases: [{ title: 'Judge', detail: 'two blind Sonnet 5 judges, order swapped', model: 'sonnet' }],
}
const D = '/private/tmp/claude-501/ink-iron-ab/shots'
const [X, Y] = args.labels
const CAPS = [
  ['8-title', '1280x720, the VERY FIRST SCREEN a visitor sees: the title over the library hall, 1.5 s after the page loads, before any click'],
  ['1-library', '1280x720, the establishing view of the library room (intro state, title dismissed)'],
  ['2-s1', '1280x720, scenario s1 at the start of play, default commander camera'],
  ['3-forecast', '1280x720, s1: a piece selected and the pointer hovering its move destination (move forecast tag)'],
  ['4-bell', '1280x720, s1: the bell rung (Space), then Space again during the enemy turn; captured 1.5 s into the enemy turn'],
  ['5-s2', '1280x720, scenario s2 at the start of play'],
  ['6-yawed', '1280x720, s1 with the camera yawed left by the player (a-key x7)'],
  ['7-tablet', '768x1024 portrait tablet, scenario s3 at the start of play'],
  ['9-book', '1280x720, the pocket book (the game menu: battles, difficulty, settings) opened during s1'],
  ['10-ledger', '1280x720, the after-action report after WINNING the first battle (Strandfest, s1), reached the way a new player would from the title card'],
  ['11-round', '1280x720, s3: the banner as the player\'s round 2 begins, one second after the enemy turn ends'],
]
const AXES = ['A Board & terrain', 'B Pieces & life', 'C Setting (library room)', 'D Atmosphere', 'E Game & interaction', 'F Craft & finish', 'G First impression', 'H Story & history']
const SCHEMA = {
  type: 'object',
  properties: {
    axes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          axis: { type: 'string', enum: AXES },
          prefer: { type: 'string', enum: [X, Y, 'same'] },
          confidence: { type: 'integer', minimum: 1, maximum: 5 },
          why: { type: 'string' },
        },
        required: ['axis', 'prefer', 'confidence', 'why'],
      },
    },
    overall: { type: 'string', enum: [X, Y, 'same'] },
    scores: { type: 'object', properties: { [X]: { type: 'integer', minimum: 0, maximum: 100 }, [Y]: { type: 'integer', minimum: 0, maximum: 100 } }, required: [X, Y] },
    wins: { type: 'object', properties: { [X]: { type: 'array', items: { type: 'string' } }, [Y]: { type: 'array', items: { type: 'string' } } }, required: [X, Y] },
    fixes: { type: 'array', items: { type: 'string' } },
  },
  required: ['axes', 'overall', 'scores', 'wins', 'fixes'],
}
const prompt = (first, second) => `You are an INDEPENDENT, BLIND comparison judge. Two builds of the same browser game, called only "${first}" and "${second}", are shown in identical capture sets. You are NOT told which is older or newer; do not guess, and do not let a guess sway you. Judge only what you see. Beware of order bias: the build you see second is not better for being fresher in mind — re-open earlier captures when in doubt.

THE OWNER'S BRIEF: "a beautiful room like the Harry Potter library, and a WW1 simulation GAME BOARD that anyone would want to try." The owner has also asked that the game's progression be built on real history, as an alternate history.
The game, "Ink & Iron": a turn-based WW1 hex wargame on the 1917 Yser front (Nieuwpoort, Belgium), played with tin miniatures on a map table in a candle-lit gothic library. Enemy attacks are painted in red ink a turn early; you give orders, ring the bell, the AI answers.

CAPTURES — open every one with the Read tool, as matched pairs, ${first} first then ${second}:
${CAPS.map(([k, what]) => `  ${D}/${first}-${k}.png  vs  ${D}/${second}-${k}.png — ${what}`).join('\n')}
${args.stats}

Budget: only these 22 Read calls (plus re-reads if needed). Do not run the game, do not read source code, do not modify any file, do not run git.

For each axis — A Board & terrain, B Pieces & life, C Setting (library room), D Atmosphere, E Game & interaction (legibility, feedback, HUD, menus), F Craft & finish (clipping, overlaps, bugs, performance), G First impression (captures 8 and 1: would a stranger want to click and play?), H Story & history (does the game frame its battles in real 1917 history and an alternate history worth following? judge the presentation and pull, not your own fact-checking) — say which build is better (${first}, ${second} or same), your confidence 1-5, and WHY, citing the capture number and the spot. Be strict: "same" when the difference is not visible. Then an overall verdict and a harsh /100 score for EACH build (100 = nothing could be improved; a very good hobby project is 70). wins: for each build, where it is clearly better than the other (its rival's regressions count here). fixes: the top 5 fixes for the BETTER build, ranked by impact per effort, each naming the capture where the problem shows.`
phase('Judge')
const [a, b] = await parallel([
  () => agent(prompt(X, Y), { label: `judge:${X}-first`, phase: 'Judge', model: 'sonnet', effort: 'medium', schema: SCHEMA }),
  () => agent(prompt(Y, X), { label: `judge:${Y}-first`, phase: 'Judge', model: 'sonnet', effort: 'medium', schema: SCHEMA }),
])
return { [`${X}First`]: a, [`${Y}First`]: b }