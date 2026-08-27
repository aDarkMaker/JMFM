import {createUserStorage} from '../../data/user-storage';

const DISMISSED_PREFIX = 'jmf.daily.dismissed.';
const storage = createUserStorage();

function dismissedKey(date: string): string {
  return `${DISMISSED_PREFIX}${date}`;
}

export async function readDismissed(date: string): Promise<number[]> {
  try {
    const raw = await storage.get(dismissedKey(date));
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? data.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

export async function addDismissed(date: string, albumIds: number[]): Promise<void> {
  if (albumIds.length === 0) return;
  const current = await readDismissed(date);
  const merged = [...new Set([...current, ...albumIds])];
  try {
    await storage.set(dismissedKey(date), JSON.stringify(merged));
  } catch {
    // ignore quota errors
  }
}

export async function clearDismissed(date: string): Promise<void> {
  try {
    await storage.remove(dismissedKey(date));
  } catch {
    // ignore
  }
}
