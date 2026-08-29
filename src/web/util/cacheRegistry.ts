type ClearFn = () => void;
const clearers: ClearFn[] = [];

/** Register a cache clearer; invoked by `clearAllCaches` when download paths change. */
export function registerCacheClear(fn: ClearFn): void {
  clearers.push(fn);
}

export function clearAllCaches(): void {
  for (const fn of clearers) {
    fn();
  }
}
