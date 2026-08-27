export type ImageStrategy = 'raw' | 'reassemble';

export function decideImageStrategy(num: number, ext: string): ImageStrategy {
  const lower = ext.toLowerCase();
  if (lower === 'gif' || num <= 0 || (num <= 1 && lower !== 'webp')) {
    return 'raw';
  }
  return 'reassemble';
}

export function calcConcurrency(
  total: number,
  cpuCount: number,
  override?: number,
): number {
  if (override && override > 0) {
    return Math.min(override, total > 0 ? total : override);
  }
  const base = Math.max(2, cpuCount * 2);
  return Math.min(64, Math.min(base, total > 0 ? total : base));
}

export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({length: Math.min(limit, items.length)}, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}
