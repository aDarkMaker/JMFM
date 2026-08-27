import {describe, expect, test, mock} from 'bun:test';

describe('updateFetchJson on native', () => {
  test('accepts object responses returned by CapacitorHttp', async () => {
    mock.module('@capacitor/core', () => ({
      Capacitor: {isNativePlatform: () => true},
      CapacitorHttp: {
        get: async () => ({status: 200, data: {version: '2.0.0', tag: 'v2.0.0'}}),
      },
    }));

    const {updateFetchJson} = await import('@/core/update/http');
    const result = await updateFetchJson<{version: string; tag: string}>(
      'https://example.com/version.json'
    );
    expect(result).toEqual({version: '2.0.0', tag: 'v2.0.0'});
  });

  test('parses string payloads as JSON', async () => {
    mock.module('@capacitor/core', () => ({
      Capacitor: {isNativePlatform: () => true},
      CapacitorHttp: {
        get: async () => ({status: 200, data: '{"version":"1.0.0"}'}),
      },
    }));

    const {updateFetchJson} = await import('@/core/update/http');
    const result = await updateFetchJson<{version: string}>('https://example.com/version.json');
    expect(result).toEqual({version: '1.0.0'});
  });
});
