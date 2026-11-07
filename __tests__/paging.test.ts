import {appendPage, dedupe, reachedEnd} from '@/web/library/paging';
import {pruneEntries, type HistoryEntry} from '@/web/stores/history';
import type {AlbumSummary} from '@/core/model';

function album(id: number): AlbumSummary {
  return {albumId: id, name: `a-${id}`, author: '', tags: []};
}

function entry(albumId: number, updatedAt: number): HistoryEntry {
  return {albumId, title: `a-${albumId}`, page: 1, total: 10, updatedAt};
}

describe('paging dedupe', () => {
  it('keeps first occurrence order', () => {
    expect(dedupe([album(1), album(2), album(1)]).map((a) => a.albumId)).toEqual([1, 2]);
  });

  it('appends without duplicating existing ids', () => {
    const merged = appendPage([album(1), album(2)], [album(2), album(3)]);
    expect(merged.map((a) => a.albumId)).toEqual([1, 2, 3]);
  });
});

describe('paging reachedEnd', () => {
  it('ends on an empty page', () => {
    expect(reachedEnd({albums: [], total: 900}, 1)).toBe(true);
  });

  it('ends on a short page even when total looks larger', () => {
    expect(reachedEnd({albums: Array.from({length: 12}, (_, i) => album(i)), total: 9999}, 1)).toBe(
      true
    );
  });

  it('continues on a full page below total', () => {
    const albums = Array.from({length: 80}, (_, i) => album(i));
    expect(reachedEnd({albums, total: 500}, 1)).toBe(false);
  });

  it('ends once the requested window passes total', () => {
    const albums = Array.from({length: 80}, (_, i) => album(i));
    expect(reachedEnd({albums, total: 160}, 2)).toBe(true);
  });
});

describe('history prune', () => {
  it('keeps the newest entries up to the cap', () => {
    const entries: Record<string, HistoryEntry> = {};
    for (let i = 0; i < 120; i++) {
      entries[String(i)] = entry(i, i);
    }
    const pruned = pruneEntries(entries);
    expect(Object.keys(pruned)).toHaveLength(100);
    expect(pruned['119']).toBeDefined();
    expect(pruned['0']).toBeUndefined();
  });

  it('returns the same object when under the cap', () => {
    const entries = {'1': entry(1, 1)};
    expect(pruneEntries(entries)).toBe(entries);
  });
});
