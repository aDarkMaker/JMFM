import {
  MemoryGate,
  Semaphore,
  calcConcurrency,
  calcDecodeConcurrency,
  decideImageStrategy,
  mapWithConcurrency,
} from '@/core/download/scheduler';

describe('download decideImageStrategy', () => {
  it('raw for gif and num<=0', () => {
    expect(decideImageStrategy(0, 'webp')).toBe('raw');
    expect(decideImageStrategy(10, 'gif')).toBe('raw');
  });

  it('reassemble for num>0 non-gif', () => {
    expect(decideImageStrategy(6, 'webp')).toBe('reassemble');
    expect(decideImageStrategy(8, 'jpg')).toBe('reassemble');
  });
});

describe('download calcConcurrency', () => {
  it('respects override and total bound', () => {
    expect(calcConcurrency(100, 4, 10)).toBe(10);
    expect(calcConcurrency(5, 4, 10)).toBe(5);
  });

  it('falls back to cpu-based default', () => {
    expect(calcConcurrency(100, 4)).toBe(8);
    expect(calcConcurrency(100, 32)).toBe(64);
  });
});

describe('download mapWithConcurrency', () => {
  it('runs all items', async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3, 4], 2, async (n, i) => {
      seen.push(i);
    });
    expect(seen.sort()).toEqual([0, 1, 2, 3]);
  });

  it('handles empty list', async () => {
    await expect(mapWithConcurrency([], 2, async () => undefined)).resolves.toBeUndefined();
  });
});

describe('download calcDecodeConcurrency', () => {
  it('caps decode concurrency well below network', () => {
    expect(calcDecodeConcurrency(4)).toBe(2);
    expect(calcDecodeConcurrency(32)).toBe(4);
    expect(calcDecodeConcurrency(1)).toBe(1);
  });
});

describe('download Semaphore', () => {
  it('limits concurrent critical sections', async () => {
    const sem = new Semaphore(2);
    let active = 0;
    let peak = 0;
    const run = async () => {
      await sem.acquire();
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      sem.release();
    };
    await Promise.all([run(), run(), run(), run(), run()]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe('download MemoryGate', () => {
  it('blocks acquire while over the watermark', async () => {
    const gate = new MemoryGate(100);
    await gate.acquire(80);
    const blocked = gate.acquire(80);
    let released = false;
    const waiter = blocked.then(() => {
      released = true;
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(released).toBe(false);
    gate.release(80);
    await waiter;
    expect(released).toBe(true);
  });

  it('allows parallel acquires under the limit', async () => {
    const gate = new MemoryGate(100);
    await gate.acquire(40);
    await gate.acquire(60);
    gate.release(40);
    gate.release(60);
    expect(gate).toBeDefined();
  });
});
