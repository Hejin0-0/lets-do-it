import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortalHref, parsePortalQuery } from '../src/sanctuary/portal-link.js';

test('portal links build relative URLs with validated hour and mute handoff', () => {
  assert.equal(buildPortalHref('sanctuary.html'), './sanctuary.html');
  assert.equal(
    buildPortalHref('sanctuary.html', { hour: 18.25, muted: false }),
    './sanctuary.html?hour=18.25'
  );
  assert.equal(
    buildPortalHref('index.html', { hour: 25.5, muted: true }),
    './index.html?hour=1.50&muted=1'
  );
});

test('portal query parser extracts hour and muted state and ignores invalid values', () => {
  assert.deepEqual(parsePortalQuery('?hour=18.25&muted=1'), { hour: 18.25, muted: true });
  assert.deepEqual(parsePortalQuery('?hour=6&muted=0'), { hour: 6, muted: false });
  assert.deepEqual(parsePortalQuery('?hour=abc&muted=maybe'), { hour: null, muted: null });
  assert.deepEqual(parsePortalQuery(''), { hour: null, muted: null });
});
