import {useEffect, useRef, useState, type FormEvent} from 'react';
import {useDownloadStore, TaskStatus} from '../stores/download';
import {ProgressBar} from '../components/ProgressBar';
import {EmptyState} from '../components/EmptyState';
import {SectionHeader} from '../components/SectionHeader';
import {Icon} from '../components/Icon';
import {DownloadService, DownloadEvent, isCanceledError} from '../../core/download';
import {ApiClient} from '../../core/api';
import {createHttpClient} from '../../core/net';
import {createRuntime} from '../../core/download/runtime';
import {useSettingsStore} from '../stores/settings';
import {useLibraryStore} from '../stores/library';
import {CDN_DOMAINS, REQUEST} from '../../core/constants';

const AUTO_REMOVE_MS = 3000;

interface AlbumInfo {
  title: string;
  chapters: number;
  author: string;
  tags: string[];
}

const BADGE_TEXT: Record<TaskStatus, string> = {
  pending: '等待中',
  running: '下载中',
  paused: '已暂停',
  done: '已完成',
  error: '失败',
};

const STATUS_ICON: Partial<Record<TaskStatus, 'check-circle' | 'error'>> = {
  done: 'check-circle',
  error: 'error',
};

function parseIds(input: string): number[] {
  return input
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(s => /^\d+$/.test(s))
    .map(Number);
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function TasksScreen() {
  const tasks = useDownloadStore(s => s.tasks);
  const addBatch = useDownloadStore(s => s.addBatch);
  const remove = useDownloadStore(s => s.remove);
  const setStatus = useDownloadStore(s => s.setStatus);
  const setTitle = useDownloadStore(s => s.setTitle);
  const updateProgress = useDownloadStore(s => s.updateProgress);
  const updateChapter = useDownloadStore(s => s.updateChapter);
  const setController = useDownloadStore(s => s.setController);
  const pauseAll = useDownloadStore(s => s.pauseAll);
  const resumeAll = useDownloadStore(s => s.resumeAll);
  const downloadPath = useSettingsStore(s => s.settings.downloadPath);
  const proxyEnabled = useSettingsStore(s => s.settings.proxyEnabled);
  const proxy = useSettingsStore(s => s.settings.proxy);
  const retryTimes = useSettingsStore(s => s.settings.retryTimes);
  const [input, setInput] = useState('');
  const clearTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const ids = parseIds(input);
  const isValid = ids.length > 0;
  const hasRunning = tasks.some(t => t.status === 'running');
  const hasPaused = tasks.some(t => t.status === 'paused');

  useEffect(() => {
    const map = clearTimers.current;
    return () => {
      map.forEach(timer => clearTimeout(timer));
      map.clear();
    };
  }, []);

  function scheduleAutoRemove(taskId: string) {
    const prev = clearTimers.current.get(taskId);
    if (prev) {
      clearTimeout(prev);
    }
    const timer = setTimeout(() => {
      clearTimers.current.delete(taskId);
      useDownloadStore.getState().remove(taskId);
    }, AUTO_REMOVE_MS);
    clearTimers.current.set(taskId, timer);
  }

  function handleRemoveTask(taskId: string) {
    const prev = clearTimers.current.get(taskId);
    if (prev) {
      clearTimeout(prev);
      clearTimers.current.delete(taskId);
    }
    remove(taskId);
  }

  async function saveToLibrary(
    albumId: number,
    info: AlbumInfo,
    pageCount: number,
    pdfPath: string,
    http: ReturnType<typeof createHttpClient>,
    runtime: ReturnType<typeof createRuntime>,
  ) {
    const albumDir = pdfPath.slice(0, pdfPath.lastIndexOf('/'));
    let coverPath: string | undefined;
    try {
      for (const domain of CDN_DOMAINS) {
        const resp = await http.getBytes(
          `https://${domain}/media/albums/${albumId}_3x4.jpg`,
          {Referer: REQUEST.REFERER, Accept: REQUEST.ACCEPT_IMAGE},
        );
        if (!resp.ok || !resp.bytes) {
          continue;
        }
        const cover = `${albumDir}/cover.jpg`;
        await runtime.fs.writeFile(cover, resp.bytes);
        coverPath = cover;
        break;
      }
    } catch {
      // cover download failure is non-fatal
    }
    useLibraryStore.getState().add({
      albumId,
      title: info.title,
      author: info.author,
      tags: info.tags,
      chapterCount: info.chapters,
      pageCount,
      filePath: pdfPath,
      coverPath,
    });
  }

  async function startDownload(taskId: string) {
    const prev = clearTimers.current.get(taskId);
    if (prev) {
      clearTimeout(prev);
      clearTimers.current.delete(taskId);
    }
    const runtime = createRuntime();
    const http = createHttpClient({
      ...(proxyEnabled && proxy ? {proxy} : {}),
      maxRetries: retryTimes,
    });
    const source = new ApiClient(http);
    const service = new DownloadService({
      http,
      source,
      runtime,
      downloadPath,
    });

    const albumId = useDownloadStore.getState().tasks.find(t => t.id === taskId)?.albumId ?? 0;
    let albumInfo: AlbumInfo | null = null;
    let albumTotal = 0;
    const controller = {paused: false, cancel() { this.paused = true; }};
    setController(taskId, controller);
    setStatus(taskId, 'running');

    try {
      const pdfPath = await service.downloadAlbum(
        albumId,
        (e: DownloadEvent) => {
          if (e.type === 'album-parsed') {
            albumInfo = {title: e.title, chapters: e.chapters, author: e.author, tags: e.tags};
            setTitle(taskId, e.title);
            updateChapter(taskId, 0, e.chapters);
          } else if (e.type === 'chapter') {
            updateChapter(taskId, e.index, e.total);
          } else if (e.type === 'image') {
            albumTotal = e.albumTotal;
            updateProgress(taskId, e.albumDone, e.albumTotal);
          }
        },
        {controller},
      );
      setStatus(taskId, 'done');
      if (albumInfo) {
        await saveToLibrary(albumId, albumInfo, albumTotal, pdfPath, http, runtime);
      }
      scheduleAutoRemove(taskId);
    } catch (err) {
      if (isCanceledError(err)) {
        setStatus(taskId, 'paused');
      } else {
        setStatus(taskId, 'error', err instanceof Error ? err.message : String(err));
      }
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    const existing = new Set(useDownloadStore.getState().tasks.map(t => t.albumId));
    const fresh = ids.filter(id => !existing.has(id));
    if (fresh.length === 0) {
      setInput('');
      return;
    }
    addBatch(fresh.map(id => ({id: uid(), albumId: id, title: `漫画 ${id}`})));
    setInput('');
    fresh.forEach(id => {
      const task = useDownloadStore.getState().tasks.find(t => t.albumId === id);
      if (task) {
        void startDownload(task.id);
      }
    });
  }

  function handleResume(taskId: string) {
    const task = useDownloadStore.getState().tasks.find(t => t.id === taskId);
    if (!task) return;
    void startDownload(taskId);
  }

  function handleCancel(taskId: string) {
    const task = useDownloadStore.getState().tasks.find(t => t.id === taskId);
    task?.controller?.cancel();
  }

  return (
    <div className="app-screen">
      <SectionHeader
        title="下载"
        actionLabel={hasRunning ? '全部暂停' : hasPaused ? '全部继续' : undefined}
        actionIcon={hasRunning ? 'pause' : hasPaused ? 'play-arrow' : undefined}
        onAction={hasRunning ? pauseAll : hasPaused ? resumeAll : undefined}
      />
      <form className="download-input-section" onSubmit={handleSubmit}>
        <input
          className="download-input"
          placeholder="输入漫画ID"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button
          className="download-button"
          type="submit"
          disabled={!isValid}
          aria-label="下载"
        >
          <Icon name="add" size={20} />
        </button>
      </form>
      {tasks.length === 0 ? (
        <EmptyState
          icon="cloud-download"
          title="暂无下载任务"
          hint="在上方输入漫画ID开始下载"
        />
      ) : (
        <div className="tasks-stack">
          {tasks.map(task => {
            const statusIcon = STATUS_ICON[task.status];
            return (
              <div className="task-tile" key={task.id}>
                <div className="task-head">
                  {statusIcon ? (
                    <span className={`task-status-icon is-${task.status}`}>
                      <Icon name={statusIcon} size={18} />
                    </span>
                  ) : null}
                  <span className="task-title">{task.title}</span>
                  <span className={`task-badge is-${task.status}`}>
                    {BADGE_TEXT[task.status]}
                  </span>
                </div>
                <ProgressBar
                  progress={(task.done / Math.max(1, task.total)) * 100}
                  status={task.status}
                />
                <span className="task-meta">
                  {task.status === 'running' || task.status === 'done'
                    ? `${task.done} / ${task.total} 页 · ${task.chaptersDone} / ${task.chaptersTotal} 话`
                    : `${task.total} 页`}
                </span>
                {task.error ? <span className="task-error">{task.error}</span> : null}
                <div className="task-actions">
                  {task.status === 'running' ? (
                    <button className="task-action" onClick={() => handleCancel(task.id)}>
                      <Icon name="pause" size={16} />
                      暂停
                    </button>
                  ) : null}
                  {task.status === 'paused' ? (
                    <button className="task-action" onClick={() => handleResume(task.id)}>
                      <Icon name="play-arrow" size={16} />
                      继续
                    </button>
                  ) : null}
                  {task.status === 'error' ? (
                    <button className="task-action" onClick={() => handleResume(task.id)}>
                      <Icon name="refresh" size={16} />
                      重试
                    </button>
                  ) : null}
                  <button className="task-action task-action-danger" onClick={() => handleRemoveTask(task.id)}>
                    <Icon name="delete" size={16} />
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
