import {create} from 'zustand';

export type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'installing' | 'error';

export interface CheckUpdateResult {
  kind: 'up-to-date' | 'available' | 'error';
  current: string;
  latest?: string;
  releaseNotes?: string;
  error?: string;
}

interface UpdateState {
  currentVersion: string;
  status: UpdateStatus;
  progress: number;
  error: string | null;
  apkUrl: string | null;
  apkSha256: string | undefined;
  setCurrentVersion(version: string): void;
  setStatus(status: UpdateStatus): void;
  setProgress(progress: number): void;
  setError(error: string | null): void;
  setApk(url: string | null, sha256?: string): void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  currentVersion: '',
  status: 'idle',
  progress: 0,
  error: null,
  apkUrl: null,
  apkSha256: undefined,
  setCurrentVersion: (currentVersion) => set({currentVersion}),
  setStatus: (status) => set({status}),
  setProgress: (progress) => set({progress}),
  setError: (error) => set({error}),
  setApk: (apkUrl, apkSha256) => set({apkUrl, apkSha256}),
}));
