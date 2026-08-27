import {isHardBlockedKeyword} from '../../core/model/blocklist';
import {topTags} from './tags';
import type {LibraryItem} from '../stores/library';

export type TagInputResult =
  {ok: true; tag: string} | {ok: false; reason: 'empty' | 'duplicate' | 'blocked'};

export function validateTagInput(raw: string, existing: string[]): TagInputResult {
  const tag = raw.trim();
  if (!tag) {
    return {ok: false, reason: 'empty'};
  }
  if (isHardBlockedKeyword(tag)) {
    return {ok: false, reason: 'blocked'};
  }
  if (existing.some((t) => t.toLowerCase() === tag.toLowerCase())) {
    return {ok: false, reason: 'duplicate'};
  }
  return {ok: true, tag};
}

/** Top tags from the library, excluding language tags and ones already in the list. */
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
