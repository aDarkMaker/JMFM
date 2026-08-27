import type {LibraryItem} from '../stores/library';

export function topTags(
  items: Array<Pick<LibraryItem, 'tags'>>,
  n = 4,
): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const raw of item.tags ?? []) {
      const tag = String(raw).trim();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([tag]) => tag);
}
