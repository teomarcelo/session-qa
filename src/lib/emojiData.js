/**
 * Emoji keyword search.
 *
 * `emojilib` maps a fully-qualified emoji glyph to an array of keywords
 * (e.g. "✅" -> ["check_mark_button","ok","agree","tick",...]). Our pickers use
 * base glyphs that sometimes omit the VS16 variation selector (U+FE0F), so we try
 * a few normalized forms when looking up a glyph.
 *
 * This is plain keyword/substring matching (fast, offline) — not ML "semantic"
 * search, which would be overkill for an emoji picker.
 */
import emojilib from 'emojilib';

const VS16 = '\uFE0F';

function lookupKeywords(ch) {
  if (!ch) return null;
  return (
    emojilib[ch] ||
    emojilib[ch + VS16] ||
    emojilib[ch.replace(new RegExp(VS16, 'g'), '')] ||
    null
  );
}

/** Lowercased, space-separated keyword string for one glyph (empty if unknown). */
export function emojiSearchText(ch) {
  const kw = lookupKeywords(ch);
  if (!kw || !kw.length) return '';
  return kw.join(' ').toLowerCase().replace(/[_-]+/g, ' ');
}

/** Build a Map(glyph -> searchText) once, so filtering doesn't re-lookup. */
export function buildEmojiIndex(chars) {
  const map = new Map();
  (chars || []).forEach(ch => map.set(ch, emojiSearchText(ch)));
  return map;
}

/**
 * Filter glyphs by a query. Multiple words are AND-matched (all must appear),
 * so "red heart" narrows to hearts. Empty query returns the full list.
 */
export function filterEmojiChars(chars, query, index) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return chars;
  const terms = q.split(/\s+/).filter(Boolean);
  return (chars || []).filter(ch => {
    const text = index ? index.get(ch) || '' : emojiSearchText(ch);
    if (!text) return false;
    return terms.every(t => text.includes(t));
  });
}
