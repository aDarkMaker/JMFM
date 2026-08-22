import {PDF} from '../constants';

export function sanitizeTitle(title: string): string {
  const cleaned = title.replace(/[<>:"/\\|?*]/g, '_').trim();
  if (!cleaned) {
    return 'untitled';
  }
  return cleaned.length > PDF.TITLE_MAX_LEN
    ? cleaned.slice(0, PDF.TITLE_MAX_LEN)
    : cleaned;
}

export function buildFileName(title: string): string {
  return `${sanitizeTitle(title)}.pdf`;
}
