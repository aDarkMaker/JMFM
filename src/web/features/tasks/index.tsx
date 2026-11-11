import {useCallback, useEffect, useRef, useState, type FormEvent} from 'react';
import {gsap} from 'gsap';
import type {TaskStatus} from '@/web/stores/download';
import {useDownloadStore} from '@/web/stores/download';
import {ProgressBar} from '@/web/ui/ProgressBar';
import {EmptyState} from '@/web/ui/EmptyState';
import {SectionHeader} from '@/web/ui/SectionHeader';
import {Badge} from '@/web/ui/Badge';
import type {BadgeTone} from '@/web/ui/Badge';
import {Button} from '@/web/ui/Button';
import {Input} from '@/web/ui/Input';
import {t, type MessageKey} from '@/web/i18n';
import {Icon} from '@/web/shared/Icon';
import {showToast} from '@/web/ui/Toast';
import {useDownloadTask} from '@/web/hooks/useDownloadTask';
import {hasJapanese} from '@/web/hooks/useJapaneseFont';
import styles from './tasks.module.css';

const AUTO_REMOVE_MS = 3000;
const STACK_GAP_PX = 12;

const BADGE_KEY: Record<TaskStatus, MessageKey> = {
  pending: 'tasks.statusPending',
  running: 'tasks.statusRunning',
  paused: 'tasks.statusPaused',
  done: 'tasks.statusDone',
  error: 'tasks.statusError',
};

const BADGE_TONE: Record<TaskStatus, BadgeTone> = {
  pending: 'neutral',
  running: 'accent',
  paused: 'neutral',
  done: 'success',
  error: 'danger',
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
  const inputRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef(new Map<string, HTMLDivElement>());
  const leavingRef = useRef(new Set<string>());
  const autoRemoveTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const scheduledRemoveRef = useRef(new Set<string>());
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
    for (const task of tasks) {
      if (task.status !== 'done') continue;
      if (scheduledRemoveRef.current.has(task.id) || leavingRef.current.has(task.id)) continue;
      if (!notifiedDoneRef.current.has(task.id)) {
        notifiedDoneRef.current.add(task.id);
        showToast(t('tasks.doneToast', {title: task.title}), 'success');
      }
      if (task.done <= 0) {
        scheduledRemoveRef.current.add(task.id);
        startRemove(task.id);
        continue;
      }
      scheduledRemoveRef.current.add(task.id);
      const timer = setTimeout(() => {
        autoRemoveTimersRef.current.delete(task.id);
        startRemove(task.id);
      }, AUTO_REMOVE_MS);
      autoRemoveTimersRef.current.set(task.id, timer);
    }
  }, [tasks, startRemove]);

  function handleRemoveTask(taskId: string) {
    const task = useDownloadStore.getState().tasks.find((t) => t.id === taskId);
    removeTask(taskId);
    startRemove(taskId);
    if (task && task.status === 'done') {
      showToast(t('library.deleted', {title: task.title}), 'info');
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) {
      setShaking(true);
      inputRef.current?.querySelector('input')?.focus();
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = setTimeout(() => setShaking(false), 280);
      showToast(t('tasks.invalid'), 'error');
      return;
    }
    const existing = new Set(useDownloadStore.getState().tasks.map((t) => t.albumId));
    const fresh = ids.filter((id) => !existing.has(id));
    if (fresh.length === 0) {
      setInput('');
      showToast(t('tasks.duplicate'), 'info');
      return;
    }
    fresh.forEach((id) => enqueueAlbum(id, t('tasks.albumPlaceholder', {id})));
    setInput('');
    showToast(t('tasks.queued', {count: fresh.length}), 'success');
  }

  function handleResume(taskId: string) {
    void startDownload(taskId);
    const task = useDownloadStore.getState().tasks.find((t) => t.id === taskId);
    showToast(task?.status === 'error' ? t('tasks.restarted') : t('tasks.resumed'), 'info');
  }

  return (
    <div className="app-screen">
      <SectionHeader
        title={t('tasks.title')}
        actionLabel={hasRunning ? t('tasks.pauseAll') : hasPaused ? t('tasks.resumeAll') : undefined}
        actionIcon={hasRunning ? 'pause' : hasPaused ? 'play-arrow' : undefined}
        onAction={
          hasRunning
            ? () => {
                pauseAll();
                showToast(t('tasks.pausedAll'), 'info');
              }
            : hasPaused
              ? () => {
                  resumeAll();
                  showToast(t('tasks.resumedAll'), 'info');
                }
              : undefined
        }
      />
      <form className={styles.form} onSubmit={handleSubmit}>
        <div
          ref={inputRef}
          className={[styles.field, shaking ? styles.shake : ''].filter(Boolean).join(' ')}
        >
          <Input
            value={input}
            onChange={setInput}
            variant="capsule"
            placeholder={t('tasks.inputPlaceholder')}
            inputMode="numeric"
            invalid={shaking}
          />
        </div>
        <Button
          type="submit"
          className={styles.submit}
          disabled={!isValid}
          aria-label={t('tasks.submit')}
          iconLeft={<Icon name="add" size={20} />}
        />
      </form>
      {tasks.length === 0 ? (
        <div className="app-empty">
          <EmptyState
            icon="download"
            title={t('tasks.empty')}
            hint={t('tasks.emptyHint')}
          />
        </div>
      ) : (
        <div className={styles.stack}>
          {tasks.map((task) => (
            <div
              className={styles.tile}
              key={task.id}
              ref={(el) => {
                if (el) {
                  tileRefs.current.set(task.id, el);
                } else {
                  tileRefs.current.delete(task.id);
                }
              }}
            >
              <div className={styles.head}>
                <span className={[styles.title, hasJapanese(task.title) ? styles.titleJa : ''].filter(Boolean).join(' ')}>
                  {task.title}
                </span>
                <Badge tone={BADGE_TONE[task.status]}>{t(BADGE_KEY[task.status])}</Badge>
              </div>
              <ProgressBar progress={(task.done / Math.max(1, task.total)) * 100} status={task.status} size="sm" />
              <span className={styles.meta}>
                {task.status === 'running' || task.status === 'done'
                  ? t('tasks.progress', {
                      done: task.done,
                      total: task.total,
                      chaptersDone: task.chaptersDone,
                      chaptersTotal: task.chaptersTotal,
                    })
                  : t('tasks.pagesOnly', {total: task.total})}
              </span>
              {task.error ? <span className={styles.error}>{task.error}</span> : null}
              <div className={styles.actions}>
                {task.status === 'running' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<Icon name="pause" size={16} />}
                    onClick={() => cancel(task.id)}
                  >
                    {t('common.pause')}
                  </Button>
                ) : null}
                {task.status === 'paused' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<Icon name="play-arrow" size={16} />}
                    onClick={() => handleResume(task.id)}
                  >
                    {t('common.resume')}
                  </Button>
                ) : null}
                {task.status === 'error' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<Icon name="refresh" size={16} />}
                    onClick={() => handleResume(task.id)}
                  >
                    {t('common.retry')}
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => handleRemoveTask(task.id)}>
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
