import { FUSE_SEARCH_THRESHOLD } from '../constants/app.js';

/**
 * @template T
 * @param {T[]} corpus
 * @param {string} query
 * @param {(item: T) => string} getHaystack
 * @returns {T[]}
 */
export function filterCorpusByFuseSearch(corpus, query, getHaystack) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return corpus.slice();
  if (typeof Fuse !== 'undefined') {
    const indexed = corpus.map((item) => ({ item, _h: getHaystack(item) }));
    const fuse = new Fuse(indexed, {
      keys: ['_h'],
      threshold: FUSE_SEARCH_THRESHOLD,
      ignoreLocation: true,
    });
    return fuse.search(trimmed).map((r) => r.item.item);
  }
  const low = trimmed.toLowerCase();
  return corpus.filter((item) => getHaystack(item).toLowerCase().indexOf(low) !== -1);
}
