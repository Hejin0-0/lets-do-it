import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeatherSystem, WEATHER_MODES } from '../src/sanctuary/weather.js';

function makeMemoryStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

test('weather cycles cleanly across clear, petals, mist, rain and converges deterministically', () => {
  const store = makeMemoryStore();
  const w = createWeatherSystem({ store });
  assert.equal(w.getMode(), 'clear');
  assert.equal(w.getState().rain, 0);

  const visited = [w.getMode()];
  for (let i = 0; i < WEATHER_MODES.length; i++) {
    visited.push(w.cycleMode());
  }
  assert.deepEqual(visited, ['clear', 'petals', 'mist', 'rain', 'clear']);

  w.setMode('rain');
  for (let i = 0; i < 60; i++) w.step(0.1);
  const rainSt = w.getState();
  assert.ok(rainSt.rain > 0.98, 'rain intensity converges near 1.0');
  assert.ok(rainSt.overcast > 0.70, 'rain raises overcast');

  w.setMode('petals', { immediate: true });
  assert.equal(w.getState().petals, 1.0);
  assert.equal(w.getState().rain, 0.0);

  const w2 = createWeatherSystem({ store });
  assert.equal(w2.getMode(), 'petals', 'persists mode to storage');
});

test('rain audio auto-sync switches weather when not manually locked', () => {
  const w = createWeatherSystem();
  w.syncFromRainAudio(0.55);
  assert.equal(w.getMode(), 'rain');
  w.syncFromRainAudio(0.05);
  assert.equal(w.getMode(), 'clear');

  w.setMode('petals', { manual: true });
  w.syncFromRainAudio(0.8);
  assert.equal(w.getMode(), 'petals', 'respects explicit manual weather choice');
});
