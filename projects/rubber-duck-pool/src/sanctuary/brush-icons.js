// Visual brush silhouette & textured stroke preview SVGs for the Watercolor Atelier UI.
// Combines crisp brush-head icons with dynamic pigment-tinted stroke previews (`currentColor`).

export const TOOL_ICONS = {
  brush: {
    label: '붓 (Brush)',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18.6 3.6a1.9 1.9 0 0 1 2.7 2.7l-8.4 8.4-2.8-2.8 8.5-8.3z"/>
      <path d="M10.1 11.9c-2.6.5-4.3 2.2-4.6 4.7-.2 1.3-.9 2.3-2 2.9 2.6.6 5.5-.1 7.2-1.8 1.2-1.2 1.8-2.6 2.2-3"/>
      <path d="M11.6 10.4l2.8 2.8"/>
    </svg>`,
  },
  water: {
    label: '물칠 (Water)',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 3.2c-3.4 4.7-6 8-6 11.3a6 6 0 1 0 12 0c0-3.3-2.6-6.6-6-11.3z"/>
      <path d="M9.4 15.2a2.7 2.7 0 0 0 2.6 2.4"/>
    </svg>`,
  },
  pen: {
    label: '펜 (Ink Pen)',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 19.5l7.2-7.2-7.5-7.5L4.5 12l2.1 7.4L12 19.5z"/>
      <path d="M15.8 5.2l3 3"/>
      <path d="M4.5 19.5l5.4-5.4"/>
      <circle cx="11.2" cy="12.8" r="1.2" fill="currentColor" stroke="none"/>
    </svg>`,
  },
  lift: {
    label: '닦아내기 (Lift)',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5.5 14.5l7.2-7.2a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4l-5.6 5.6H8.9l-3.4-3.4a1.4 1.4 0 0 1 0-2z"/>
      <path d="M10.2 9.8l5 5"/>
      <path d="M4 19h16"/>
    </svg>`,
  },
};

