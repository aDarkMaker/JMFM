import type {LibraryItem} from '../stores/library';

export const LANGUAGE_TAGS = [
  '中文',
  '简体中文',
  '繁體中文',
  '日本語',
  '日文',
  'English',
  '英文',
  '한국어',
  '韓文',
  '粵語',
  '中文字幕',
] as const;

export function isLanguageTag(tag: string): boolean {
  const t = tag.trim().toLowerCase();
  return LANGUAGE_TAGS.some(lang => lang.toLowerCase() === t);
}

export function topTags(
  items: Array<Pick<LibraryItem, 'tags'>>,
  n = 4,
): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const raw of item.tags ?? []) {
      const tag = String(raw).trim();
      if (!tag || isLanguageTag(tag)) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([tag]) => tag);
}
