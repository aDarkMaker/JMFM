export * from './http';
export * from './native-http';
export * from './fetch-http';

import {Capacitor} from '@capacitor/core';
import {HttpClient, HttpOptions} from './http';
import {FetchHttpClient} from './fetch-http';
import {NativeHttpClient} from './native-http';

export function createHttpClient(opts: HttpOptions = {}): HttpClient {
  return Capacitor.isNativePlatform() ? new NativeHttpClient(opts) : new FetchHttpClient(opts);
}
