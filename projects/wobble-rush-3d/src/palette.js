/** One place for the toy-box colours, so the scene and the CSS stay in sync. */
export const PALETTE = {
  ink: 0x1b2244,
  cream: 0xfff8ec,

  skyTop: 0x5fbdf5,
  skyBottom: 0xffe3f0,
  haze: 0xbfe8ff,

  startDeck: 0xffd23f,
  runway: 0x6fe3c4,
  movingDeck: 0xff8fab,
  island: 0xffb26b,
  bumperDeck: 0xb892ff,
  bridge: 0xffa552,
  ramp: 0x6ec9ff,
  finishDeck: 0x9dff9a,

  sweeperBar: 0xff5d73,
  sweeperStripe: 0xfff8ec,
  post: 0x4a5390,
  bumper: 0xffe066,
  bumperCap: 0xff6fa5,

  gate: 0xffd23f,
  gateGlow: 0x37e0b0,

  playerBody: 0x7b6cf6,
  playerBelly: 0xfff3d6,
  playerVisor: 0x37e0b0,
  playerLimb: 0x5a4ed4,

  checkpointOff: 0x6d7ac6,
  checkpointOn: 0x18d69c,

  cloud: 0xfff8ec,
  balloonA: 0xff6fa5,
  balloonB: 0xffd23f,
  balloonC: 0x7b6cf6,
};

/** Confetti/particle colour sets, keyed by the effect that fires them. */
export const BURST_COLORS = {
  land: [0xfff8ec, 0xdfe9ff, 0xbfe8ff],
  jump: [0xfff8ec, 0xbfe8ff],
  dive: [0x37e0b0, 0x7fd4ff, 0xfff8ec],
  bump: [0xffd23f, 0xff6fa5, 0xfff8ec],
  sweep: [0xff5d73, 0xffd23f, 0xfff8ec],
  checkpoint: [0x37e0b0, 0xffd23f, 0xff6fa5, 0xfff8ec],
  respawn: [0xff6fa5, 0x7b6cf6, 0xfff8ec],
  finish: [0xffd23f, 0xff6fa5, 0x37e0b0, 0x7b6cf6, 0xfff8ec, 0x7fd4ff],
};
