import {t} from '@/web/i18n';
import {useCallback, useEffect} from 'react';
import {App} from '@capacitor/app';
import {Capacitor, type PluginListenerHandle} from '@capacitor/core';
import {showToast} from '@/web/stores/toast';
import {
  buildApkCandidates,
  decideUpdate,
  downloadApkToCache,
  fetchLatestRelease,
  installCachedApk,
} from '@/core/update';
import {appVersionFallback} from '@/web/version';
import type {CheckUpdateResult} from '@/web/stores/update';
import {useUpdateStore} from '@/web/stores/update';

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
  const force = useUpdateStore((s) => s.force);
  const apkSize = useUpdateStore((s) => s.apkSize);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const latestNotes = useUpdateStore((s) => s.latestNotes);
  const mirrorIndex = useUpdateStore((s) => s.mirrorIndex);
  const source = useUpdateStore((s) => s.source);

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
    s.setApk([], undefined, undefined);
    s.setForce(false);
    try {
      const local = await loadCurrentVersion();
      const release = await fetchLatestRelease();
      const decision = decideUpdate(local, release.manifest);
      s.setSource(release.source);
      if (decision.kind === 'none') {
        s.setLatest(null, null);
        s.setStatus('idle');
        return {kind: 'up-to-date', current: local.version};
      }

      const manifest = decision.manifest;
      const candidates = buildApkCandidates(release.tag);
      s.setApk(candidates, manifest.apkSha256, manifest.apkSize);
      s.setForce(decision.kind === 'force');
      s.setLatest(manifest.version, manifest.notes ?? null);
      s.setStatus('idle');
      return {
        kind: 'available',
        current: local.version,
        latest: manifest.version,
        releaseNotes: manifest.notes ?? '',
        force: decision.kind === 'force',
        ...(manifest.apkSize != null ? {apkSize: manifest.apkSize} : {}),
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
      throw new Error(t('update.androidOnly'));
    }
    const s = useUpdateStore.getState();
    const candidates = s.apkCandidates;
    if (candidates.length === 0) {
      throw new Error('no pending update');
    }
    s.setStatus('downloading');
    s.setProgress(0);
    s.setError(null);
    try {
      await downloadApkToCache(
        candidates,
        s.apkSha256,
        (loaded, total) => {
          s.setProgress(total > 0 ? Math.round((loaded / total) * 100) : 0);
        },
        (index) => s.setMirror(index)
      );
      s.setStatus('installing');
      await installCachedApk();
      s.setStatus('idle');
      s.setProgress(100);
      s.setPromptOpen(false);
      showToast(t('update.installed'), 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      s.setError(msg);
      s.setStatus('error');
      showToast(t('update.failed'), 'error');
      throw e;
    }
  }, []);

  const canInstallInApp = Capacitor.getPlatform() === 'android';

  return {
    currentVersion,
    status,
    progress,
    error,
    force,
    apkSize,
    latestVersion,
    latestNotes,
    mirrorIndex,
    source,
    canInstallInApp,
    checkUpdate,
    downloadAndInstall,
  };
}
