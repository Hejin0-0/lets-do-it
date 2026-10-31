import test from 'node:test';
import assert from 'node:assert/strict';
import { bookPage } from '../src/pool/book-view.js';
import { COLLECTIBLES } from '../src/pool/collectibles.js';

test('pages follow the supplied order, show discovery and expose both boundaries', () => {
  const pages = [{ id: 'c', found: false }, { id: 'a', found: true }, { id: 'b', found: true }];
  const titles = { a: 'Alpha', b: 'Bravo', c: 'Charlie' };
  assert.deepEqual(bookPage(pages, -1, titles), { index: 0, count: 3, position: 'Page 1 of 3', state: 'empty', title: null, text: 'Not found yet.', canPrev: false, canNext: true });
  assert.deepEqual(bookPage(pages, 1, titles), { index: 1, count: 3, position: 'Page 2 of 3', state: 'filled', title: 'Alpha', text: 'Found.', canPrev: true, canNext: true });
  assert.deepEqual(bookPage(pages, 99, titles), { index: 2, count: 3, position: 'Page 3 of 3', state: 'filled', title: 'Bravo', text: 'Found.', canPrev: true, canNext: false });
});

test('the real one-item catalogue has one page with both ends unavailable', () => {
  assert.equal(COLLECTIBLES.length, 1);
  const pages = COLLECTIBLES.map(({ id, kind }) => ({ id, kind, found: false, at: null }));
  const empty = bookPage(pages, 0);
  assert.deepEqual(empty, { index: 0, count: 1, position: 'Page 1 of 1', state: 'empty', title: null, text: 'Not found yet.', canPrev: false, canNext: false });
  pages[0].found = true;
  assert.equal(bookPage(pages, 0).title, COLLECTIBLES[0].title);
  assert.equal(bookPage(pages, 0).state, 'filled');
});
