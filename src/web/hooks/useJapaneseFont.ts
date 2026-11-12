/** Memoized Japanese-detection cache used to pick the display font per string. */
const JA_RE = /[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/;

const cache = new Map<string, boolean>();
/** Bounds the cache: album titles churn across refreshes, so an unbounded map leaks. */
const CACHE_LIMIT = 1000;

export function hasJapanese(text: string): boolean {
  const hit = cache.get(text);
  if (hit !== undefined) {
    return hit;
  }
  const result = JA_RE.test(text);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(text, result);
  return result;
}
