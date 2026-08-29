import {describe, expect, test, mock} from 'bun:test';

describe('NativeHttpClient binary responses', () => {
  test('re-encodes parsed JSON objects (application/json content-type)', async () => {
    const body = {code: 200, data: 'aGVsbG8='};
    mock.module('@capacitor/core', () => ({
      Capacitor: {isNativePlatform: () => true},
      CapacitorHttp: {
        get: async () => ({status: 200, data: body}),
      },
    }));

    const {NativeHttpClient} = await import('@/core/net/native-http');
    const {bytesOf} = await import('@/core/net/http');
    const client = new NativeHttpClient({maxRetries: 1});
    const result = await client.getBytes('https://x.test/api');
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    const bytes = bytesOf(result)!;
    expect(new TextDecoder().decode(bytes)).toBe(JSON.stringify(body));
  });

  test('passes base64 strings through for non-JSON content types', async () => {
    mock.module('@capacitor/core', () => ({
      Capacitor: {isNativePlatform: () => true},
      CapacitorHttp: {
        get: async () => ({status: 200, data: 'aGVsbG8='}),
      },
    }));

    const {NativeHttpClient} = await import('@/core/net/native-http');
    const {bytesOf} = await import('@/core/net/http');
    const client = new NativeHttpClient({maxRetries: 1});
    const result = await client.getBytes('https://x.test/bin');
    expect(result.ok).toBe(true);
    expect(new TextDecoder().decode(bytesOf(result)!)).toBe('hello');
  });

  test('treats non-base64 garbage as a retryable failure', async () => {
    mock.module('@capacitor/core', () => ({
      Capacitor: {isNativePlatform: () => true},
      CapacitorHttp: {
        get: async () => ({status: 200, data: '<html>blocked</html>'}),
      },
    }));

    const {NativeHttpClient} = await import('@/core/net/native-http');
    const client = new NativeHttpClient({maxRetries: 1});
    const result = await client.getBytes('https://x.test/garbage');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid body');
  });
});
