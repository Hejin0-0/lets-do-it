// The orchestrator (Lead). The only code that calls rules.apply(). It owns the turn flow, the
// click grammar, Undo/Rewind, the enemy phase and every hand-off to the views (DESIGN §11.3).
//
// ONE CLICK, ONE MEANING (pillar 2 of the audit's defect list, d2): with a piece selected, a click
// on a hex that piece can reach or strike IS the order — nothing near it can steal the click.
import * as THREE from 'three'
import { createBus } from '../contract/bus.ts'
import type { Bus, UiCmd } from '../contract/bus.ts'
import type { GameEvent } from '../contract/events.ts'
import type { BoardView, CampaignNote, Hud, Overlay, RoomView } from '../contract/render-api.ts'
import type { Action, Difficulty, Forecast, GameState, HexId, Intent, ScenarioId, Side, Unit } from '../contract/types.ts'
import { Loop } from '../core/Loop.ts'
import { createRenderer, resizeRenderer } from '../core/Renderer.ts'
import { CameraRig } from '../systems/CameraRig.ts'
import { createRoomView } from '../room/RoomView.ts'
import { createBoardView } from '../board/BoardView.ts'
import { createHud } from '../ui/Hud.ts'
import { createAudio } from '../audio/AudioSystem.ts'
import type { AudioSystem } from '../audio/AudioSystem.ts'
import { apply, fan, footprint, forecast, IllegalAction, legal, newGame, OBSERVE, reach } from '../rules/index.ts'
import { PROFILES, planTurn } from '../ai/index.ts'
import { SCENARIOS } from '../rules/scenarios/index.ts'
import { CAMPAIGN, hexName, SCENARIO, tutorIndex } from '../ui/words.ts'
import { CHAPTERS, campaignMods, loadCampaign, saveCampaign } from './Campaign.ts'
import type { Campaign } from './Campaign.ts'
import type { TutorId } from '../ui/words.ts'
import { EventPlayer } from './EventPlayer.ts'
import { Picking } from './Picking.ts'
import { installTestHooks } from './TestHooks.ts'

const REWINDS: Record<Difficulty, number> = { recruit: Infinity, veteran: 1, general: 0 }
const INTRO_S = 6

// 'barrage' / 'gas' / 'creep': the battery is armed with that shell, and the next board click fires.
type Mode = 'intro' | 'play' | 'barrage' | 'gas' | 'creep'

// Commands worth keeping when they arrive mid-animation (camera moves never wait).
const BUFFERED = new Set<UiCmd>(['undo', 'bell', 'barrage', 'gas', 'creep', 'sluice', 'pivot-l', 'pivot-r', 'next-piece', 'deselect', 'rewind'])
// Inputs kept while the player's own order animates, replayed in order once the table is idle.
const QUEUE_MAX = 4
type Queued = { click?: HexId | null; cmd?: UiCmd; arg?: string }
const COLS = 13

