import {REQUEST} from '../constants';
import {FetchResult} from './http';
import {sleep} from './http';

export async function requestWithRetry(
  urls: string[],
  maxRetries: number | undefined,
  tryOnce: (url: string) => Promise<FetchResult>
): Promise<FetchResult> {
  const retries = maxRetries ?? REQUEST.MAX_RETRIES;
  let lastError = '';
  for (const url of urls) {
    for (let attempt = 0; attempt < retries; attempt++) {
      const result = await tryOnce(url);
      if (result.ok) {
        return result;
      }
      lastError = result.error || `status ${result.status}`;
      if (result.retryable === false) {
        break;
      }
      if (attempt < retries - 1) {
        await sleep(REQUEST.RETRY_INTERVAL_MS);
      }
    }
  }
  return {ok: false, status: 0, error: lastError};
}

export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries?: number,
  intervalMs?: number,
  shouldRetry?: (e: unknown) => boolean
): Promise<T> {
  const retries = maxRetries ?? REQUEST.MAX_RETRIES;
  let last: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (shouldRetry && !shouldRetry(e)) {
        throw e;
      }
      if (attempt < retries - 1) {
        await sleep(intervalMs ?? REQUEST.RETRY_INTERVAL_MS);
      }
    }
  }
  throw last;
}
