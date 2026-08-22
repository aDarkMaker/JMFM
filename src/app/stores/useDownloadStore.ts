import {create} from 'zustand';

export type TaskStatus = 'pending' | 'downloading' | 'paused' | 'done' | 'error';

export interface DownloadTask {
  id: string;
  albumId: number;
  title: string;
  status: TaskStatus;
  progress: number;
  chapters: number;
  doneChapters: number;
}

interface DownloadState {
  tasks: DownloadTask[];
  add: (task: DownloadTask) => void;
  update: (id: string, patch: Partial<DownloadTask>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useDownloadStore = create<DownloadState>(set => ({
  tasks: [],
  add: task => set(state => ({tasks: [task, ...state.tasks]})),
  update: (id, patch) =>
    set(state => ({
      tasks: state.tasks.map(t => (t.id === id ? {...t, ...patch} : t)),
    })),
  remove: id => set(state => ({tasks: state.tasks.filter(t => t.id !== id)})),
  clear: () => set({tasks: []}),
}));
