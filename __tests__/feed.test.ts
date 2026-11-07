import {ALL_CATEGORY, CATEGORY_FALLBACK, SORT} from '@/core/constants/sort';
import {buildCategoryChips, type CategoryLike} from '@/web/library/categoryChips';
import {mergeFeedPage, EMPTY_SLICE} from '@/web/library/pagedFeed';
import type {AlbumSummary} from '@/core/model';

function album(id: number, tags: string[] = []): AlbumSummary {
  return {albumId: id, name: `a-${id}`, author: '', tags};
}

describe('buildCategoryChips', () => {
  it('drops the API slug=0 entry so keys never collide', () => {
    const categories: CategoryLike[] = [
      {slug: ALL_CATEGORY, name: '最新A漫'},
      {slug: '2', name: '同人'},
    ];
    const chips = buildCategoryChips(categories);
    expect(chips.map((c) => c.slug)).toEqual([ALL_CATEGORY, '2']);
    expect(new Set(chips.map((c) => `${c.slug}-${c.name}`)).size).toBe(chips.length);
  });

  it('falls back to constants when the API returns nothing', () => {
    const chips = buildCategoryChips([]);
    expect(chips[0]).toEqual({slug: ALL_CATEGORY, name: '最新'});
    expect(chips.length).toBe(CATEGORY_FALLBACK.length + 1);
  });

  it('honours the limit before prepending', () => {
    const categories: CategoryLike[] = ['1', '2', '3'].map((slug) => ({slug, name: slug}));
    expect(buildCategoryChips(categories, 2).map((c) => c.slug)).toEqual([ALL_CATEGORY, '1', '2']);
  });
});

describe('mergeFeedPage', () => {
  it('appends and tracks the page index', () => {
    const first = mergeFeedPage(EMPTY_SLICE, {albums: [album(1), album(2)], total: 200}, 1);
    expect(first.page).toBe(1);
    expect(first.items.map((a) => a.albumId)).toEqual([1, 2]);
    const second = mergeFeedPage(first, {albums: [album(2), album(3)], total: 200}, 2);
    expect(second.items.map((a) => a.albumId)).toEqual([1, 2, 3]);
  });

  it('replaces items when reset', () => {
    const prev = mergeFeedPage(EMPTY_SLICE, {albums: [album(1)], total: 10}, 1);
    const reset = mergeFeedPage(prev, {albums: [album(9)], total: 10}, 1, true);
    expect(reset.items.map((a) => a.albumId)).toEqual([9]);
  });

  it('marks short pages as ended', () => {
    const short = mergeFeedPage(EMPTY_SLICE, {albums: [album(1)], total: 10}, 1);
    expect(short.end).toBe(true);
  });

  it('keeps going on a full page below total', () => {
    const full = Array.from({length: 80}, (_, i) => album(i));
    const feed = mergeFeedPage(EMPTY_SLICE, {albums: full, total: 500}, 1);
    expect(feed.end).toBe(false);
    expect(feed.total).toBe(500);
  });
});

describe('sort constants used by feeds', () => {
  it('keeps distinct default and weekly hot orders', () => {
    expect(SORT.DEFAULT).not.toBe(SORT.WEEK_HOT);
  });
});
