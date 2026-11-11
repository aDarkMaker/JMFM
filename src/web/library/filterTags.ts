/**
 * Tag filter rules: validation, list mutation, and library-derived suggestions.
 */
import {isHardBlockedKeyword} from '@/core/model/blocklist';
import {topTags} from './tags';
import type {LibraryItem} from '@/web/stores/library';

export type FilterMode = 'blacklist' | 'whitelist';

/** Bookkeeping for the two exclusive tag lists stored in settings. */
export interface FilterLists {
  blacklistTags: string[];
  whitelistTags: string[];
}

export type TagInputResult =
  {ok: true; tag: string} | {ok: false; reason: 'empty' | 'duplicate' | 'blocked'};

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function validateTagInput(raw: string, existing: string[]): TagInputResult {
  const tag = raw.trim();
  if (!tag) {
    return {ok: false, reason: 'empty'};
  }
  if (isHardBlockedKeyword(tag)) {
    return {ok: false, reason: 'blocked'};
  }
  if (existing.some((t) => same(t, tag))) {
    return {ok: false, reason: 'duplicate'};
  }
  return {ok: true, tag};
}

/**
 * Place `tag` in `mode` and drop it from the other list: the two lists are
 * mutually exclusive, so adding or re-moding a tag is the same operation.
 */
export function setFilterTag(lists: FilterLists, tag: string, mode: FilterMode): FilterLists {
  const toBlack = mode === 'blacklist';
  const target = toBlack ? lists.blacklistTags : lists.whitelistTags;
  const other = toBlack ? lists.whitelistTags : lists.blacklistTags;
  // Keep the stored spelling when the tag is already present in the target list.
  const nextTarget = target.some((t) => same(t, tag)) ? target : [...target, tag];
  const nextOther = other.filter((t) => !same(t, tag));
  return toBlack
    ? {blacklistTags: nextTarget, whitelistTags: nextOther}
    : {blacklistTags: nextOther, whitelistTags: nextTarget};
}

export function removeFilterTag(lists: FilterLists, tag: string, mode: FilterMode): FilterLists {
  return mode === 'blacklist'
    ? {...lists, blacklistTags: lists.blacklistTags.filter((t) => t !== tag)}
    : {...lists, whitelistTags: lists.whitelistTags.filter((t) => t !== tag)};
}

/** Top tags from the library, excluding language tags and ones already in either list. */
export function suggestFilterTags(
  items: Array<Pick<LibraryItem, 'tags'>>,
  existing: string[],
  limit = 8
): string[] {
  const existingLower = new Set(existing.map((t) => t.toLowerCase()));
  return topTags(items, 100)
    .filter((t) => !existingLower.has(t.toLowerCase()))
    .slice(0, limit);
}
