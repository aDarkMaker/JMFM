export type ImageStrategy = 'raw' | 'reassemble';

/** Memory watermark: cumulative cap on fetched-but-not-yet-written bytes to bound download memory. */
export const MEMORY_WATERMARK_BYTES = 256 * 1024 * 1024;

export function decideImageStrategy(num: number, ext: string): ImageStrategy {
  const lower = ext.toLowerCase();
  if (lower === 'gif' || num <= 0 || (num <= 1 && lower !== 'webp')) {
    return 'raw';
  }
  return 'reassemble';
}

export function calcConcurrency(total: number, cpuCount: number, override?: number): number {
  if (override && override > 0) {
    return Math.min(override, total > 0 ? total : override);
  }
  const base = Math.max(2, cpuCount * 2);
  return Math.min(64, Math.min(base, total > 0 ? total : base));
}

/** Decode/write concurrency: decoding amplifies memory (canvas/bitmaps), so stay well below network concurrency. */
export function calcDecodeConcurrency(cpuCount: number): number {
  return Math.max(1, Math.min(4, Math.round(cpuCount / 2)));
}

/** Semaphore limiting CPU/memory-sensitive sections. */
export class Semaphore {
  private active = 0;
  private waiters: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
    this.active += 1;
  }

  release(): void {
    this.active -= 1;
    this.waiters.shift()?.();
  }
}

/** Byte-watermark gate: acquire blocks while over the limit until release frees space. */
export class MemoryGate {
  private used = 0;
  private waiters: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async acquire(bytes: number): Promise<void> {
    while (this.used + bytes > this.limit) {
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
      });
    }
    this.used += bytes;
  }

  release(bytes: number): void {
    this.used -= bytes;
    if (this.used < 0) {
      this.used = 0;
    }
    const waiters = this.waiters;
    this.waiters = [];
    for (const w of waiters) {
      w();
    }
  }
}

export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>
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
