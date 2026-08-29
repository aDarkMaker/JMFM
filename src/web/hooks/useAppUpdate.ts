import {useCallback, useEffect} from 'react';
import {App} from '@capacitor/app';
import {Capacitor, type PluginListenerHandle} from '@capacitor/core';
import {
  downloadApkToCache,
  fetchLatestRelease,
  installCachedApk,
  isNewerVersion,
} from '../../core/update';
import {appVersionFallback} from '../version';
import {useUpdateStore, CheckUpdateResult} from '../stores/update';

interface LocalAppInfo {
  version: string;
  versionCode?: number;
}

async function loadLocalInfo(): Promise<LocalAppInfo> {
  if (Capacitor.isNativePlatform()) {
    const info = await App.getInfo();
    const build = Number(info.build);
    return {
      version: info.version,
      versionCode: Number.isFinite(build) ? build : undefined,
    };
  }
  return {version: appVersionFallback()};
}

export function useAppUpdate() {
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const status = useUpdateStore((s) => s.status);
  const progress = useUpdateStore((s) => s.progress);
  const error = useUpdateStore((s) => s.error);

  const loadCurrentVersion = useCallback(async (): Promise<LocalAppInfo> => {
    const info = await loadLocalInfo();
    useUpdateStore.getState().setCurrentVersion(info.version);
    return info;
  }, []);

  useEffect(() => {
    void loadCurrentVersion();
    let handle: PluginListenerHandle | null = null;
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({isActive}) => {
        if (isActive) {
          void loadCurrentVersion();
        }
      }).then((h) => {
        handle = h;
      });
    }
    return () => {
      void handle?.remove();
    };
  }, [loadCurrentVersion]);

  const checkUpdate = useCallback(async (): Promise<CheckUpdateResult> => {
    const s = useUpdateStore.getState();
    s.setStatus('checking');
    s.setError(null);
    s.setApk(null, undefined);
    try {
      const local = await loadCurrentVersion();
      const release = await fetchLatestRelease();
      const remote = release.version;
      const hasUpdate =
        (local.versionCode != null && remote.versionCode > local.versionCode) ||
        (local.versionCode == null && isNewerVersion(local.version, remote.version));
      if (!hasUpdate) {
        s.setStatus('idle');
        return {kind: 'up-to-date', current: local.version};
      }
      s.setApk(release.apkDownloadUrl, release.version.apkSha256);
      s.setStatus('idle');
      return {
        kind: 'available',
        current: local.version,
        latest: remote.version,
        releaseNotes: release.releaseNotes,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      s.setError(msg);
      s.setStatus('error');
      return {kind: 'error', current: currentVersion, error: msg};
    }
  }, [currentVersion, loadCurrentVersion]);

  const downloadAndInstall = useCallback(async (): Promise<void> => {
    if (Capacitor.getPlatform() !== 'android') {
      throw new Error('应用内安装仅支持 Android');
    }
    const s = useUpdateStore.getState();
    const url = s.apkUrl;
    if (!url) {
      throw new Error('no pending update');
    }
    s.setStatus('downloading');
    s.setProgress(0);
    s.setError(null);
    try {
      await downloadApkToCache(url, s.apkSha256, (loaded, total) => {
        s.setProgress(total > 0 ? Math.round((loaded / total) * 100) : 0);
      });
      s.setStatus('installing');
      await installCachedApk();
      s.setStatus('idle');
      s.setProgress(100);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      s.setError(msg);
      s.setStatus('error');
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
