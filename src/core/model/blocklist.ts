export const HARD_BLOCK_KEYWORDS = ['ai'] as const;

function keywordPattern(keyword: string): RegExp {
  return new RegExp(`\\b${keyword}\\b`, 'i');
}

export function isHardBlockedKeyword(tag: string): boolean {
  return HARD_BLOCK_KEYWORDS.some(kw =>
    keywordPattern(kw).test(tag.toLowerCase()),
  );
}

interface BlockableAlbum {
  name?: string;
  title?: string;
  author?: string;
  tags?: string[];
  category?: string;
}

export function isBlockedAlbum(
  album: BlockableAlbum,
  blacklistTags: string[],
): boolean {
  const tagSet = new Set(blacklistTags.map(t => t.trim()).filter(Boolean));
  const tags = album.tags ?? [];
  for (const tag of tags) {
    if (tagSet.has(tag)) {
      return true;
    }
  }
  const name = album.name ?? album.title ?? '';
  if (isHardBlockedKeyword(`${name} ${album.author ?? ''} ${album.category ?? ''} ${tags.join(' ')}`)) {
    return true;
  }
  return false;
}

export function filterBlockedAlbums<T extends BlockableAlbum>(
  albums: T[],
  blacklistTags: string[],
): T[] {
  return albums.filter(a => !isBlockedAlbum(a, blacklistTags));
}
