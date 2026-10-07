const PREFIX = 'wobble-rush-3d:';

/**
 * localStorage with the private-browsing case handled once, here.
 *
 * Losing a setting is not worth breaking a run over, so these swallow the
 * exception and fall back to the default — the one deliberate soft path in the
 * codebase. Everything else surfaces its failures.
 */
export function readSetting(key, fallback = null) {
  try {
    const value = window.localStorage.getItem(PREFIX + key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeSetting(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, String(value));
    return true;
  } catch {
    return false;
  }
}

export const SETTINGS = {
  bestTime: 'best',
  character: 'character',
};
