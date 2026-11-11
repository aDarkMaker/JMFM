import {create} from 'zustand';

export type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'installing' | 'error';

export type UpdateKind = 'up-to-date' | 'available' | 'error';

export interface CheckUpdateResult {
  kind: UpdateKind;
  current: string;
  latest?: string;
  releaseNotes?: string;
  /** True when the installed build is below the release's `minVersionCode`. */
  force?: boolean;
  apkSize?: number;
  error?: string;
}

interface UpdateState {
  currentVersion: string;
  status: UpdateStatus;
  progress: number;
  error: string | null;
  apkCandidates: string[];
  apkSha256: string | undefined;
  apkSize: number | undefined;
  force: boolean;
  latestVersion: string | null;
  latestNotes: string | null;
  mirrorIndex: number;
  source: 'api' | 'raw' | 'cache' | null;
  /** Drives the app-level update dialog from any screen. */
  promptOpen: boolean;
  setPromptOpen(open: boolean): void;
  setCurrentVersion(version: string): void;
  setStatus(status: UpdateStatus): void;
  setProgress(progress: number): void;
  setError(error: string | null): void;
  setApk(candidates: string[], sha256?: string, size?: number): void;
  setForce(force: boolean): void;
  setLatest(version: string | null, notes?: string | null): void;
  setMirror(index: number): void;
  setSource(source: UpdateState['source']): void;
  reset(): void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  currentVersion: '',
  status: 'idle',
  progress: 0,
  error: null,
  apkCandidates: [],
  apkSha256: undefined,
  apkSize: undefined,
  force: false,
  latestVersion: null,
  latestNotes: null,
  mirrorIndex: 0,
  source: null,
  promptOpen: false,
  setCurrentVersion: (currentVersion) => set({currentVersion}),
  setStatus: (status) => set({status}),
  setProgress: (progress) => set({progress}),
  setError: (error) => set({error}),
  setApk: (apkCandidates, apkSha256, apkSize) => set({apkCandidates, apkSha256, apkSize}),
  setForce: (force) => set({force}),
  setLatest: (latestVersion, latestNotes = null) => set({latestVersion, latestNotes}),
  setMirror: (mirrorIndex) => set({mirrorIndex}),
  setSource: (source) => set({source}),
  setPromptOpen: (promptOpen) => set({promptOpen}),
  reset: () =>
    set({
      status: 'idle',
      progress: 0,
      error: null,
      apkCandidates: [],
      apkSha256: undefined,
      apkSize: undefined,
      force: false,
      latestVersion: null,
      latestNotes: null,
      mirrorIndex: 0,
      source: null,
      promptOpen: false,
    }),
}));
