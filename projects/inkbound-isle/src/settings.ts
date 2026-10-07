export type QualityLevel = 'low' | 'medium' | 'high';

export interface GameSettings {
  volume: number;
  fov: number;
  sensitivity: number;
  quality: QualityLevel;
  reducedMotion: boolean;
}

export const SETTINGS_KEY = 'inkbound-isle-settings-v1';
export const DEFAULT_SETTINGS: Readonly<GameSettings> = {
  volume: 0.72,
  fov: 70,
  sensitivity: 1,
  quality: 'high',
  reducedMotion: false,
};

const bounded = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;

export function parseSettings(raw: string | null): GameSettings {
  let value: unknown;
  try {
    value = raw ? JSON.parse(raw) : null;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_SETTINGS };
  const data = value as Record<string, unknown>;
  if (data.version !== 1) return { ...DEFAULT_SETTINGS };
  return {
    volume: bounded(data.volume, 0, 1, DEFAULT_SETTINGS.volume),
    fov: bounded(data.fov, 60, 95, DEFAULT_SETTINGS.fov),
    sensitivity: bounded(data.sensitivity, 0.4, 2.2, DEFAULT_SETTINGS.sensitivity),
    quality: ['low', 'medium', 'high'].includes(String(data.quality))
      ? data.quality as QualityLevel : DEFAULT_SETTINGS.quality,
    reducedMotion: typeof data.reducedMotion === 'boolean'
      ? data.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
  };
}

export function serializeSettings(settings: GameSettings): string {
  return JSON.stringify({ version: 1, ...settings });
}
