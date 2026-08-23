import {create} from 'zustand';
import {DownloadController} from '../../core/download';

export type TaskStatus = 'pending' | 'running' | 'paused' | 'done' | 'error';

export interface Task {
  id: string;
  albumId: number;
  title: string;
  status: TaskStatus;
  done: number;
  total: number;
  chaptersDone: number;
  chaptersTotal: number;
  error?: string;
  controller?: DownloadController;
}

interface DownloadState {
  tasks: Task[];
  add(task: Omit<Task, 'status' | 'done' | 'chaptersDone' | 'chaptersTotal' | 'total'>): void;
  addBatch(tasks: Omit<Task, 'status' | 'done' | 'chaptersDone' | 'chaptersTotal' | 'total'>[]): void;
  remove(id: string): void;
  setStatus(id: string, status: TaskStatus, error?: string): void;
  updateProgress(id: string, done: number, total: number): void;
  updateChapter(id: string, chaptersDone: number, chaptersTotal: number): void;
  setTitle(id: string, title: string): void;
  setController(id: string, controller: DownloadController): void;
  pauseAll(): void;
  resumeAll(): void;
}

function newTask(
  t: Omit<Task, 'status' | 'done' | 'chaptersDone' | 'chaptersTotal' | 'total'>,
): Task {
  return {
    ...t,
    status: 'pending',
    done: 0,
    total: 0,
    chaptersDone: 0,
    chaptersTotal: 0,
  };
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  tasks: [],
  add(task) {
    set(state => {
      if (state.tasks.some(t => t.albumId === task.albumId)) {
        return state;
      }
      return {tasks: [...state.tasks, newTask(task)]};
    });
  },
  addBatch(tasks) {
    set(state => {
      const existing = new Set(state.tasks.map(t => t.albumId));
      const next = tasks.filter(t => !existing.has(t.albumId));
      if (next.length === 0) {
        return state;
      }
      return {tasks: [...state.tasks, ...next.map(newTask)]};
    });
  },
  remove(id) {
    set(state => ({tasks: state.tasks.filter(t => t.id !== id)}));
  },
  setStatus(id, status, error) {
    set(state => ({
      tasks: state.tasks.map(t => (t.id === id ? {...t, status, error} : t)),
    }));
  },
  updateProgress(id, done, total) {
    set(state => ({
      tasks: state.tasks.map(t => (t.id === id ? {...t, done, total} : t)),
    }));
  },
  updateChapter(id, chaptersDone, chaptersTotal) {
    set(state => ({
      tasks: state.tasks.map(t =>
        t.id === id ? {...t, chaptersDone, chaptersTotal} : t,
      ),
    }));
  },
  setTitle(id, title) {
    set(state => ({
      tasks: state.tasks.map(t => (t.id === id ? {...t, title} : t)),
    }));
  },
  setController(id, controller) {
    set(state => ({
      tasks: state.tasks.map(t => (t.id === id ? {...t, controller} : t)),
    }));
  },
  pauseAll() {
    const {tasks} = get();
    tasks.forEach(t => {
      if (t.status === 'running' || t.status === 'pending') {
        t.controller?.cancel();
      }
    });
  },
  resumeAll() {
    const {tasks} = get();
    tasks.forEach(t => {
      if (t.status === 'paused') {
        set(state => ({
          tasks: state.tasks.map(x =>
            x.id === t.id ? {...x, status: 'pending' as const} : x,
          ),
        }));
      }
    });
  },
}));
