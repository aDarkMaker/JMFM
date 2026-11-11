/**
 * Manifest `notes` is author-written Markdown. Rendering it verbatim leaks `##` and
 * `-` markers into the dialogs, so flatten it into a few plain block kinds.
 */
export type NoteBlock =
  | {kind: 'heading'; text: string}
  | {kind: 'bullet'; text: string}
  | {kind: 'text'; text: string};

const HEADING_RE = /^#{1,6}\s+(.*)$/;
const BULLET_RE = /^[-*+]\s+(.*)$/;
const ORDERED_RE = /^\d+[.)]\s+(.*)$/;
const FENCE_RE = /^(```|~~~)/;

/** Drops markup that has no meaning once the text is plain. */
function stripInline(raw: string): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`{1,3}/g, '')
    .replace(/\*\*|__/g, '')
    .trim();
}

export function parseNotes(raw: string | null | undefined): NoteBlock[] {
  if (!raw) return [];
  const blocks: NoteBlock[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || FENCE_RE.test(trimmed)) continue;
    // GitHub release bodies indent nested bullets; treat them as siblings.
    const stripped = trimmed.replace(/^>\s*/, '');
    const heading = HEADING_RE.exec(stripped);
    if (heading) {
      const text = stripInline(heading[1]);
      if (text) blocks.push({kind: 'heading', text});
      continue;
    }
    const bullet = BULLET_RE.exec(stripped) ?? ORDERED_RE.exec(stripped);
    if (bullet) {
      const text = stripInline(bullet[1]);
      if (text) blocks.push({kind: 'bullet', text});
      continue;
    }
    const text = stripInline(stripped);
    if (text) blocks.push({kind: 'text', text});
  }
  return blocks;
}
