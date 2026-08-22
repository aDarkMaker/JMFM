import {computeStrips, getNum} from '@/core/transcode';

describe('transcode getNum', () => {
  it('returns 0 when aid < scrambleId', () => {
    expect(getNum(400, 100, '00001')).toBe(0);
  });

  it('returns 10 when aid in [scrambleId, 268850)', () => {
    expect(getNum(400, 100200, '00001')).toBe(10);
    expect(getNum(220980, 220980, '00005')).toBe(10);
  });

  it('computes via md5 when aid >= 268850', () => {
    expect(getNum(400, 300000, '00001')).toBe(16);
    expect(getNum(0, 268850, '00001')).toBe(6);
  });

  it('uses x=8 when aid >= 421926', () => {
    expect(getNum(400, 500000, '00001')).toBe(12);
    expect(getNum(0, 421926, '00001')).toBe(14);
    expect(getNum(0, 800000, '12345')).toBe(2);
  });
});

describe('transcode computeStrips', () => {
  it('computes strips for divisible height', () => {
    expect(computeStrips(4, 8)).toEqual([
      {ySrc: 6, yDst: 0, height: 2},
      {ySrc: 4, yDst: 2, height: 2},
      {ySrc: 2, yDst: 4, height: 2},
      {ySrc: 0, yDst: 6, height: 2},
    ]);
  });

  it('handles remainder height', () => {
    const strips = computeStrips(3, 10);
    expect(strips).toEqual([
      {ySrc: 6, yDst: 0, height: 4},
      {ySrc: 3, yDst: 4, height: 3},
      {ySrc: 0, yDst: 7, height: 3},
    ]);
    const total = strips.reduce((sum, s) => sum + s.height, 0);
    expect(total).toBe(10);
  });

  it('clamps ySrc and height within bounds', () => {
    const strips = computeStrips(5, 9);
    for (const s of strips) {
      expect(s.ySrc).toBeGreaterThanOrEqual(0);
      expect(s.ySrc + s.height).toBeLessThanOrEqual(9);
    }
  });
});
