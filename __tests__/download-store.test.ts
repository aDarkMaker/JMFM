import {describe, expect, it, afterEach} from 'bun:test';
import {useDownloadStore} from '@/web/stores/download';

function task(albumId: number) {
  return {id: `t${albumId}`, albumId, title: `Album ${albumId}`};
}

afterEach(() => {
  useDownloadStore.setState({tasks: []});
});

describe('download task state machine', () => {
  it('starts new tasks as pending with zero progress', () => {
    useDownloadStore.getState().add(task(1));
    const t = useDownloadStore.getState().tasks[0];
    expect(t.status).toBe('pending');
    expect(t.done).toBe(0);
    expect(t.total).toBe(0);
  });

  it('dedupes by albumId on add and addBatch', () => {
    const s = useDownloadStore.getState();
    s.add(task(1));
    s.add(task(1));
    s.addBatch([task(2), task(3)]);
    s.addBatch([task(2)]);
    expect(useDownloadStore.getState().tasks.map((t) => t.albumId)).toEqual([1, 2, 3]);
  });

  it('transitions through running -> done', () => {
    const s = useDownloadStore.getState();
    s.add(task(1));
    s.setStatus('t1', 'running');
    expect(useDownloadStore.getState().tasks[0].status).toBe('running');
    s.setStatus('t1', 'done');
    expect(useDownloadStore.getState().tasks[0].status).toBe('done');
  });

  it('records errors with a message', () => {
    const s = useDownloadStore.getState();
    s.add(task(1));
    s.setStatus('t1', 'error', 'network down');
    const t = useDownloadStore.getState().tasks[0];
    expect(t.status).toBe('error');
    expect(t.error).toBe('network down');
  });

  it('pauseAll cancels running and pending controllers', () => {
    const s = useDownloadStore.getState();
    const canceled: string[] = [];
    const controller = (id: string) => ({
      paused: false,
      cancel: () => canceled.push(id),
    });
    s.add(task(1));
    s.add(task(2));
    s.add(task(3));
    s.setStatus('t1', 'running');
    s.setStatus('t3', 'done');
    s.setController('t1', controller('t1'));
    s.setController('t2', controller('t2'));
    s.setController('t3', controller('t3'));
    s.pauseAll();
    expect(canceled).toEqual(['t1', 't2']);
  });

  it('resumeAll flips paused tasks back to pending', () => {
    const s = useDownloadStore.getState();
    s.add(task(1));
    s.add(task(2));
    s.setStatus('t1', 'paused');
    s.setStatus('t2', 'done');
    s.resumeAll();
    const statuses = useDownloadStore.getState().tasks.map((t) => t.status);
    expect(statuses).toEqual(['pending', 'done']);
  });

  it('throttles progress updates and flushes the latest value', async () => {
    const s = useDownloadStore.getState();
    s.add(task(1));
    s.updateProgress('t1', 5, 50);
    s.updateProgress('t1', 10, 50);
    s.updateProgress('t1', 20, 50);
    const before = useDownloadStore.getState().tasks[0];
    expect(before.done).toBe(0);
    await Bun.sleep(150);
    const after = useDownloadStore.getState().tasks[0];
    expect(after.done).toBe(20);
    expect(after.total).toBe(50);
  });
});
