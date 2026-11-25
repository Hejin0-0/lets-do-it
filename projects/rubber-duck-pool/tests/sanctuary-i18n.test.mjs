import assert from 'node:assert/strict';
import test from 'node:test';
import ko from '../src/sanctuary/i18n/ko.json' with { type: 'json' };
import en from '../src/sanctuary/i18n/en.json' with { type: 'json' };
import ja from '../src/sanctuary/i18n/ja.json' with { type: 'json' };
import { SUPPORTED_LANGS, LANG_KEY, translate, createI18n } from '../src/sanctuary/i18n.js';

function flattenKeys(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flattenKeys(v, key));
    else out.push(key);
  }
  return out.sort();
}

test('ko, en and ja dictionaries have identical keys and non-empty strings', () => {
  assert.deepEqual(SUPPORTED_LANGS, ['ko', 'en', 'ja']);
  const koKeys = flattenKeys(ko);
  const enKeys = flattenKeys(en);
  const jaKeys = flattenKeys(ja);

  assert.deepEqual(enKeys, koKeys);
  assert.deepEqual(jaKeys, koKeys);

  for (const k of koKeys) {
    for (const lang of SUPPORTED_LANGS) {
      const val = translate(lang, k);
      assert.equal(typeof val, 'string');
      assert.ok(val.trim().length > 0, `empty translation for ${lang}:${k}`);
    }
  }
});

test('i18n interpolates variables, persists language choice, and notifies subscribers', () => {
  const map = new Map();
  const store = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };

  const i18n = createI18n('ko', store);
  const seen = [];
  const off = i18n.onChange((lang) => seen.push(lang));

  assert.equal(i18n.getLang(), 'ko');
  assert.ok(i18n.t('toast.atelierJoined', { name: 'Sunny' }).includes('Sunny'));

  assert.equal(i18n.setLang('ja'), true);
  assert.equal(i18n.getLang(), 'ja');
  assert.equal(store.getItem(LANG_KEY), 'ja');
  assert.deepEqual(seen, ['ja']);

  // Invalid language code is rejected cleanly
  assert.equal(i18n.setLang('xx'), false);
  assert.equal(i18n.getLang(), 'ja');

  // Unsubscribing stops callbacks; reloaded instance restores saved language
  off();
  i18n.setLang('en');
  assert.deepEqual(seen, ['ja']);

  const reloaded = createI18n('ko', store);
  assert.equal(reloaded.getLang(), 'en');
  assert.equal(reloaded.t('missing.key.xyz'), 'missing.key.xyz');
});
