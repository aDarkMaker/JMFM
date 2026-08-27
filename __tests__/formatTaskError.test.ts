import {formatTaskError} from '@/web/util/formatTaskError';

describe('formatTaskError', () => {
  it('strips full urls', () => {
    expect(formatTaskError('failed to download https://cdn.example.com/a/b/00001.webp?x=1')).toBe(
      'failed to download'
    );
  });

  it('strips native/web detail blobs', () => {
    expect(formatTaskError('api failed; native=timeout; web=TypeError: Failed to fetch')).toBe(
      'api failed'
    );
  });

  it('collapses whitespace', () => {
    expect(formatTaskError('  HTTP   500\n\n  server error  ')).toBe('HTTP 500 server error');
  });

  it('caps length with ellipsis', () => {
    const long = `第 ${'a'.repeat(100)} 页下载失败，网络连接失败，请稍后重试`;
    const out = formatTaskError(long);
    expect(out.length).toBeLessThanOrEqual(81);
    expect(out.endsWith('…')).toBe(true);
  });

  it('keeps short messages unchanged', () => {
    expect(formatTaskError('网络连接失败')).toBe('网络连接失败');
  });
});
