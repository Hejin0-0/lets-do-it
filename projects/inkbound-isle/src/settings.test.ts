import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_SETTINGS, parseSettings, serializeSettings } from './settings.ts';

describe('bounded player settings', () => {
  it('round-trips supported settings', () => {
    const settings = {
      volume: 0.4,
      fov: 84,
      sensitivity: 1.3,
      quality: 'medium' as const,
      reducedMotion: true,
    };
    assert.deepEqual(parseSettings(serializeSettings(settings)), settings);
  });

  it('uses safe defaults for corrupt data and clamps numeric ranges', () => {
    assert.deepEqual(parseSettings('{broken'), DEFAULT_SETTINGS);
    assert.deepEqual(parseSettings(JSON.stringify({
      version: 1,
      volume: 5,
      fov: 20,
      sensitivity: 99,
      quality: 'cinematic',
      reducedMotion: 'yes',
    })), {
      ...DEFAULT_SETTINGS,
      volume: 1,
      fov: 60,
      sensitivity: 2.2,
    });
  });
});
