import {topTags, rankTagsByFavorites} from '@/web/library/tags';
import {
  buildRecommendations,
  buildRecommendationsWithBackfill,
  todayKey,
  isSameLocalDay,
  mergeRecentAlbums,
  hasLocalCandidates,
} from '@/web/library/daily';
import {isHardBlockedKeyword, isBlockedAlbum, filterBlockedAlbums} from '@/core/model/blocklist';
import type {AlbumSummary} from '@/core/model';

function album(id: number, tags: string[]): AlbumSummary {
  return {albumId: id, name: `album-${id}`, author: '', tags};
}

function albumWithTs(id: number, tags: string[], updateAt: number): AlbumSummary {
  return {...album(id, tags), updateAt};
}

describe('topTags', () => {
  it('counts tag frequency across library items', () => {
    const items = [{tags: ['校园', '青春']}, {tags: ['校园', '恋爱']}, {tags: ['校园', '青春']}];
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

describe('rankTagsByFavorites', () => {
  it('puts favorite tags first while keeping the rest stable', () => {
    expect(rankTagsByFavorites(['科幻', '校园', '恋爱'], ['校园'])).toEqual(['校园', '科幻', '恋爱']);
  });

  it('keeps original order when there are no favorites', () => {
    expect(rankTagsByFavorites(['a', 'b', 'c'], [])).toEqual(['a', 'b', 'c']);
  });

  it('dedupes and drops empty strings', () => {
    expect(rankTagsByFavorites(['校园', '', ' 校园 ', '科幻'], ['科幻'])).toEqual(['科幻', '校园']);
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
    const picks = buildRecommendations(daily, ['校园'], 6);
    const matched = picks.filter((a) => a.tags.includes('校园'));
    expect(matched.length).toBeGreaterThanOrEqual(2);
    expect(picks).toHaveLength(6);
    expect(picks[0].tags).toContain('校园');
  });

  it('fills remainder when hits are fewer than count', () => {
    const picks = buildRecommendations(daily, ['恐怖'], 6);
    expect(picks).toHaveLength(6);
    expect(picks[0].albumId).toBe(7);
  });

  it('picks all when fav tags are empty', () => {
    const picks = buildRecommendations(daily, [], 6);
    expect(picks).toHaveLength(6);
  });

  it('never returns duplicates', () => {
    const picks = buildRecommendations(daily, ['校园'], 6);
    const ids = picks.map((a) => a.albumId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns empty for empty input', () => {
    expect(buildRecommendations([], ['校园'], 6)).toEqual([]);
  });

  it('prioritizes whitelist hits over fav tag hits', () => {
    const picks = buildRecommendations(daily, ['校园'], 3, {whitelistTags: ['恐怖']});
    expect(picks[0].albumId).toBe(7);
  });

  it('treats whitelist without fav tags as the top tier', () => {
    const picks = buildRecommendations(daily, [], 3, {whitelistTags: ['恐怖']});
    expect(picks[0].albumId).toBe(7);
  });

  it('ignores language tags when matching favorites', () => {
    const langDaily = [album(10, ['中文']), album(11, ['校园']), album(12, ['都市'])];
    const picks = buildRecommendations(langDaily, ['中文', '校园'], 1);
    expect(picks[0].albumId).toBe(11);
  });

  it('excludes dismissed album ids', () => {
    const picks = buildRecommendations(daily, ['校园'], 6, {excludeIds: new Set([1, 3])});
    expect(picks.map((a) => a.albumId)).not.toContain(1);
    expect(picks.map((a) => a.albumId)).not.toContain(3);
    expect(picks).toHaveLength(5);
  });

  it('picks newest-first, filling earlier days when today runs short', () => {
    const pool = [
      albumWithTs(1, [], 100), // today, newest
      albumWithTs(2, [], 90),
      albumWithTs(3, [], 80),
      albumWithTs(4, [], 20), // yesterday, older
      albumWithTs(5, [], 10),
      albumWithTs(6, [], 5),
      albumWithTs(7, [], 1),
    ];
    const picks = buildRecommendations(pool, [], 6);
    expect(picks.map((a) => a.albumId)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('advances to the next batch when the previous picks are excluded', () => {
    const pool = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => albumWithTs(id, [], 100 - id));
    const first = buildRecommendations(pool, [], 6);
    const next = buildRecommendations(pool, [], 6, {excludeIds: new Set(first.map((a) => a.albumId))});
    expect(next.map((a) => a.albumId)).toEqual([7, 8]);
    expect(next.every((a) => !first.some((f) => f.albumId === a.albumId))).toBe(true);
  });
});

describe('buildRecommendationsWithBackfill', () => {
  const pool = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => albumWithTs(id, [], 100 - id));

  it('releases oldest dismissed ids to backfill toward count', () => {
    const {picks, releasedIds} = buildRecommendationsWithBackfill(pool, [], 6, {
      excludeIds: new Set([1, 2, 3, 4, 5, 6]),
    });
    expect(picks.map((a) => a.albumId)).toEqual([1, 2, 3, 4, 7, 8]);
    expect(releasedIds).toEqual([1, 2, 3, 4]);
  });

  it('returns no released ids when enough picks exist', () => {
    const {picks, releasedIds} = buildRecommendationsWithBackfill(pool, [], 6, {
      excludeIds: new Set([1]),
    });
    expect(picks).toHaveLength(6);
    expect(releasedIds).toEqual([]);
  });

  it('releases everything when dismissed covers the whole pool', () => {
    const {picks, releasedIds} = buildRecommendationsWithBackfill(pool, [], 6, {
      excludeIds: new Set([1, 2, 3, 4, 5, 6, 7, 8]),
    });
    expect(picks.map((a) => a.albumId)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(releasedIds).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('keeps fav tag tier before backfilling from rest', () => {
    const tagged = [
      albumWithTs(1, ['校园'], 100),
      albumWithTs(2, ['校园'], 90),
      albumWithTs(3, ['科幻'], 80),
      albumWithTs(4, ['都市'], 70),
      albumWithTs(5, ['恐怖'], 60),
      albumWithTs(6, ['青春'], 50),
      albumWithTs(7, ['校园'], 40),
    ];
    const {picks, releasedIds} = buildRecommendationsWithBackfill(tagged, ['校园'], 6, {
      excludeIds: new Set([1, 2, 3, 4, 5, 6]),
    });
    expect(releasedIds).toEqual([1, 2, 3, 4, 5]);
    expect(picks.map((a) => a.albumId)).toEqual([1, 2, 7, 3, 4, 5]);
  });

  it('never releases protected ids (refresh batch stays excluded)', () => {
    const {picks, releasedIds} = buildRecommendationsWithBackfill(pool, [], 6, {
      excludeIds: new Set([1, 2, 3, 4, 5, 6]),
      protectedIds: new Set([1, 2, 3, 4]),
    });
    expect(releasedIds).toEqual([5, 6]);
    expect(picks.map((a) => a.albumId)).toEqual([5, 6, 7, 8]);
    expect(picks.some((a) => a.albumId <= 4)).toBe(false);
  });

  it('stops when only protected ids remain in the exclusion set', () => {
    const {picks, releasedIds} = buildRecommendationsWithBackfill(pool, [], 6, {
      excludeIds: new Set([1, 2, 3, 4, 5, 6]),
      protectedIds: new Set([1, 2, 3, 4, 5, 6]),
    });
    expect(releasedIds).toEqual([]);
    expect(picks.map((a) => a.albumId)).toEqual([7, 8]);
  });
});

describe('mergeRecentAlbums', () => {
  const a = (id: number, updateAt = 1000 + id): AlbumSummary => ({...album(id, []), updateAt});

  it('accumulates across pages until minCount is reached', () => {
    const pages = [[a(1), a(2)], [a(3), a(4)], [a(5), a(6), a(7)]];
    expect(mergeRecentAlbums(pages, 4).map((x) => x.albumId)).toEqual([1, 2, 3, 4]);
  });

  it('dedupes by albumId across pages', () => {
    const pages = [[a(1), a(2)], [a(2), a(3)]];
    expect(mergeRecentAlbums(pages, 6).map((x) => x.albumId)).toEqual([1, 2, 3]);
  });

  it('keeps earlier-day albums (date widening)', () => {
    const pages = [[a(1, 100), a(2, 90)], [a(3, 80), a(4, 70)]];
    expect(mergeRecentAlbums(pages, 4)).toHaveLength(4);
  });

  it('drops albums without updateAt', () => {
    const noTs = album(9, []);
    const pages = [[a(1), noTs, a(2)]];
    expect(mergeRecentAlbums(pages, 6).map((x) => x.albumId)).toEqual([1, 2]);
  });
});

describe('hasLocalCandidates', () => {
  const pool = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => albumWithTs(id, [], 100 - id));

  it('returns true when enough non-dismissed candidates remain', () => {
    expect(hasLocalCandidates(pool, [1, 2], 6)).toBe(true);
  });

  it('returns false when dismissed leaves fewer than count', () => {
    expect(hasLocalCandidates(pool, [1, 2, 3, 4, 5], 6)).toBe(false);
  });

  it('ignores dismissed ids not present in the pool', () => {
    expect(hasLocalCandidates(pool, [99, 100], 6)).toBe(true);
  });

  it('respects a custom count', () => {
    expect(hasLocalCandidates(pool, [1, 2], 8)).toBe(false);
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
    expect(isBlockedAlbum({...ab, name: '明日方舟 忍冬剧情 [AI Generated]'}, [])).toBe(true);
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
    const list = [album(1, ['中文']), album(2, ['AI绘图']), album(3, ['NTR'])];
    const filtered = filterBlockedAlbums(list, ['NTR']);
    expect(filtered.map((a) => a.albumId)).toEqual([1]);
  });
});
