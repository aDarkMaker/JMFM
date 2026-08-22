/* eslint-disable no-bitwise */
import {decodeBase64Utf8, extractBase64Html, parseAlbumDetail, parsePhotoDetail} from '@/core/parser';

describe('parser base64', () => {
  it('decodes utf8 base64', () => {
    expect(decodeBase64Utf8('5rWL6K+V')).toBe('测试');
  });

  it('extracts wrapped base64 html', () => {
    const encoded = encodeBase64('<html>JM123</html>');
    const wrapped = `<script>const html = base64DecodeUtf8("${encoded}");</script>`;
    expect(extractBase64Html(wrapped)).toBe('<html>JM123</html>');
  });

  it('returns input when not base64 wrapped', () => {
    expect(extractBase64Html('<html>plain</html>')).toBe('<html>plain</html>');
  });
});

function encodeBase64(input: string): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = Array.from(input, c => c.charCodeAt(0));
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += chars[b0 >> 2];
    out += chars[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += b1 !== undefined ? chars[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    out += b2 !== undefined ? chars[b2 & 0x3f] : '=';
  }
  return out;
}

describe('parser album detail', () => {
  const albumHtml = `
<html>
<head><title>JM123</title></head>
<body>
<span class="number">ID：JM123</span>
<div id="book-name">测试本子</div>
<script>var scramble_id = 456;</script>
<ul>
<li data-album="100200">第1话 第一章</li>
<li data-album="100300">第2话 第二章</li>
</ul>
</body>
</html>`;

  it('parses album fields', () => {
    const album = parseAlbumDetail(albumHtml);
    expect(album.albumId).toBe(123);
    expect(album.name).toBe('测试本子');
    expect(album.scrambleId).toBe(456);
    expect(album.episodes).toEqual([
      {photoId: 100200, sort: 1, name: '第一章'},
      {photoId: 100300, sort: 2, name: '第二章'},
    ]);
  });
});

describe('parser photo detail', () => {
  const photoHtml = `
<html>
<head>
<meta property="og:url" content="https://18comic.vip/photo/100200/">
</head>
<body>
<script>
var series_id = 123;
var scramble_id = 456;
var page_arr = ["1.webp","2.webp","3.webp"];
var total_pics = 3;
</script>
<img data-original="https://cdn-msp.jmapiproxy1.cc/media/photos/100200/1.webp?v=1699999999">
</body>
</html>`;

  it('parses photo fields', () => {
    const photo = parsePhotoDetail(photoHtml);
    expect(photo.photoId).toBe(100200);
    expect(photo.albumId).toBe(123);
    expect(photo.scrambleId).toBe(456);
    expect(photo.pageArr).toEqual(['1.webp', '2.webp', '3.webp']);
    expect(photo.totalPics).toBe(3);
    expect(photo.cdnBaseUrl).toBe('https://cdn-msp.jmapiproxy1.cc/media/photos/100200/');
    expect(photo.queryParams).toBe('v=1699999999');
  });

  it('tolerates missing fields', () => {
    const photo = parsePhotoDetail('<html><body>no data</body></html>');
    expect(photo.photoId).toBe(0);
    expect(photo.pageArr).toEqual([]);
    expect(photo.cdnBaseUrl).toBe('');
  });
});
