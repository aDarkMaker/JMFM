import {FileOpener} from '@capawesome-team/capacitor-file-opener';
import {getCachedApkUri} from './download-apk';

export async function installCachedApk(): Promise<void> {
  const uri = await getCachedApkUri();
  await FileOpener.openFile({
    path: uri,
    mimeType: 'application/vnd.android.package-archive',
  });
}
