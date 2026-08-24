interface QueuedTask {
  id: string;
  runner: () => Promise<void>;
}

const MAX_CONCURRENT = 1;
const queue: QueuedTask[] = [];
const running = new Set<string>();
const queued = new Set<string>();

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
  if (running.has(id) || queued.has(id)) {
    return false;
  }
  queued.add(id);
  queue.push({id, runner});
  pump();
  return true;
}
