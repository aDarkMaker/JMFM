import {useDownloadStore, TaskStatus} from '../stores/download';
import {ProgressBar} from '../components/ProgressBar';
import {EmptyState} from '../components/EmptyState';
import {SectionHeader} from '../components/SectionHeader';

const BADGE_TEXT: Record<TaskStatus, string> = {
  pending: '等待中',
  running: '下载中',
  done: '已完成',
  error: '失败',
};

export function TasksScreen() {
  const tasks = useDownloadStore(s => s.tasks);

  return (
    <div className="app-screen">
      <SectionHeader title="下载" actionLabel={tasks.length ? '全部暂停' : undefined} />
      {tasks.length === 0 ? (
        <EmptyState
          icon="download"
          title="暂无下载任务"
          hint="在首页或漫画库中选择漫画开始下载"
        />
      ) : (
        <div className="tasks-stack">
          {tasks.map(task => (
            <div className="task-tile" key={task.id}>
              <div className="task-head">
                <span className="task-title">{task.title}</span>
                <span className={`task-badge is-${task.status}`}>
                  {BADGE_TEXT[task.status]}
                </span>
              </div>
              <ProgressBar
                progress={(task.progress / Math.max(1, task.total)) * 100}
                status={task.status}
              />
              <span className="task-meta">
                {task.status === 'running' || task.status === 'done'
                  ? `${task.progress} / ${task.total}`
                  : `${task.total} 页`}
              </span>
              {task.error ? <span className="task-error">{task.error}</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