export const SLIDER_ICONS = {
  size: `<svg viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><circle cx="4.5" cy="9" r="1.8" opacity=".45"/><circle cx="9.2" cy="9" r="2.7" opacity=".72"/><circle cx="14.2" cy="9" r="3.4"/></svg>`,
  water: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2.5C6.5 6 4.8 8.3 4.8 10.7a4.2 4.2 0 1 0 8.4 0C13.2 8.3 11.5 6 9 2.5z"/></svg>`,
  load: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="9" r="5.6"/><path d="M9 3.4a5.6 5.6 0 0 1 0 11.2z" fill="currentColor"/></svg>`,
};

// Each entry matches a BRUSH_PRESETS id from watercolor/brushes.ts:
// - toolSvg: clean line-art brush head silhouette (24x24)
// - strokeSvg: expressive textured brush stroke mark (64x18, tinted by active pigment via currentColor)
export const BRUSH_VISUALS = {
  round: {
    ko: '둥근 붓',
    toolSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18.2 3.2c1 1 .8 2.4-.2 3.5l-5.8 5.9-2.8-2.8 5.9-5.8c1.1-1 2.1-1.6 2.9-.8z"/>
      <path d="M9.4 9.8c-2.2.8-3.4 2.5-3.9 5-.3 1.4-1 2.2-2 2.8 2.4.6 5.1-.1 6.8-1.7 1.2-1.1 1.7-2.2 1.9-3.3z"/>
    </svg>`,
    strokeSvg: `<svg viewBox="0 0 64 18" fill="currentColor" aria-hidden="true">
      <path d="M4 11.5C15 5 29 5 41 9.5c7.5 2.7 14 2.6 19-1.2 1.2-.9 2.2.6 1 1.9-5.8 5.4-14 5.2-22 2.2-10-3.7-21-3.3-32 1.7-2.2 1-4.6-1.5-3-2.6z" opacity=".92"/>
      <path d="M9 10.6c11-4.2 22-3.8 32 .2 6 2.4 11.8 2.2 16.5-.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".45"/>
    </svg>`,
  },
  detail: {
    ko: '세필 붓',
    toolSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M19.5 4.5l-9.2 9.2-1.4-1.4 9.2-9.2a1 1 0 0 1 1.4 1.4z"/>
      <path d="M8.9 12.3c-1.8.6-3.2 2-4.6 5.4 3.4-1.4 4.8-2.8 5.4-4.6"/>
    </svg>`,
    strokeSvg: `<svg viewBox="0 0 64 18" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true">
      <path d="M5 12.2C17 6.2 31 6.5 43 10.6c6.5 2.2 12 2.1 16.8-.9" stroke-width="2.1"/>
      <path d="M8 11.8C19 7.2 31 7.4 42 11" stroke-width=".9" opacity=".4"/>
    </svg>`,
  },
  flat: {
    ko: '납작 붓',
    toolSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M7 4h10l-1 5.5H8L7 4z"/>
      <path d="M8 9.5h8v2.8c0 .8-.5 1.5-1.3 1.8l-.9.4v5a1.8 1.8 0 0 1-3.6 0v-5l-.9-.4A2 2 0 0 1 8 12.3V9.5z"/>
      <path d="M10.2 4v3.2M13.8 4v3.2"/>
    </svg>`,
    strokeSvg: `<svg viewBox="0 0 64 18" fill="currentColor" aria-hidden="true">
      <path d="M5 5.4l53.5-.8 1.4 8.2-53.8.9L5 5.4z" opacity=".88"/>
      <path d="M6.5 7.4h51M7 11.4h49" stroke="rgba(255,255,255,0.28)" stroke-width=".9"/>
    </svg>`,
  },
  hake: {
    ko: '넓은 평붓',
    toolSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4.2 4.5h15.6l-1.1 5.2H5.3L4.2 4.5z"/>
      <path d="M5.3 9.7h13.4v2.3c0 1.2-1 2.2-2.2 2.2h-2.3v5.1a2.2 2.2 0 0 1-4.4 0v-5.1H7.5a2.2 2.2 0 0 1-2.2-2.2V9.7z"/>
      <path d="M7.5 4.5v3M10.5 4.5v3M13.5 4.5v3M16.5 4.5v3"/>
    </svg>`,
    strokeSvg: `<svg viewBox="0 0 64 18" fill="currentColor" aria-hidden="true">
      <rect x="4" y="3.2" width="56" height="11.6" rx="2.2" opacity=".48"/>
      <path d="M4 5.2h55M5 8.2h54M4 11.2h55M6 13.6h52" stroke="currentColor" stroke-width="1.5" stroke-dasharray="18 2 14 2 22" opacity=".78"/>
    </svg>`,
  },
  mop: {
    ko: '모프 워시 붓',
    toolSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18.6 3.6a1.6 1.6 0 0 1 2.2 2.2l-5.6 5.6-2.2-2.2 5.6-5.6z"/>
      <path d="M13 9.2c-2.6-.3-5.3 1-6.9 3.2-1.5 2-2 4.4-1.5 6.4 2.1.6 4.8.1 6.9-1.5 2.2-1.7 3.2-4.1 2.9-6.6"/>
      <path d="M7.4 13.5c1.1 1.2 2.1 2 3.4 2.5"/>
    </svg>`,
    strokeSvg: `<svg viewBox="0 0 64 18" fill="currentColor" aria-hidden="true">
      <ellipse cx="32" cy="9" rx="26" ry="6.2" opacity=".32"/>
      <path d="M9 10.6c7-5.4 17-5.8 25-2.6 8 3.2 15.5 3.1 22-1.2 2.2-1.5 4.2 1.8 1.6 4-7.4 6.2-17.6 5.6-26.6 2.1-8.2-3.2-15.6-2.8-21.5 1.2-2.8 1.9-3.2-1.5-.5-3.5z" opacity=".72"/>
    </svg>`,
  },
  dry: {
    ko: '갈필(드라이)',
    toolSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M17.5 3.5l3 3-6.2 6.2-3-3 6.2-6.2z"/>
      <path d="M11.3 9.7l-5.6 3.5M12.3 10.8l-5.2 5.2M13.4 11.8l-3.6 6.2M14.3 12.7l-1.5 6.6"/>
    </svg>`,
    strokeSvg: `<svg viewBox="0 0 64 18" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true">
      <path d="M4 5.5h22M31 5.5h15M50 5.5h9" stroke-width="1.8"/>
      <path d="M6 8.8h14M24 8.8h24M52 8.8h8" stroke-width="2.2" opacity=".9"/>
      <path d="M4 12.2h27M36 12.2h12M53 12.2h6" stroke-width="1.6" opacity=".75"/>
      <path d="M9 14.8h10M25 14.8h18" stroke-width="1.1" opacity=".5"/>
    </svg>`,
  },
  fan: {
    ko: '부채 붓',
    toolSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 7.5A12 12 0 0 1 20 7.5l-4.5 5.3h-7L4 7.5z"/>
      <path d="M8.5 12.8h7l-1.6 2.5v4.5a1.9 1.9 0 0 1-3.8 0v-4.5l-1.6-2.5z"/>
      <path d="M8.3 5.5L10.4 11M12 4.7V11M15.7 5.5L13.6 11"/>
    </svg>`,
    strokeSvg: `<svg viewBox="0 0 64 18" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true">
      <path d="M5 5.2c18-2.2 36 2.2 54 0" stroke-width="1.2" opacity=".82"/>
      <path d="M4 8.1c19-1.8 37 1.8 56 0" stroke-width="1.25" opacity=".92"/>
      <path d="M5 11c18-1.5 36 1.6 54 0" stroke-width="1.2" opacity=".85"/>
      <path d="M6 13.8c17-1.4 35 1.5 52 0" stroke-width="1.1" opacity=".7"/>
    </svg>`,
  },
  sponge: {
    ko: '스펀지',
    toolSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="7.5" y="3.5" width="9" height="10" rx="2.6"/>
      <path d="M10.4 13.5h3.2v5.8a1.6 1.6 0 0 1-3.2 0v-5.8z"/>
      <circle cx="10.2" cy="6.6" r=".7" fill="currentColor" stroke="none"/>
      <circle cx="13.8" cy="7.4" r=".7" fill="currentColor" stroke="none"/>
      <circle cx="11.5" cy="10.2" r=".7" fill="currentColor" stroke="none"/>
      <circle cx="14.2" cy="10.8" r=".6" fill="currentColor" stroke="none"/>
    </svg>`,
    strokeSvg: `<svg viewBox="0 0 64 18" fill="currentColor" aria-hidden="true">
      <circle cx="11" cy="9" r="4.5" opacity=".45"/><circle cx="17" cy="11" r="3.6" opacity=".68"/>
      <circle cx="23" cy="7.5" r="4.8" opacity=".55"/><circle cx="30" cy="10.2" r="4.4" opacity=".75"/>
      <circle cx="37" cy="8.2" r="4.6" opacity=".58"/><circle cx="44" cy="10.4" r="4.2" opacity=".70"/>
      <circle cx="51" cy="8.6" r="4.4" opacity=".50"/><circle cx="56" cy="10.5" r="2.8" opacity=".42"/>
      <circle cx="20" cy="9.2" r="1.5" fill="#f8f4ea" opacity=".55"/><circle cx="35" cy="9.8" r="1.4" fill="#f8f4ea" opacity=".5"/>
    </svg>`,
  },
  spatter: {
    ko: '흩뿌리기',
    toolSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M14.5 11.5l5.5-5.5a1.5 1.5 0 0 1 2.1 2.1l-5.5 5.5-2.1-2.1z"/>
      <path d="M14.5 11.5l-3.6 3.6c-.8.8-2.1.8-2.9 0l-.5-.5c-.8-.8-.8-2.1 0-2.9l3.6-3.6"/>
      <circle cx="5.5" cy="7.2" r="1.4" fill="currentColor" stroke="none"/>
      <circle cx="9.2" cy="4.6" r="1" fill="currentColor" stroke="none"/>
      <circle cx="4.5" cy="12" r=".9" fill="currentColor" stroke="none"/>
      <circle cx="7.4" cy="17.8" r="1.3" fill="currentColor" stroke="none"/>
      <circle cx="12.2" cy="19.2" r=".9" fill="currentColor" stroke="none"/>
    </svg>`,
    strokeSvg: `<svg viewBox="0 0 64 18" fill="currentColor" aria-hidden="true">
      <circle cx="8" cy="10" r="2.2" opacity=".82"/><circle cx="14" cy="6.2" r="1.4" opacity=".68"/>
      <circle cx="19" cy="12.4" r="2.8" opacity=".88"/><circle cx="25" cy="7.5" r="1.8" opacity=".76"/>
      <circle cx="31" cy="11.5" r="3.1" opacity=".90"/><circle cx="37" cy="5.5" r="1.3" opacity=".64"/>
      <circle cx="41" cy="10.2" r="2.4" opacity=".84"/><circle cx="48" cy="12.8" r="1.9" opacity=".72"/>
      <circle cx="53" cy="7.2" r="2.6" opacity=".80"/><circle cx="59" cy="10.4" r="1.4" opacity=".62"/>
    </svg>`,
  },
  sumi: {
    ko: '먹붓(수묵)',
    toolSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 2.8v9.4"/>
      <rect x="10.3" y="2.8" width="3.4" height="9.4" rx="1"/>
      <path d="M10.1 12.2h3.8c.7 2.8.3 5.8-1.9 8.8-2.2-3-2.6-6-1.9-8.8z"/>
      <path d="M10.3 6.2h3.4M10.3 9.2h3.4"/>
    </svg>`,
    strokeSvg: `<svg viewBox="0 0 64 18" fill="currentColor" aria-hidden="true">
      <path d="M5 10.8C13 4 23 3.4 33 7.6c8.5 3.6 18 3.2 27.5.6.9-.2 1.1.8.2 1.4-9.5 4.8-19.6 5.4-29.7 2.1-8.8-2.9-16.5-2.6-23.6 2.2-2.6 1.8-4.8-1.1-2.4-3.1z"/>
    </svg>`,
  },
};

// Organic hand-brushed watercolor dab SVG for pigment palette buttons (tinted via currentColor)
export const PALETTE_DAB_SVG = `<svg viewBox="0 0 28 28" fill="currentColor" aria-hidden="true">
  <path d="M14.6 3.2c4.4-.5 9.1 2.2 10.2 6.5 1.1 4.2-.8 9.6-4.7 12.3-3.9 2.7-9.8 2.9-13.6.2C2.7 19.5 1.8 13.7 3.7 9.4 5.6 5.1 10.2 3.7 14.6 3.2z"/>
  <ellipse cx="10.8" cy="9.4" rx="3.8" ry="2.1" fill="#ffffff" opacity=".26" transform="rotate(-24 10.8 9.4)"/>
</svg>`;
