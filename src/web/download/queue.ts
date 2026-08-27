interface QueuedTask {
  id: string;
  runner: () => Promise<void>;
}

const MAX_CONCURRENT = 1;
const queue: QueuedTask[] = [];
const running = new Set<string>();
const queued = new Set<string>();
const aborted = new Set<string>();

export function isDownloadAborted(id: string): boolean {
  return aborted.has(id);
}

export function abortDownload(id: string): void {
  aborted.add(id);
  const idx = queue.findIndex((t) => t.id === id);
  if (idx >= 0) {
    queue.splice(idx, 1);
    queued.delete(id);
  }
}

export function clearDownloadAborted(id: string): void {
  aborted.delete(id);
}

function pump(): void {
  while (running.size < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    queued.delete(next.id);
    running.add(next.id);
    next
      .runner()
      .catch(() => {})
      .finally(() => {
        running.delete(next.id);
        pump();
      });
  }
}

export function enqueueDownload(id: string, runner: () => Promise<void>): boolean {
  if (aborted.has(id) || running.has(id) || queued.has(id)) {
    return false;
  }
  queued.add(id);
  queue.push({id, runner});
  pump();
  return true;
}
