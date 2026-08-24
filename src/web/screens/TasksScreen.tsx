import {useCallback, useEffect, useRef, useState, type FormEvent} from 'react';
import {useDownloadStore, TaskStatus} from '../stores/download';
import {ProgressBar} from '../components/ProgressBar';
import {EmptyState} from '../components/EmptyState';
import {SectionHeader} from '../components/SectionHeader';
import {Icon} from '../components/Icon';
import {useDownloadTask} from '../hooks/useDownloadTask';
import {hasJapanese} from '../hooks/useJapaneseFont';

const AUTO_REMOVE_MS = 3000;
const LEAVE_ANIM_MS = 240;

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
  const pauseAll = useDownloadStore(s => s.pauseAll);
  const resumeAll = useDownloadStore(s => s.resumeAll);
  const {startDownload, cancel} = useDownloadTask();
  const [input, setInput] = useState('');
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const leavingRef = useRef<Set<string>>(new Set());
  const leaveTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const ids = parseIds(input);
  const isValid = ids.length > 0;
  const hasRunning = tasks.some(t => t.status === 'running');
  const hasPaused = tasks.some(t => t.status === 'paused');

  const startRemove = useCallback(
    (taskId: string) => {
      if (leavingRef.current.has(taskId)) return;
      leavingRef.current.add(taskId);
      setLeaving(new Set(leavingRef.current));
      const timer = setTimeout(() => {
        leavingRef.current.delete(taskId);
        leaveTimersRef.current.delete(taskId);
        setLeaving(new Set(leavingRef.current));
        useDownloadStore.getState().remove(taskId);
      }, LEAVE_ANIM_MS);
      leaveTimersRef.current.set(taskId, timer);
    },
    [],
  );

  useEffect(() => {
    const map = leaveTimersRef.current;
    return () => {
      map.forEach(timer => clearTimeout(timer));
      map.clear();
    };
  }, []);

  useEffect(() => {
    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    tasks.forEach(t => {
      if (t.status !== 'done' || leavingRef.current.has(t.id) || pending.has(t.id)) return;
      pending.set(t.id, setTimeout(() => startRemove(t.id), AUTO_REMOVE_MS));
    });
    return () => pending.forEach(timer => clearTimeout(timer));
  }, [tasks, startRemove]);

  function handleRemoveTask(taskId: string) {
    startRemove(taskId);
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
    void startDownload(taskId);
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
        <div className="app-empty">
          <EmptyState
            icon="cloud-download"
            title="暂无下载任务"
            hint="在上方输入漫画ID开始下载"
          />
        </div>
      ) : (
        <div className="tasks-stack">
          {tasks.map(task => {
            const statusIcon = STATUS_ICON[task.status];
            return (
              <div
                className={`task-tile${leaving.has(task.id) ? ' is-leaving' : ''}`}
                key={task.id}
              >
                <div className={`task-head${statusIcon ? ' has-icon' : ''}`}>
                  {statusIcon ? (
                    <span className={`task-status-icon is-${task.status}`}>
                      <Icon name={statusIcon} size={16} />
                    </span>
                  ) : null}
                  <span className={`task-title${hasJapanese(task.title) ? ' is-ja' : ''}`}>{task.title}</span>
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
                    <button className="task-action" onClick={() => cancel(task.id)}>
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
