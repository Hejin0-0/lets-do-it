// The sanctuary's words in Korean, English and Japanese: one JSON dictionary per language (i18n/<lang>.json), looked
// up by dotted key ('book.tabs.secrets') with {name}-style variables.
import ko from './i18n/ko.json' with { type: 'json' };
import en from './i18n/en.json' with { type: 'json' };
import ja from './i18n/ja.json' with { type: 'json' };

export const SUPPORTED_LANGS = ['ko', 'en', 'ja'];
export const LANG_KEY = 'rubber-duck-pool.lang.v1';
const DICTS = { ko, en, ja };
const FALLBACKS = ['en', 'ko'];

function lookup(dict, key) {
  let v = dict;
  for (const part of key.split('.')) {
    if (v === null || typeof v !== 'object') return undefined;
    v = v[part];
  }
  return typeof v === 'string' ? v : undefined;
}

/** The text for key in lang, then in English, then Korean; the key itself when no dictionary has it. A variable the
 * caller did not pass stays as {name}, so a missing value shows instead of vanishing. */
export function translate(lang, key, vars) {
  let s;
  for (const l of [lang, ...FALLBACKS]) {
    s = DICTS[l] && lookup(DICTS[l], key);
    if (s !== undefined) break;
  }
  if (s === undefined) return String(key);
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

/** A language setting, remembered in store (localStorage or the like) when given; a saved choice wins over initialLang. */
export function createI18n(initialLang = 'ko', store = null) {
  let saved = null;
  try { saved = store?.getItem(LANG_KEY) ?? null; } catch { /* storage blocked: keep initialLang */ }
  let lang = SUPPORTED_LANGS.includes(saved) ? saved : SUPPORTED_LANGS.includes(initialLang) ? initialLang : 'ko';
  const listeners = new Set();

  return {
    t: (key, vars) => translate(lang, key, vars),
    getLang: () => lang,
    setLang(next) {
      if (!SUPPORTED_LANGS.includes(next)) return false;
      if (next === lang) return true;
      lang = next;
      try { store?.setItem(LANG_KEY, lang); } catch { /* storage full or blocked: the choice lasts this visit */ }
      for (const fn of listeners) fn(lang);
      return true;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
