import {ApiClient} from '../../core/api';
import {createHttpClient} from '../../core/net';
import {useSettingsStore} from '../stores/settings';

export interface ApiOptions {
  proxyEnabled: boolean;
  proxy: string;
  retryTimes: number;
}

export function currentApiOptions(): ApiOptions {
  const {settings} = useSettingsStore.getState();
  return {
    proxyEnabled: settings.proxyEnabled,
    proxy: settings.proxy,
    retryTimes: settings.retryTimes,
  };
}

/** Builds an ApiClient from explicit options, or from the persisted settings. */
export function createApi(opts?: ApiOptions): ApiClient {
  const {proxyEnabled, proxy, retryTimes} = opts ?? currentApiOptions();
  const http = createHttpClient({
    ...(proxyEnabled && proxy ? {proxy} : {}),
    maxRetries: retryTimes,
  });
  return new ApiClient(http);
}
