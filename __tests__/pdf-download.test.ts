import {buildFileName, buildPdfPages, sanitizeTitle} from '@/core/pdf';
import {computeUniformWidth, scaleSize} from '@/core/pdf/layout';
import {calcConcurrency, decideImageStrategy, mapWithConcurrency} from '@/core/download/scheduler';

describe('pdf sanitizeTitle', () => {
  it('replaces illegal chars', () => {
    expect(sanitizeTitle('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });

  it('trims and defaults empty', () => {
    expect(sanitizeTitle('   ')).toBe('untitled');
    expect(sanitizeTitle('')).toBe('untitled');
  });

  it('caps length at 200', () => {
    expect(sanitizeTitle('x'.repeat(300)).length).toBe(200);
  });
});

describe('pdf buildFileName', () => {
  it('uses sanitized title only', () => {
    expect(buildFileName('测试本子')).toBe('测试本子.pdf');
    expect(buildFileName('a/b')).toBe('a_b.pdf');
  });
});

describe('pdf buildPdfPages', () => {
  it('builds a4 pages with contain fit', () => {
    const pages = buildPdfPages(['/a.jpg', '/b.jpg']);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual({
      imagePath: '/a.jpg',
      imageFit: 'contain',
      width: 595,
      height: 842,
      backgroundColor: '#ffffff',
    });
  });

  it('builds uniform-width fill pages from sizes', () => {
    const pages = buildPdfPages(
      ['/a.jpg', '/b.jpg'],
      [
        {width: 200, height: 300},
        {width: 400, height: 600},
      ]
    );
    expect(pages[0]).toEqual({
      imagePath: '/a.jpg',
      imageFit: 'fill',
      width: 400,
      height: 600,
      backgroundColor: '#ffffff',
    });
    expect(pages[1]).toEqual({
      imagePath: '/b.jpg',
      imageFit: 'fill',
      width: 400,
      height: 600,
      backgroundColor: '#ffffff',
    });
  });

  it('falls back for unknown sizes', () => {
    const pages = buildPdfPages(
      ['/a.jpg', '/b.jpg'],
      [
        {width: 0, height: 0},
        {width: 200, height: 300},
      ]
    );
    expect(pages[0].imageFit).toBe('contain');
    expect(pages[0].width).toBe(595);
    expect(pages[1].imageFit).toBe('fill');
  });
});

describe('pdf layout', () => {
  it('computeUniformWidth caps at max', () => {
    expect(computeUniformWidth([200, 400, 300], 1190)).toBe(400);
    expect(computeUniformWidth([2000, 1500], 1190)).toBe(1190);
    expect(computeUniformWidth([], 1190)).toBe(1190);
  });

  it('scaleSize keeps aspect ratio', () => {
    expect(scaleSize(200, 300, 400)).toEqual({width: 400, height: 600});
    expect(scaleSize(400, 600, 200)).toEqual({width: 200, height: 300});
  });
});

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