export class Game {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.05, 60)
  readonly rig: CameraRig
  readonly bus: Bus = createBus()
  readonly room: RoomView
  readonly board: BoardView
  readonly hud: Hud
  readonly audio: AudioSystem
  readonly player: EventPlayer
  private readonly picking: Picking
  private readonly loop: Loop
  private readonly canvas: HTMLCanvasElement

  state: GameState
  private undo: GameState[] = []
  private rewind: GameState | null = null
  rewindsLeft = 0
  selected: string | null = null
  private hover: HexId | null = null
  private cursor: HexId | null = null
  mode: Mode = 'intro'
  introPush = true // the intro dollies from the hall toward the table (TestHooks holds it still)
  private introT = 0
  private staff = false
  private firstRing = true
  private confirmUntil = 0
  // The campaign on the real 1917 calendar (Campaign.ts): the chapter being fought, and the chapter
  // a saved campaign stands at (the pocket book's "Continue").
  private campaign: Campaign | null = null
  private savedChapter: number | null = loadCampaign()?.chapter ?? null
  // The first night's five notes (DESIGN §7): `tutorAt` is how far the player has come (0 = no
  // tutor), and the line shown there is picked from the table as it stands (words.ts TUTOR). An
  // outside review fired three barrages and was still told "Click A Coy".
  private tutorAt = 0
  private tutorHit = false
  private clock = 0
  paused = false
  reducedMotion = false
  aiMs = 0
  lastFeedbackMs = 0
  frame = 0
  // Adaptive quality: sustained frames slower than 40 fps cap the pixel ratio at 1 (the cheapest
  // lever: fill rate). Surfaced in diagnostics as `maxDpr`.
  maxDpr = 2
  private slowT = 0
  private overlayDirty = true
  // Inputs buffered while the player's own order animates, replayed IN ORDER once the table is
  // idle. One slot lost the middle of "A Coy, E6, B Coy, F6" clicked inside 120 ms (outside
  // review); clicks during the enemy's turn are not kept — they hurry the turn along instead.
  private queued: Queued[] = []
  private draining = false
  private ringing = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = createRenderer(canvas)
    this.rig = new CameraRig(this.camera)
    this.room = createRoomView(this.bus)
    this.room.build(this.scene, this.renderer, matchMedia('(pointer:coarse)').matches ? 'mobile' : 'desktop')
    this.board = createBoardView(this.bus)
    this.board.mount(this.room.tableTop)
    this.hud = createHud(document.querySelector<HTMLElement>('#app') ?? document.body, this.bus)
    this.audio = createAudio(this.bus)
    this.player = new EventPlayer(this.board, this.room, this.bus)
    this.picking = new Picking(canvas, this.board, this.camera, this.bus)
    // The camera director: a shell, an assault or a capture leans the look target toward its hex.
    this.player.focus = (h) => {
      const p = this.board.hexToLocal(h)
      this.room.tableTop.updateWorldMatrix(true, false)
      p.applyMatrix4(this.room.tableTop.matrixWorld)
      this.rig.lookToward(p.x, p.z)
    }
    // Each event's result, over its hex as it lands (figures lost, a piece wiped out, a capture)
    // or on the candle rail (a morale change).
    this.player.result = (ev) => {
      if (ev.e === 'figures' || ev.e === 'destroyed') {
        const at = this.lastSeen.get(ev.unit)
        if (!at) return
        this.hud.result(ev, { ...this.hexScreen(at.hex), side: at.side })
        // ...and in words: the red ink landing at the bell had a numeral and no narration (blind
        // A/B: "the enemy turn is one small -2 puff; the player cannot tell what was hit")
        const name = this.state.units.find((u) => u.id === ev.unit)?.name ?? 'A company'
        this.lossSaidAt = performance.now()
        this.hud.banner(ev.e === 'figures' ? `${name} loses ${ev.lost} ${ev.lost === 1 ? 'man' : 'men'} at ${hexName(at.hex)}.`
          : `${name} is wiped out at ${hexName(at.hex)}.`)
      } else if (ev.e === 'captured') this.hud.result(ev, { ...this.hexScreen(ev.hex), side: ev.by })
      else if (ev.e === 'morale') this.hud.result(ev, null)
    }
    this.state = newGame('s1', 42, 'recruit')
    this.load(this.state, true)
    this.wire()
    this.loop = new Loop((dt, t) => this.update(dt, t), () => this.render())
    installTestHooks(this)
  }

  start(): void { this.loop.start() }

  dispose(): void {
    this.loop.stop()
    this.picking.dispose()
    this.audio.dispose()
    this.renderer.dispose()
  }

  // ---------------------------------------------------------------------------------------------
  //  Loading and restarting
  // ---------------------------------------------------------------------------------------------

  load(s: GameState, intro: boolean): void {
    this.state = s
    this.undo = []
    this.rewind = s.phase === 'player-orders' ? structuredClone(s) : null
    this.rewindsLeft = REWINDS[s.difficulty]
    this.selected = null
    this.mode = intro ? 'intro' : 'play'
    this.introT = 0
    this.firstRing = true
    this.queued = []
    this.board.load(s)
    this.hud.hideLedger()
    if (intro) {
      this.rig.setStop('hall', true)
      this.introPush = true
      this.tutorAt = s.scenario === 's1' && s.difficulty === 'recruit' ? 1 : 0
    } else {
      this.rig.setStop('commander', true)
      // A restart or a new scenario is not the first night: no tutor. (It used to carry over the
      // opening recruit tutorial into a veteran game — outside review, twice.)
      this.tutorAt = 0
      this.hud.tutorial(-1)
    }
    if (s.phase === 'over') this.hud.ledger(s, this.campaignNote())
    if (!intro) window.setTimeout(() => { if (this.state === s) this.firstHint() }, 600)
    // A state that stops mid-bell exists only to show the shells landing: land them.
    if (s.phase === 'bell' && !intro) window.setTimeout(() => { if (this.state === s) void this.ring(true) }, 800)
    this.overlayDirty = true
    this.publish([])
  }

  newScenario(id: ScenarioId, seed: number, d: Difficulty, intro = false): void {
    this.load(newGame(id, seed, d), intro)
  }

  // A campaign chapter: its battle with the bend of the chapter before (a shell, a candle), and the
  // card over the table — what happened in 1917, and the question tonight's battle asks.
  private campaignBattle(d: Difficulty): void {
    const c = this.campaign
    if (!c) return
    saveCampaign(c)
    this.savedChapter = c.chapter
    const s = newGame(CHAPTERS[c.chapter], this.state.seed + 1, d)
    const m = campaignMods(c)
    s.shells.BR.he = Math.max(0, s.shells.BR.he + m.he)
    s.morale.BR += m.morale
    s.moraleStart.BR += m.morale
    this.load(s, false)
    const ch = CAMPAIGN.chapters[c.chapter], prev = c.won[c.chapter - 1]
    const before = prev === undefined ? [] : [CAMPAIGN.chapters[c.chapter - 1].then[prev ? 0 : 1]]
    this.hud.briefing({ kicker: CAMPAIGN.title, head: ch.head, history: ch.history,
      yours: [...before, ch.yours, prev === undefined ? '' : ch.mod[prev ? 0 : 1]].filter(Boolean).join(' '),
      button: 'To the table' })
  }

  /** The after-action lines for a campaign battle: 1917 beside tonight, and the way on. */
  private campaignNote(): CampaignNote | null {
    const c = this.campaign, s = this.state
    if (!c || CHAPTERS[c.chapter] !== s.scenario || s.phase !== 'over') return null
    const ch = CAMPAIGN.chapters[c.chapter]
    return { real: ch.real, yours: ch.then[s.winner === s.human ? 0 : 1],
      next: c.chapter + 1 < CHAPTERS.length ? `Next: ${CAMPAIGN.short(c.chapter + 1)}` : 'The epilogue' }
  }

  skipIntro(): void {
    if (this.mode !== 'intro') return
    this.mode = 'play'
    this.rig.setStop('commander', false, 0.85) // a slow glide from the hall down to the chair
    if (this.tutorAt > 0) this.tutorShow()
    else { this.hud.tutorial(-1); window.setTimeout(() => this.firstHint(), 900) }
    // Tell the HUD too, so the title card goes with the intro rather than on its own 6.5 s timer
    // (the table woke, but the HUD stayed hidden under a lingering title). Re-entry is a no-op.
    this.bus.emit('ui:cmd', { cmd: 'skip-intro' })
  }

  // ---------------------------------------------------------------------------------------------
  //  Input grammar
  // ---------------------------------------------------------------------------------------------

  private wire(): void {
    this.bus.on('ui:hover', ({ hex }) => {
      this.hover = hex
      this.cursor = hex
      this.overlayDirty = true
    })
    this.bus.on('ui:click', ({ hex, button }) => {
      const t0 = performance.now()
      if (this.mode === 'intro' && !this.player.busy) { this.skipIntro(); return }
      // The enemy's turn: a click hurries it along, it is never kept as an order for the next one.
      if (this.ringing || (this.player.busy && this.state.phase !== 'player-orders')) { this.hurry(); return }
      if (this.player.busy) {
        this.player.fastForward()
        this.enqueue(button === 2 ? { cmd: 'deselect' } : { click: hex })
        return
      }
      if (button === 2) this.deselect()
      else void this.click(hex)
      this.lastFeedbackMs = performance.now() - t0
    })
    this.bus.on('ui:cmd', ({ cmd, arg }) => {
      if (cmd === 'skip') { this.hurry(); return }
      if (this.player.busy && BUFFERED.has(cmd)) {
        if (this.state.phase === 'player-orders' && !this.ringing) { this.player.fastForward(); this.enqueue({ cmd, arg }) }
        return
      }
      void this.command(cmd, arg)
    })
  }

  private enqueue(q: Queued): void {
    if (this.queued.length < QUEUE_MAX) this.queued.push(q)
  }

  // Space, a click or the skip button during the enemy's turn: everything still to play runs at
  // 8x with no held beats (EventPlayer.rush), cleared when the table is handed back.
  private hurry(): void {
    if (!this.ringing && !this.player.busy) return
    this.player.rush = true
    this.player.fastForward()
  }

  private unitAt(h: HexId): Unit | undefined {
    return this.state.units.find((u) => u.hex === h && u.str > 0)
  }

  private ownActions(id: string): Action[] {
    return legal(this.state).filter((a) => 'unit' in a && a.unit === id)
  }

  // What a click on `h` would do for the selected piece, in priority order: strike an enemy on
  // it, move there, cut wire there. The same function drives the hover forecast, so the tag the
  // player reads is always the order the click will give.
  private actionFor(h: HexId): Action | null {
    if (this.mode === 'barrage' || this.mode === 'gas') {
      const shell = this.mode === 'gas' ? 'gas' : 'he'
      return legal(this.state).find((a) => a.t === 'barrage' && a.target === h && a.shell === shell) ?? null
    }
    if (this.mode === 'creep') {
      // The creeping barrage walks three hexes of one row: the clicked hex and its two neighbours
      // (slid inward at the map's edge).
      const first = Math.floor(h / COLS) * COLS + Math.min(COLS - 3, Math.max(0, (h % COLS) - 1))
      return legal(this.state).find((a) => a.t === 'creep' && a.hexes[0] === first) ?? null
    }
    if (!this.selected) {
      // In the Sluice the sluice hex itself is the order: click it to open the gates.
      if (this.state.terrain[h] === 'sluice') return legal(this.state).find((a) => a.t === 'sluice') ?? null
      return null
    }
    const mine = this.ownActions(this.selected)
    const there = this.unitAt(h)
    if (there && there.side !== this.state.human) {
      const hit = mine.find((a) => (a.t === 'assault' || a.t === 'fire') && a.target === h)
      if (hit) return hit
    }
    return mine.find((a) => a.t === 'move' && a.to === h)
      ?? mine.find((a) => a.t === 'cut' && a.target === h)
      ?? null
  }

  private async click(h: HexId | null): Promise<void> {
    const s = this.state
    if (s.phase === 'over') return
    if (s.phase !== 'player-orders') { this.hud.banner('The enemy is moving — wait for the bell.'); return }
    if (h === null) { this.deselect(); return }
    const a = this.actionFor(h)
    if (a) { await this.commit(a); return }
    if (this.mode === 'barrage' || this.mode === 'gas' || this.mode === 'creep') {
      this.bus.emit('audio', { cue: 'invalid' })
      this.hud.banner(`No observer can see there — a piece of yours must stand within ${OBSERVE} hexes.`)
      return
    }
    const there = this.unitAt(h)
    if (there && there.side === s.human) {
      if (there.id === this.selected) { this.deselect(); return }
      if (this.ownActions(there.id).length > 0) { this.select(there.id); return }
      this.bus.emit('audio', { cue: 'invalid' })
      this.hud.banner(`${there.name} has had its order this round.`)
      return
    }
    if (this.selected) {
      this.bus.emit('audio', { cue: 'invalid' })
      this.hud.banner('Out of reach. Gold dots show where it can go.')
      return
    }
    if (there) { this.hud.banner(`${there.name} — the enemy.`); return }
    // Nothing held, nothing there: say what a click needs rather than doing nothing.
    this.bus.emit('audio', { cue: 'invalid' })
    this.hud.banner('Pick up one of your pieces first — the khaki bases.')
  }

  private select(id: string): void {
    this.selected = id
    this.mode = 'play'
    this.bus.emit('audio', { cue: 'select' })
    this.overlayDirty = true
    if (this.tutorAt === 1) this.tutorAt = 2
    this.tutorShow()
  }

  private deselect(): void {
    if (this.mode !== 'play' && this.mode !== 'intro') this.mode = 'play'
    if (!this.selected) return
    this.selected = null
    this.bus.emit('audio', { cue: 'deselect' })
    this.overlayDirty = true
    this.tutorShow()
  }

  private tutorShow(): void {
    if (this.tutorAt <= 0 || this.mode === 'intro') return
    this.hud.tutorial(tutorIndex(this.tutorLine()))
  }

  // Which wording of the current note fits the table: notes 2-3 follow what the player has done
  // (A Coy lifted or not, a piece still on red ink, orders left), 4 what the shells did, 5 whether
  // the battery still has a round.
  private tutorLine(): TutorId {
    const s = this.state, at = this.tutorAt
    if (at >= 5) return legal(s).some((a) => a.t === 'barrage' && a.shell === 'he') ? 'battery' : 'no-shells'
    if (at === 4) return this.tutorHit ? 'fell-hit' : 'fell-empty'
    if (at === 1) return 'lift'
    const red = new Set(s.intents.map((i) => i.target))
    const a = s.units.find((u) => u.id === 'br-a' && u.str > 0)
    if (at === 2 && a && red.has(a.hex)) return this.selected === a.id ? 'reach' : 'reach-any'
    if (this.dangerNow()) return 'still-red'
    const left = s.ordersLeft > 0 && s.units.some((u) => u.side === s.human && u.str > 0 && this.ownActions(u.id).length > 0)
    return left ? 'gap' : 'ring'
  }

  private async commit(a: Action): Promise<void> {
    let step
    try {
      step = apply(this.state, a)
    } catch (e) {
      if (!(e instanceof IllegalAction)) throw e
      this.bus.emit('audio', { cue: 'invalid' })
      this.hud.banner('That order cannot be given.')
      return
    }
    this.undo.push(this.state)
    const id = 'unit' in a ? a.unit : null
    this.state = step.state
    if (a.t === 'barrage' || a.t === 'creep') this.mode = 'play'
    // Keep the piece in hand after a move if it can still act; drop it once its order is spent.
    this.selected = id && this.ownActions(id).length > 0 ? id : null
    if (this.tutorAt === 1 || this.tutorAt === 2) this.tutorAt = 3 // any order moves the night on
    this.tutorShow()
    await this.show(step.events, 2)
  }

  private async show(events: GameEvent[], budget: number): Promise<void> {
    this.publish(events)
    this.overlayDirty = true
    await this.player.playAll(events, budget)
    this.board.sync(this.state)
    this.overlayDirty = true
    this.publish([])
    if (!this.ringing) void this.flushQueued()
  }

  private dangerNow(): boolean {
    const red = new Set(this.state.intents.map((i) => i.target))
    return this.state.units.some((u) => u.side === this.state.human && u.str > 0 && red.has(u.hex) &&
      this.ownActions(u.id).some((a) => a.t === 'move'))
  }

  // Replays the buffered inputs one by one; an input that starts an animation is awaited before
  // the next one, so "select B Coy, then order it" lands in that order.
  private async flushQueued(): Promise<void> {
    if (this.draining) return
    this.draining = true
    try {
      while (this.queued.length > 0 && this.state.phase === 'player-orders' && !this.player.busy && !this.ringing) {
        const q = this.queued.shift() as Queued
        if (q.cmd) await this.command(q.cmd, q.arg)
        else if (q.click !== undefined) await this.click(q.click)
      }
    } finally { this.draining = false }
    if (this.state.phase !== 'player-orders') this.queued = []
  }

  // The bell: the enemy's red ink lands, then the enemy moves and inks new intents.
  async ring(confirmed = false): Promise<void> {
    if (this.ringing) return
    this.ringing = true
    try { await this.ringInner(confirmed) } finally { this.ringing = false; this.player.rush = false }
    void this.flushQueued()
  }

  private async ringInner(confirmed: boolean): Promise<void> {
    const s = this.state
    // 'bell' too: a state loaded mid-bell (the artillery-resolve fixture) has only endOrders left,
    // and used to sit there forever because the bell answered player-orders alone.
    if (this.player.busy || (s.phase !== 'player-orders' && s.phase !== 'bell')) return
    if (!confirmed && s.phase === 'player-orders' && this.firstRing && this.dangerNow() && this.clock > this.confirmUntil) {
      this.confirmUntil = this.clock + 4
      this.bus.emit('audio', { cue: 'invalid' })
      this.hud.banner('Men still stand on red ink. Ring again to march anyway.')
      return
    }
    this.firstRing = false
    this.hud.banner('') // the first-turn hint was still up 2 s into their turn (outside review)
    this.selected = null
    this.mode = 'play'
    this.undo = []
    this.queued = [] // nothing typed before the bell is an order for the next round
    this.bus.emit('audio', { cue: 'bell' })
    this.bus.emit('fx:shake', { trauma: 0.12 })
    const men = (st: GameState): number => st.units.reduce((n, u) => n + (u.side === st.human ? Math.max(0, u.str) : 0), 0)
    const before = men(this.state)
    let step = apply(this.state, { t: 'endOrders' })
    this.state = step.state
    await this.show(step.events, 1.8)
    if (this.tutorAt >= 1 && this.tutorAt <= 3) {
      this.tutorAt = 4
      this.tutorHit = men(this.state) < before
      this.tutorShow()
    }
    let guard = 0
    // The enemy's answer is the beat the bell promises: a banner and a short breath before the
    // first German order, a beat between orders. It used to hold for 6-7 s at 1x, which an outside
    // review found was mostly waiting; ~3 s now, and Space / a click hurries it (hurry()).
    // ponytail: no seat change for their turn — a lean-back 'watch' seat showed more of the room but
    // two outside reviews caught its glide home as a misframed board with the lamp in the frame.
    const tally = { moved: 0, struck: 0, ranged: 0 }
    const menBefore = men(this.state)
    if (this.state.phase === 'enemy-orders') {
      // a loss read out at the bell keeps the banner a breath longer before their orders begin
      const fresh = performance.now() - this.lossSaidAt < 1500
      if (!fresh) this.hud.banner('The Germans answer…')
      await this.player.pause(fresh ? 1.0 : 0.2)
    }
    while (this.state.phase === 'enemy-orders' && guard++ < 4) {
      const plan = planTurn(this.state, PROFILES[this.state.difficulty])
      this.aiMs = plan.ms
      const per = 1.7 / Math.max(1, plan.actions.length)
      for (const a of plan.actions) {
        const said = this.narrate(a)
        if (said) this.hud.banner(said)
        if (a.t === 'move') tally.moved++
        else if (a.t === 'fire' || a.t === 'assault') tally.struck++
        else if (a.t === 'barrage') tally.ranged++
        step = apply(this.state, a)
        this.state = step.state
        await this.show(step.events, per)
        if (this.state.phase !== 'enemy-orders') break
        await this.player.pause(0.08)
      }
      if (this.state.phase === 'enemy-orders') {
        step = apply(this.state, { t: 'endOrders' })
        this.state = step.state
        await this.show(step.events, 0.9)
      }
    }
    await this.player.pause(0.1)
    if (this.state.phase === 'over') {
      this.bus.emit('audio', { cue: this.state.winner === this.state.human ? 'victory' : 'defeat' })
      this.hud.ledger(this.state, this.campaignNote())
      this.rig.setStop('gallery')
    } else {
      this.rewind = structuredClone(this.state)
      // What their turn did, said once the table is yours again (after the round banner).
      const lost = menBefore - men(this.state)
      const parts = [
        tally.moved ? `${tally.moved} advance${tally.moved > 1 ? 's' : ''}` : '',
        tally.struck ? `${tally.struck} attack${tally.struck > 1 ? 's' : ''}` : '',
        tally.ranged ? `${tally.ranged} barrage${tally.ranged > 1 ? 's' : ''} ranged (red ink)` : '',
      ].filter(Boolean)
      const note = `Their turn: ${parts.length ? parts.join(', ') : 'they held their ground'}${lost > 0 ? ` — you lost ${lost} ${lost > 1 ? 'men' : 'man'}` : ''}.`
      const round = this.state.round
      window.setTimeout(() => { if (this.state.round === round && this.state.phase === 'player-orders') this.hud.banner(note) }, 1700)
      if (this.tutorAt >= 4) {
        this.tutorAt = this.state.round >= 3 ? 0 : 5
        if (this.tutorAt === 0) this.hud.tutorial(-1)
        else this.tutorShow()
      }
    }
  }

  private async command(cmd: UiCmd, arg?: string): Promise<void> {
    const s = this.state
    switch (cmd) {
      case 'undo': {
        // Z during an order's animation is still an undo: finish the animation fast, then undo.
        if (this.player.busy || s.phase !== 'player-orders') return
        const prev = this.undo.pop()
        if (!prev) { this.hud.banner('Nothing to undo this turn.'); return }
        this.state = prev
        this.selected = null
        this.board.sync(prev)
        this.bus.emit('audio', { cue: 'undo' })
        this.overlayDirty = true
        this.publish([])
        this.tutorShow()
        return
      }
      case 'bell': return this.ring(arg === 'confirmed')
      case 'rewind': {
        if (this.player.busy || !this.rewind) return
        if (this.rewindsLeft <= 0) { this.hud.banner('No rewinds left at this difficulty.'); return }
        this.rewindsLeft -= 1
        const r = this.rewind
        this.state = structuredClone(r)
        this.undo = []
        this.selected = null
        this.hud.hideLedger()
        this.board.load(this.state)
        this.rig.setStop('commander')
        this.hud.banner(`Rewound to the start of round ${this.state.round}.`)
        this.overlayDirty = true
        this.publish([])
        return
      }
      case 'retry': {
        const want = parseArgs(arg)
        // a campaign chapter is fought again as itself (its bend included); another battle leaves it
        if (this.campaign && !want.scenario) { this.campaignBattle((want.difficulty as Difficulty) ?? s.difficulty); return }
        this.campaign = null
        this.newScenario((want.scenario as ScenarioId) ?? s.scenario, s.seed + 1,
          (want.difficulty as Difficulty) ?? s.difficulty)
        return
      }
      case 'campaign': {
        const want = parseArgs(arg), d = (want.difficulty as Difficulty) ?? s.difficulty
        if ('next' in want) {
          const c = this.campaign
          if (!c || s.phase !== 'over') return
          c.won[c.chapter] = s.winner === s.human
          c.chapter += 1
          if (c.chapter >= CHAPTERS.length) {
            this.campaign = null
            this.savedChapter = null
            saveCampaign(null)
            this.hud.briefing({ kicker: CAMPAIGN.title, head: 'Epilogue', history: CAMPAIGN.real,
              yours: CAMPAIGN.ending(c.won), button: 'Close the book',
              timeline: CAMPAIGN.chapters.map((ch, i) => [CAMPAIGN.short(i), ch.real, ch.then[c.won[i] ? 0 : 1]]) })
            return
          }
        } else this.campaign = ('continue' in want && loadCampaign()) || { chapter: 0, won: [] }
        this.campaignBattle(d)
        return
      }
      case 'speed': this.player.speed = this.player.speed === 1 ? 2 : 1; this.publish([]); return
      case 'mute': this.audio.setMuted(!this.audio.muted()); this.publish([]); return
      case 'staff': {
        this.staff = !this.staff
        this.rig.override(this.staff ? { pitch: 88, dist: 1.45, tz: 0 } : null)
        return
      }
      case 'pivot-l': case 'pivot-r': {
        if (!this.selected) return
        const u = s.units.find((x) => x.id === this.selected)
        if (!u) return
        const facing = ((u.facing + (cmd === 'pivot-r' ? 1 : 5)) % 6) as Unit['facing']
        const a = this.ownActions(u.id).find((x) => x.t === 'pivot' && x.facing === facing)
        if (a) await this.commit(a)
        else { this.bus.emit('audio', { cue: 'invalid' }); this.hud.banner(`${u.name} cannot pivot now.`) }
        return
      }
      case 'barrage': case 'gas': case 'creep': {
        if (s.phase !== 'player-orders') return
        const want: Mode = cmd
        const ok = legal(s).some((a) => (want === 'creep' ? a.t === 'creep' : a.t === 'barrage' && a.shell === (want === 'gas' ? 'gas' : 'he')))
        if (!ok) {
          this.bus.emit('audio', { cue: 'invalid' })
          this.hud.banner(this.armWhyNot(want))
          return
        }
        this.mode = this.mode === want ? 'play' : want
        this.selected = null
        this.hud.banner(this.mode === 'play' ? 'Battery stood down.'
          : want === 'creep' ? 'Creeping barrage: click a hex — it and its two neighbours in the row are shelled, then the fire walks on.'
            : want === 'gas' ? 'Gas: click a hex to shell it; the cloud drifts downwind.'
              : 'Battery: click a hex to shell it.')
        this.overlayDirty = true
        return
      }
      case 'sluice': {
        if (s.phase !== 'player-orders') return
        const a = legal(s).find((x) => x.t === 'sluice')
        if (!a) {
          this.bus.emit('audio', { cue: 'invalid' })
          this.hud.banner(!SCENARIOS[s.scenario].sluice ? 'There is no sluice in this battle.'
            : s.sluiceUsed ? 'The sluice is already open.' : 'No orders left this round.')
          return
        }
        this.selected = null
        this.mode = 'play'
        await this.commit(a)
        return
      }
      case 'deselect': this.deselect(); return
      case 'next-piece': {
        const mine = s.units.filter((u) => u.side === s.human && u.str > 0 && this.ownActions(u.id).length > 0)
        if (mine.length === 0) { this.hud.banner('Every piece has its order. Ring the bell.'); return }
        const i = mine.findIndex((u) => u.id === this.selected)
        this.select(mine[(i + 1) % mine.length].id)
        return
      }
      case 'zoom-in': this.rig.zoom(-1); return
      case 'zoom-out': this.rig.zoom(1); return
      case 'yaw-l': this.rig.yaw(-(Number(arg) || 5)); return
      case 'yaw-r': this.rig.yaw(Number(arg) || 5); return
      case 'skip-intro': this.skipIntro(); return
      case 'tutorial-skip': this.tutorAt = 0; this.hud.tutorial(-1); return
      case 'menu': {
        const want = parseArgs(arg)
        if (want.reduced !== undefined) this.setReducedMotion(want.reduced === 'on' || want.reduced === 'true')
        return
      }
    }
  }

  // Without the tutor (a restart, Veteran, General) round 1 still opens on the one thing to do: an
  // outside review found "no clear first move" beyond the objective card.
  private firstHint(): void {
    const s = this.state
    if (this.tutorAt > 0 || this.mode === 'intro' || s.round !== 1 || s.phase !== 'player-orders' || this.undo.length > 0) return
    const red = new Set(s.intents.map((i) => i.target))
    const u = s.units.find((x) => x.side === s.human && x.str > 0 && red.has(x.hex))
    this.hud.banner(u ? `Red ink on ${hexName(u.hex)}: ${u.name} stands under the shells. Pick it up and move it before the bell.`
      : `${SCENARIO[s.scenario].goal} Pick up one of your pieces to see where it can go.`)
  }

  // The enemy's turn, told order by order in the banner: an outside review could not see what the
  // AI had done ("a 4 s wait and a small banner").
  private narrate(a: Action): string | null {
    const s = this.state
    const who = 'unit' in a ? s.units.find((u) => u.id === a.unit) : undefined
    const at = (h: HexId): string => { const u = this.unitAt(h); return u ? `${u.name} at ${hexName(h)}` : hexName(h) }
    switch (a.t) {
      case 'move': return who ? `${who.name} advances to ${hexName(a.to)}.` : null
      case 'assault': return who ? `${who.name} storms ${at(a.target)}!` : null
      case 'fire': return who ? `${who.name} fires on ${at(a.target)}.` : null
      case 'cut': return who ? `${who.name} cuts the wire at ${hexName(a.target)}.` : null
      case 'barrage': return a.shell === 'gas' ? `Gas shells ranged on ${hexName(a.target)}: red ink for the next bell.`
        : `Their battery ranges on ${hexName(a.target)}: red ink for the next bell.`
      default: return null
    }
  }

  // Why the battery cannot be armed with that shell: said out loud, never a silent no-op.
  private armWhyNot(want: Mode): string {
    const s = this.state, me = s.human
    if (s.ordersLeft <= 0) return 'No orders left this round. Ring the bell.'
    if (want === 'creep') {
      if (!SCENARIOS[s.scenario].creep || me !== 'BR') return 'No creeping barrage in this battle.'
      if (s.creep) return 'A creeping barrage is already walking.'
      return `The creeping barrage needs 3 HE shells (the battery has ${s.shells[me].he}).`
    }
    if (want === 'gas') return s.shells[me].gas > 0 ? 'No observer can see a target for gas.' : 'The battery has no gas shells in this battle.'
    return s.shells[me].he > 0 ? 'No observer can see a target.' : 'The battery has no HE left.'
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on
    this.rig.reducedMotion = on
    this.board.setReducedMotion(on)
    this.room.setReducedMotion(on)
  }

  // ---------------------------------------------------------------------------------------------
  //  Views
  // ---------------------------------------------------------------------------------------------

  hexScreen(h: HexId): { x: number; y: number } {
    const p = this.board.hexToLocal(h)
    this.room.tableTop.updateWorldMatrix(true, false)
    p.applyMatrix4(this.room.tableTop.matrixWorld).project(this.camera)
    const r = this.canvas.getBoundingClientRect()
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }
  }

  // How far apart two neighbouring hexes stand on screen around `h`, so the HUD's tag can step
  // clear of the hovered hex AND its neighbours whatever the zoom.
  private hexPx(h: HexId): number {
    const p = this.hexScreen(h), q = this.hexScreen(h % COLS < COLS - 1 ? h + 1 : h - 1)
    return Math.hypot(q.x - p.x, q.y - p.y)
  }

  private overlay(): void {
    const s = this.state
    // Red ink never lies: a gas intent lands on its target AND the two hexes downwind, so every
    // hex of the cloud is inked (as a copy of the intent with its own id), not just the target.
    const ink: Intent[] = []
    for (const i of s.intents) {
      if (i.kind !== 'gas') { ink.push(i); continue }
      footprint(s, i).forEach((h, k) => ink.push(k === 0 ? i : { ...i, id: -(i.id * 10 + k), target: h }))
    }
    const o: Overlay = { reach: [], path: [], fans: [], intents: ink, danger: [], targets: [],
      selected: this.selected, hover: this.hover, cursor: this.cursor }
    for (const u of s.units) {
      if (u.kind === 'mg' && u.str > 0 && u.suppressedUntil < s.round) o.fans.push({ hexes: fan(s, u.id), side: u.side })
    }
    if (this.selected && s.phase === 'player-orders') {
      const r = reach(s, this.selected)
      o.reach = [...r.keys()]
      if (this.hover !== null) o.path = r.get(this.hover)?.path ?? []
      for (const a of this.ownActions(this.selected)) {
        if (a.t === 'assault' || a.t === 'fire' || a.t === 'cut') o.targets.push(a.target)
      }
    }
    if (this.mode === 'barrage' || this.mode === 'gas') {
      const shell = this.mode === 'gas' ? 'gas' : 'he'
      for (const a of legal(s)) if (a.t === 'barrage' && a.shell === shell) o.targets.push(a.target)
    }
    if (this.mode === 'creep' && this.hover !== null) {
      const a = this.actionFor(this.hover)
      if (a && a.t === 'creep') o.targets.push(...a.hexes) // the three hexes the walk starts on
    }
    if (this.hover !== null) {
      const there = this.unitAt(this.hover)
      if (there && there.side !== s.human && there.kind === 'mg') o.danger = fan(s, there.id)
    }
    this.board.overlay(o)
  }

  private forecastNow(): { f: Forecast | null; anchor: { x: number; y: number } | null } {
    if (this.hover === null || this.state.phase !== 'player-orders') return { f: null, anchor: null }
    const a = this.actionFor(this.hover)
    if (!a) return { f: null, anchor: null }
    return { f: forecast(this.state, a), anchor: this.hexScreen(this.hover) }
  }

  private publish(events: GameEvent[]): void {
    // where every piece last stood: a piece wiped out has already left the state when its
    // 'destroyed' event plays, and its result still needs a place on the board
    for (const u of this.state.units) this.lastSeen.set(u.id, { hex: u.hex, side: u.side })
    this.bus.emit('state', { state: this.state, events })
  }
  private readonly lastSeen = new Map<string, { hex: HexId; side: Side }>()
  private lossSaidAt = -Infinity

  // ---------------------------------------------------------------------------------------------
  //  Frame
  // ---------------------------------------------------------------------------------------------

  private update(dt: number, t: number): void {
    this.frame += 1
    this.clock += dt
    // The establishing shot is the room's: the HUD (all but the title card) waits for the chair.
    this.canvas.parentElement?.classList.toggle('is-intro', this.mode === 'intro')
    if (dt > 1 / 40) this.slowT += dt
    else this.slowT = Math.max(0, this.slowT - dt * 0.5)
    if (this.slowT > 3 && this.maxDpr > 1) {
      this.maxDpr = 1
      this.slowT = 0
      console.info('[quality] sustained frames under 40 fps: pixel ratio capped at 1')
    }
    if (resizeRenderer(this.renderer, this.camera, this.maxDpr)) {
      const c = this.renderer.domElement
      this.room.resize(c.clientWidth, c.clientHeight, this.renderer.getPixelRatio())
      this.rig.setAspect(this.camera.aspect)
    }
    if (!this.paused) {
      if (this.mode === 'intro') {
        this.introT += dt
        if (this.introPush && this.introT > 1.2 && this.rig.stop === 'hall') this.rig.setStop('approach', false, 1.9)
        if (this.introT > INTRO_S) this.skipIntro()
      }
      const at = this.reducedMotion ? 0 : t
      this.rig.update(dt)
      this.room.update(this.reducedMotion ? 0 : dt, at)
      this.board.update(this.reducedMotion ? 0 : dt, at)
    }
    const p = this.camera.position
    this.audio.setListener(p.x, p.y, p.z)
    if (this.overlayDirty) { this.overlayDirty = false; this.overlay() }
    const fc = this.forecastNow()
    this.hud.render(this.state, {
      selected: this.selected, forecast: fc.f, anchor: fc.anchor, busy: this.player.busy,
      rewindsLeft: this.rewindsLeft, speed: this.player.speed, muted: this.audio.muted(),
      armed: this.mode === 'barrage' || this.mode === 'gas' || this.mode === 'creep' ? this.mode : null,
      hexPx: this.hover === null ? undefined : this.hexPx(this.hover), campaign: this.savedChapter, chapter: this.campaign?.chapter ?? null,
    })
  }

  private render(): void { this.room.render(this.scene, this.camera) }
}

function parseArgs(arg?: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!arg) return out
  for (const part of arg.split(/[;&,]/)) {
    const [k, v] = part.split(/[=:]/)
    if (k) out[k.trim()] = (v ?? '').trim()
  }
  return out
}
