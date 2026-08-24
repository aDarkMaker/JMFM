const JA_RE = /[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/;

const cache = new Map<string, boolean>();

export function hasJapanese(text: string): boolean {
  const hit = cache.get(text);
  if (hit !== undefined) {
    return hit;
  }
  const result = JA_RE.test(text);
  cache.set(text, result);
  return result;
}
