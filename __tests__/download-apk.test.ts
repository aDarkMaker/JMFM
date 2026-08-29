import {describe, expect, test, mock, afterAll} from 'bun:test';
import {sha256HexOf} from '@/core/util/sha256';

let writes: {data: string; first: boolean}[] = [];

mock.module('@capacitor/core', () => ({
  Capacitor: {isNativePlatform: () => false},
  CapacitorHttp: {
    get: async () => ({status: 404, data: ''}),
  },
}));

mock.module('@capacitor/filesystem', () => ({
  Directory: {Cache: 'cache'},
  Filesystem: {
    deleteFile: async () => undefined,
    writeFile: async (o: {data: string}) => {
      writes.push({data: o.data, first: true});
    },
    appendFile: async (o: {data: string}) => {
      writes.push({data: o.data, first: false});
    },
    getUri: async () => ({uri: 'cache://JMFM-update.apk'}),
  },
}));

const {downloadApkToCache} = await import('@/core/update/download-apk');
const {base64ToBytes} = await import('@/core/util/base64');

const origFetch = globalThis.fetch;

function streamFrom(data: Uint8Array, chunkSize: number): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= data.length) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, data.length);
      controller.enqueue(data.slice(offset, end));
      offset = end;
    },
  });
}

function makePayload(): Uint8Array {
  const payload = new Uint8Array(2_500_000);
  for (let i = 0; i < payload.length; i++) {
    payload[i] = (i * 7 + 3) & 0xff;
  }
  return payload;
}

describe('downloadApkToCache', () => {
  afterAll(() => {
    globalThis.fetch = origFetch;
  });

  test('streams chunks and verifies sha256', async () => {
    writes = [];
    const payload = makePayload();
    const expected = sha256HexOf(payload);
    globalThis.fetch = ((async () =>
      new Response(streamFrom(payload, 777_000), {
        status: 200,
        headers: {'content-length': String(payload.length)},
      })) as unknown) as typeof fetch;

    const progress: number[] = [];
    const name = await downloadApkToCache('https://example.com/JMFM.apk', expected, (loaded) => {
      progress.push(loaded);
    });

    expect(name).toBe('JMFM-update.apk');
    expect(writes.length).toBeGreaterThan(1);
    expect(writes[0].first).toBe(true);
    expect(writes.slice(1).every((w) => !w.first)).toBe(true);

    const all = new Uint8Array(
      writes.reduce((acc, w) => acc + base64ToBytes(w.data).length, 0)
    );
    let offset = 0;
    for (const w of writes) {
      const chunk = base64ToBytes(w.data);
      all.set(chunk, offset);
      offset += chunk.length;
    }
    expect(Buffer.from(all).equals(Buffer.from(payload))).toBe(true);
    expect(progress.at(-1)).toBe(payload.length);
  });

  test('rejects on sha mismatch and clears the partial file', async () => {
    writes = [];
    const payload = makePayload();
    globalThis.fetch = ((async () =>
      new Response(streamFrom(payload, 1_000_000), {status: 200})) as unknown) as typeof fetch;

    await expect(
      downloadApkToCache('https://example.com/JMFM.apk', '0'.repeat(64))
    ).rejects.toThrow('APK 校验失败');
    expect(writes.length).toBeGreaterThan(0);
  });
});
