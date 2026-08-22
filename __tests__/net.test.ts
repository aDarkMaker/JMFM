import {buildBaseUrls} from '@/core/net';

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
