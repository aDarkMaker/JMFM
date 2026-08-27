const MAX_LEN = 80;
const MAX_LINES = 2;

export function formatTaskError(message: string): string {
  const cleaned = message
    .replace(/https?:\/\/\S+/g, '')
    .replace(/native=[^;]*; web=[^;]*/g, '')
    .replace(/\[object Object\]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*;\s*$/g, '')
    .trim();

  const lines = cleaned.split('\n');
  const joined = lines.slice(0, MAX_LINES).join('\n');
  if (joined.length <= MAX_LEN) {
    return joined;
  }
  return `${joined.slice(0, MAX_LEN).trimEnd()}…`;
}
