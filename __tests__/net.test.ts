import {buildBaseUrls} from '@/core/net';
import {isRetryableStatus} from '@/core/net/fetch-once';
import {requestWithRetry} from '@/core/net/retry';
import {FetchResult} from '@/core/net/http';
import {isValidBase64, base64ToBytes} from '@/core/util/base64';

describe('net isValidBase64', () => {
  it('accepts real base64 and rejects garbage', () => {
    expect(isValidBase64('aGVsbG8=')).toBe(true);
    expect(isValidBase64('aGVsbG8')).toBe(true);
    expect(isValidBase64('{}')).toBe(false);
    expect(isValidBase64('<html>')).toBe(false);
    expect(isValidBase64('')).toBe(false);
  });

  it('tolerates whitespace', () => {
    expect(isValidBase64(' aGVsbG8= ')).toBe(true);
  });

  it('decodes only valid input to bytes', () => {
    expect(base64ToBytes('aGVsbG8=').length).toBe(5);
    expect(base64ToBytes('{}').length).toBe(0);
  });
});

describe('net buildBaseUrls', () => {
  it('generates https then http per domain', () => {
    const urls = buildBaseUrls(['a.vip', 'b.vip'], '/album/123');
    expect(urls).toEqual([
      'https://a.vip/album/123',
      'http://a.vip/album/123',
      'https://b.vip/album/123',
      'http://b.vip/album/123',
    ]);
  });

  it('works with empty domains', () => {
    expect(buildBaseUrls([], '/x')).toEqual([]);
  });
});

describe('net isRetryableStatus', () => {
  it('retries 5xx and 429 only', () => {
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(200)).toBe(false);
  });
});

describe('net requestWithRetry', () => {
  const ok = (status = 200): FetchResult => ({ok: true, status});
  const fail = (status: number, retryable?: boolean): FetchResult => ({
    ok: false,
    status,
    retryable,
  });

  it('returns the first success across urls', async () => {
    const seen: string[] = [];
    const result = await requestWithRetry(
      ['https://a', 'https://b'],
      1,
      async (url) => {
        seen.push(url);
        return url.includes('b') ? ok() : fail(500, true);
      }
    );
    expect(result.ok).toBe(true);
    expect(seen).toEqual(['https://a', 'https://b']);
  });

  it('stops retrying a url on retryable=false', async () => {
    let calls = 0;
    const result = await requestWithRetry(['https://a'], 3, async () => {
      calls += 1;
      return fail(404, false);
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('status 404');
    expect(calls).toBe(1);
  });

  it('retries 5xx up to maxRetries before giving up', async () => {
    let calls = 0;
    const result = await requestWithRetry(['https://a'], 2, async () => {
      calls += 1;
      return fail(503, true);
    });
    expect(result.ok).toBe(false);
    expect(calls).toBe(2);
    expect(result.error).toBe('status 503');
  });
});

