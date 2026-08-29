import {create} from 'zustand';

export type RepairPhase = 'idle' | 'scanning' | 'queued';

interface RepairState {
  phase: RepairPhase;
  done: number;
  total: number;
  message: string;
  beginScan(): void;
  setScanProgress(done: number, total: number): void;
  setQueued(message: string): void;
  reset(): void;
}

export const useRepairStore = create<RepairState>((set) => ({
  phase: 'idle',
  done: 0,
  total: 0,
  message: '',
  beginScan: () => set({phase: 'scanning', done: 0, total: 0, message: ''}),
  setScanProgress: (done, total) => set({done, total}),
  setQueued: (message) => set({phase: 'queued', done: 0, total: 0, message}),
  reset: () => set({phase: 'idle', done: 0, total: 0, message: ''}),
}));
