export const TITLE_MAX_LEN = 200;

/** Replaces illegal filename characters, trims, and caps the length. */
export function sanitizeTitle(title: string): string {
  const cleaned = title.replace(/[<>:"/\\|?*]/g, '_').trim();
  if (!cleaned) {
    return 'untitled';
  }
  return cleaned.length > TITLE_MAX_LEN ? cleaned.slice(0, TITLE_MAX_LEN) : cleaned;
}
