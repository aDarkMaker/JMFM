import {useCallback, useEffect, useRef, useState} from 'react';
import {App} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {
  downloadApkToCache,
  fetchLatestRelease,
  installCachedApk,
  isNewerVersion,
} from '../../core/update';
import {appVersionFallback} from '../version';

export type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'installing' | 'error';

export interface CheckUpdateResult {
  kind: 'up-to-date' | 'available' | 'error';
  current: string;
  latest?: string;
  releaseNotes?: string;
  error?: string;
}

export function useAppUpdate() {
  const [currentVersion, setCurrentVersion] = useState('');
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const apkUrlRef = useRef<string | null>(null);

  const loadCurrentVersion = useCallback(async (): Promise<string> => {
    if (Capacitor.isNativePlatform()) {
      const info = await App.getInfo();
      setCurrentVersion(info.version);
      return info.version;
    }
    const v = appVersionFallback();
    setCurrentVersion(v);
    return v;
  }, []);

  useEffect(() => {
    void loadCurrentVersion();
  }, [loadCurrentVersion]);

  const checkUpdate = useCallback(async (): Promise<CheckUpdateResult> => {
    setStatus('checking');
    setError(null);
    apkUrlRef.current = null;
    try {
      const current = await loadCurrentVersion();
      const release = await fetchLatestRelease();
      const latest = release.version.version;
      if (!isNewerVersion(current, latest)) {
        setStatus('idle');
        return {kind: 'up-to-date', current};
      }
      apkUrlRef.current = release.apkDownloadUrl;
      setStatus('idle');
      return {
        kind: 'available',
        current,
        latest,
        releaseNotes: release.releaseNotes,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus('error');
      return {kind: 'error', current: currentVersion, error: msg};
    }
  }, [currentVersion, loadCurrentVersion]);

  const downloadAndInstall = useCallback(async (): Promise<void> => {
    if (Capacitor.getPlatform() !== 'android') {
      throw new Error('应用内安装仅支持 Android');
    }
    const url = apkUrlRef.current;
    if (!url) {
      throw new Error('no pending update');
    }
    setStatus('downloading');
    setProgress(0);
    setError(null);
    try {
      await downloadApkToCache(url, (loaded, total) => {
        setProgress(total > 0 ? Math.round((loaded / total) * 100) : 0);
      });
      setStatus('installing');
      await installCachedApk();
      setStatus('idle');
      setProgress(100);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus('error');
      throw e;
    }
  }, []);

  const canInstallInApp = Capacitor.getPlatform() === 'android';

  return {
    currentVersion,
    status,
    progress,
    error,
    canInstallInApp,
    checkUpdate,
    downloadAndInstall,
  };
}
