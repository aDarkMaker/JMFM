import {useCallback, useEffect, useRef, useState, type FormEvent} from 'react';
import {gsap} from 'gsap';
import {useDownloadStore, TaskStatus} from '../stores/download';
import {ProgressBar} from '../components/ProgressBar';
import {EmptyState} from '../components/EmptyState';
import {SectionHeader} from '../components/SectionHeader';
import {Icon} from '../components/Icon';
import {useToastStore} from '../stores/toast';
import {useDownloadTask} from '../hooks/useDownloadTask';
import {hasJapanese} from '../hooks/useJapaneseFont';

const AUTO_REMOVE_MS = 3000;
const STACK_GAP_PX = 12;

const BADGE_TEXT: Record<TaskStatus, string> = {
  pending: '等待中',
  running: '下载中',
  paused: '已暂停',
  done: '已完成',
  error: '失败',
};

function parseIds(input: string): number[] {
  return input
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map(Number);
}

export function TasksScreen() {
  const tasks = useDownloadStore((s) => s.tasks);
  const pauseAll = useDownloadStore((s) => s.pauseAll);
  const resumeAll = useDownloadStore((s) => s.resumeAll);
  const {startDownload, cancel, removeTask, enqueueAlbum} = useDownloadTask();
  const [input, setInput] = useState('');
  const [shaking, setShaking] = useState(false);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tileRefs = useRef(new Map<string, HTMLDivElement>());
  const leavingRef = useRef(new Set<string>());
  const autoRemoveTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const scheduledRemoveRef = useRef(new Set<string>());
  const showToast = useToastStore((s) => s.show);
  const notifiedDoneRef = useRef(new Set<string>());
  const ids = parseIds(input);
  const isValid = ids.length > 0;
  const hasRunning = tasks.some((t) => t.status === 'running');
  const hasPaused = tasks.some((t) => t.status === 'paused');

  const startRemove = useCallback((taskId: string) => {
    if (leavingRef.current.has(taskId)) return;
    const auto = autoRemoveTimersRef.current.get(taskId);
    if (auto) {
      clearTimeout(auto);
      autoRemoveTimersRef.current.delete(taskId);
    }
    scheduledRemoveRef.current.add(taskId);
    leavingRef.current.add(taskId);

    const el = tileRefs.current.get(taskId);
    const finish = () => {
      leavingRef.current.delete(taskId);
      scheduledRemoveRef.current.delete(taskId);
      tileRefs.current.delete(taskId);
      useDownloadStore.getState().remove(taskId);
    };

    if (!el) {
      finish();
      return;
    }

    const h = el.offsetHeight;
    gsap.killTweensOf(el);
    gsap.set(el, {
      height: h,
      overflow: 'hidden',
      marginBottom: 0,
    });
    gsap.to(el, {
      height: 0,
      opacity: 0,
      paddingTop: 0,
      paddingBottom: 0,
      marginBottom: -STACK_GAP_PX,
      duration: 0.28,
      ease: 'power2.inOut',
      overwrite: true,
      onComplete: finish,
    });
  }, []);

  useEffect(() => {
    const autoMap = autoRemoveTimersRef.current;
    const tiles = tileRefs.current;
    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      autoMap.forEach((timer) => clearTimeout(timer));
      autoMap.clear();
      scheduledRemoveRef.current.clear();
      tiles.forEach((el) => gsap.killTweensOf(el));
      tiles.clear();
      leavingRef.current.clear();
      notifiedDoneRef.current.clear();
    };
  }, []);

  useEffect(() => {
    for (const t of tasks) {
      if (t.status !== 'done') continue;
      if (scheduledRemoveRef.current.has(t.id) || leavingRef.current.has(t.id)) continue;
      if (!notifiedDoneRef.current.has(t.id)) {
        notifiedDoneRef.current.add(t.id);
        showToast(`「${t.title}」下载完成`, 'success');
      }
      if (t.done <= 0) {
        scheduledRemoveRef.current.add(t.id);
        startRemove(t.id);
        continue;
      }
      scheduledRemoveRef.current.add(t.id);
      const timer = setTimeout(() => {
        autoRemoveTimersRef.current.delete(t.id);
        startRemove(t.id);
      }, AUTO_REMOVE_MS);
      autoRemoveTimersRef.current.set(t.id, timer);
    }
  }, [tasks, startRemove, showToast]);

  function handleRemoveTask(taskId: string) {
    const task = useDownloadStore.getState().tasks.find((t) => t.id === taskId);
    removeTask(taskId);
    startRemove(taskId);
    if (task && task.status === 'done') {
      showToast(`已删除：${task.title}`, 'info');
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) {
      setShaking(true);
      inputRef.current?.focus();
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = setTimeout(() => setShaking(false), 280);
      showToast('请输入有效的漫画 ID', 'error');
      return;
    }
    const existing = new Set(useDownloadStore.getState().tasks.map((t) => t.albumId));
    const fresh = ids.filter((id) => !existing.has(id));
    if (fresh.length === 0) {
      setInput('');
      showToast('该漫画已在下载队列', 'info');
      return;
    }
    fresh.forEach((id) => enqueueAlbum(id, `漫画 ${id}`));
    setInput('');
    showToast(`已加入下载队列：${fresh.length} 本`, 'success');
  }

  function handleResume(taskId: string) {
    void startDownload(taskId);
    const task = useDownloadStore.getState().tasks.find((t) => t.id === taskId);
    showToast(
      task?.status === 'error' ? '已重新开始下载' : '已继续下载',
      'info'
    );
  }

  return (
    <div className="app-screen">
      <SectionHeader
        title="下载"
        actionLabel={hasRunning ? '全部暂停' : hasPaused ? '全部继续' : undefined}
        actionIcon={hasRunning ? 'pause' : hasPaused ? 'play-arrow' : undefined}
        onAction={
          hasRunning
            ? () => {
                pauseAll();
                showToast('已暂停全部下载', 'info');
              }
            : hasPaused
              ? () => {
                  resumeAll();
                  showToast('已继续全部下载', 'info');
                }
              : undefined
        }
      />
      <form className="download-input-section" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className={`download-input${shaking ? ' is-shaking' : ''}`}
          placeholder="输入漫画ID"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="download-button" type="submit" disabled={!isValid} aria-label="下载">
          <Icon name="add" size={20} />
        </button>
      </form>
      {tasks.length === 0 ? (
        <div className="app-empty">
          <EmptyState icon="cloud-download" title="暂无下载任务" hint="在上方输入漫画ID开始下载" />
        </div>
      ) : (
        <div className="tasks-stack">
          {tasks.map((task) => {
            return (
              <div
                className="task-tile"
                key={task.id}
                ref={(el) => {
                  if (el) {
                    tileRefs.current.set(task.id, el);
                  } else {
                    tileRefs.current.delete(task.id);
                  }
                }}
              >
                <div className="task-head">
                  <span className={`task-title${hasJapanese(task.title) ? ' is-ja' : ''}`}>
                    {task.title}
                  </span>
                  <span className={`task-badge is-${task.status}`}>{BADGE_TEXT[task.status]}</span>
                </div>
                <ProgressBar
                  progress={(task.done / Math.max(1, task.total)) * 100}
                  status={task.status}
                  size="sm"
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
                  <button
                    className="task-action task-action-danger"
                    onClick={() => handleRemoveTask(task.id)}
                  >
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
