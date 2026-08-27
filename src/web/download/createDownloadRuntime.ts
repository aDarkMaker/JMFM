import {Capacitor} from '@capacitor/core';
import {createRuntime} from '../../core/download/runtime';
import type {DownloadRuntime} from '../../core/download';
import type {Settings} from '../../data/settings';
import {createSafRuntime} from './safRuntime';

export function createDownloadRuntime(
  settings: Pick<Settings, 'downloadPath' | 'downloadTreeUri'>
): DownloadRuntime {
  if (Capacitor.isNativePlatform() && settings.downloadTreeUri) {
    return createSafRuntime(settings.downloadTreeUri, settings.downloadPath);
  }
  return createRuntime();
}
