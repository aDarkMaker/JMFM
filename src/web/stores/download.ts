import {create} from 'zustand';

export type TaskStatus = 'pending' | 'running' | 'done' | 'error';

export interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  progress: number;
  total: number;
  error?: string;
}

interface DownloadState {
  tasks: Task[];
  add(task: Omit<Task, 'status' | 'progress'>): void;
  updateProgress(id: number, progress: number): void;
  setStatus(id: number, status: TaskStatus, error?: string): void;
}

export const useDownloadStore = create<DownloadState>(set => ({
  tasks: [],
  add(task) {
    set(state => ({
      tasks: [...state.tasks, {...task, status: 'pending', progress: 0}],
    }));
  },
  updateProgress(id, progress) {
    set(state => ({
      tasks: state.tasks.map(t =>
        t.id === id ? {...t, progress} : t,
      ),
    }));
  },
  setStatus(id, status, error) {
    set(state => ({
      tasks: state.tasks.map(t =>
        t.id === id ? {...t, status, error} : t,
      ),
    }));
  },
}));
