import {topTags} from '@/web/library/tags';
import {buildRecommendations, todayKey, isSameLocalDay} from '@/web/library/daily';
import {
  isHardBlockedKeyword,
  isBlockedAlbum,
  filterBlockedAlbums,
} from '@/core/model/blocklist';
import type {AlbumSummary} from '@/core/model';

function album(id: number, tags: string[]): AlbumSummary {
  return {albumId: id, name: `album-${id}`, author: '', tags};
}

const rng = (() => {
  let s = 42;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
})();

describe('topTags', () => {
  it('counts tag frequency across library items', () => {
    const items = [
      {tags: ['校园', '青春']},
      {tags: ['校园', '恋爱']},
      {tags: ['校园', '青春']},
    ];
    expect(topTags(items, 4)).toEqual(['校园', '青春', '恋爱']);
  });

  it('returns at most n tags', () => {
    const items = [{tags: ['a', 'b', 'c', 'd', 'e']}];
    expect(topTags(items, 4)).toHaveLength(4);
  });

  it('handles empty library and missing tags', () => {
    expect(topTags([], 4)).toEqual([]);
    expect(topTags([{tags: undefined}], 4)).toEqual([]);
  });

  it('ignores language tags', () => {
    const items = [{tags: ['中文', '校园', '日本語', '青春']}];
    expect(topTags(items, 4)).toEqual(['校园', '青春']);
  });
});

describe('buildRecommendations', () => {
  const daily = [
    album(1, ['校园']),
    album(2, ['青春']),
    album(3, ['校园', '美食']),
    album(4, ['科幻']),
    album(5, ['都市']),
    album(6, ['校园']),
    album(7, ['恐怖']),
  ];

  it('prefers albums matching fav tags', () => {
    const picks = buildRecommendations(daily, ['校园'], 6, rng);
    const matched = picks.filter(a => a.tags.includes('校园'));
    expect(matched.length).toBeGreaterThanOrEqual(2);
    expect(picks).toHaveLength(6);
    expect(picks[0].tags).toContain('校园');
  });

  it('fills remainder randomly when hits are fewer than count', () => {
    const picks = buildRecommendations(daily, ['恐怖'], 6, rng);
    expect(picks).toHaveLength(6);
    expect(picks[0].albumId).toBe(7);
  });

  it('picks all randomly when fav tags are empty', () => {
    const picks = buildRecommendations(daily, [], 6, rng);
    expect(picks).toHaveLength(6);
  });

  it('never returns duplicates', () => {
    const picks = buildRecommendations(daily, ['校园'], 6, rng);
    const ids = picks.map(a => a.albumId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns empty for empty input', () => {
    expect(buildRecommendations([], ['校园'], 6)).toEqual([]);
  });

  it('prioritizes whitelist hits over fav tag hits', () => {
    const picks = buildRecommendations(
      daily,
      ['校园'],
      3,
      rng,
      {whitelistTags: ['恐怖']},
    );
    expect(picks[0].albumId).toBe(7);
  });

  it('treats whitelist without fav tags as the top tier', () => {
    const picks = buildRecommendations(
      daily,
      [],
      3,
      rng,
      {whitelistTags: ['恐怖']},
    );
    expect(picks[0].albumId).toBe(7);
  });

  it('ignores language tags when matching favorites', () => {
    const langDaily = [
      album(10, ['中文']),
      album(11, ['校园']),
      album(12, ['都市']),
    ];
    const picks = buildRecommendations(langDaily, ['中文'], 1, () => 0);
    expect(picks[0].albumId).not.toBe(10);
  });

  it('excludes dismissed album ids', () => {
    const picks = buildRecommendations(
      daily,
      ['校园'],
      6,
      rng,
      {excludeIds: new Set([1, 3])},
    );
    expect(picks.map(a => a.albumId)).not.toContain(1);
    expect(picks.map(a => a.albumId)).not.toContain(3);
    expect(picks).toHaveLength(5);
  });
});

describe('todayKey & isSameLocalDay', () => {
  it('formats date key', () => {
    expect(todayKey(new Date(2026, 7, 5))).toBe('2026-08-05');
    expect(todayKey(new Date(2026, 10, 25))).toBe('2026-11-25');
  });

  it('detects same local day from unix seconds', () => {
    const now = new Date(2026, 7, 5, 12, 0, 0);
    const same = new Date(2026, 7, 5, 3, 0, 0);
    const next = new Date(2026, 7, 6, 3, 0, 0);
    expect(isSameLocalDay(same.getTime() / 1000, now)).toBe(true);
    expect(isSameLocalDay(next.getTime() / 1000, now)).toBe(false);
  });
});

describe('blocklist', () => {
  it('hard blocks AI keywords case-insensitively', () => {
    expect(isHardBlockedKeyword('AI')).toBe(true);
    expect(isHardBlockedKeyword('AI绘图')).toBe(true);
    expect(isHardBlockedKeyword('[AI Generated]')).toBe(true);
    expect(isHardBlockedKeyword('ai生成')).toBe(true);
    expect(isHardBlockedKeyword('NTR')).toBe(false);
    expect(isHardBlockedKeyword('available')).toBe(false);
  });

  it('blocks albums by title containing AI', () => {
    const ab = album(1, ['中文']);
    expect(
      isBlockedAlbum({...ab, name: '明日方舟 忍冬剧情 [AI Generated]'}, []),
    ).toBe(true);
    expect(isBlockedAlbum(ab, [])).toBe(false);
  });

  it('blocks albums by tag containing AI', () => {
    expect(isBlockedAlbum(album(2, ['AI绘图']), [])).toBe(true);
    expect(isBlockedAlbum(album(2, ['CG集']), [])).toBe(false);
  });

  it('blocks albums matching configured blacklist tags', () => {
    expect(isBlockedAlbum(album(3, ['巨乳', 'NTR']), ['NTR'])).toBe(true);
    expect(isBlockedAlbum(album(3, ['巨乳']), ['NTR'])).toBe(false);
  });

  it('filters blocked albums always applying AI rules', () => {
    const list = [
      album(1, ['中文']),
      album(2, ['AI绘图']),
      album(3, ['NTR']),
    ];
    const filtered = filterBlockedAlbums(list, ['NTR']);
    expect(filtered.map(a => a.albumId)).toEqual([1]);
  });
});
