export interface PaperPreset {
  id: string;
  name: string;
  hint: string;
  kind: number;
  tint: string;
  fleck: string;
  bump: number;
  mottle: number;
}

export const PAPERS: PaperPreset[] = [
  { id: 'cold', name: 'Cold Press', hint: 'Medium tooth, natural white', kind: 0, tint: '#f6f3ec', fleck: '#8a8070', bump: 1.0, mottle: 0.05 },
  { id: 'hot', name: 'Hot Press', hint: 'Smooth bright cotton', kind: 1, tint: '#f8f7f3', fleck: '#8a8478', bump: 0.6, mottle: 0.04 },
  { id: 'rough', name: 'Rough', hint: 'Deep knobbly tooth', kind: 2, tint: '#f5f1e8', fleck: '#857a68', bump: 0.8, mottle: 0.06 },
  { id: 'khadi', name: 'Khadi', hint: 'Handmade cotton rag', kind: 3, tint: '#efe7d6', fleck: '#6d5f4a', bump: 1.0, mottle: 0.12 },
  { id: 'washi', name: 'Washi', hint: 'Japanese kozo fibres', kind: 4, tint: '#f1ece0', fleck: '#7a6a52', bump: 0.8, mottle: 0.14 },
  { id: 'canvas', name: 'Canvas', hint: 'Primed cotton weave', kind: 6, tint: '#f3efe6', fleck: '#8a8070', bump: 1.0, mottle: 0.04 },
];

export const DEFAULT_PAPER = PAPERS[0];

export function linearRGB(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)];
}
