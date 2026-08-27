import {PhotoDetail, buildFallbackImageUrl, buildImageUrl, createImageItem} from '@/core/model';

const photo: PhotoDetail = {
  photoId: 100200300,
  name: 'chapter-1',
  sort: 1,
  albumId: 100200,
  scrambleId: 400,
  pageArr: ['00001.webp', '00002.webp'],
  totalPics: 2,
  cdnBaseUrl: 'https://cdn-msp.jmapiproxy1.cc/media/photos/100200300/',
  queryParams: 'v=1699999999',
};

describe('model buildImageUrl', () => {
  it('appends file name and query params', () => {
    expect(buildImageUrl(photo, '00001.webp')).toBe(
      'https://cdn-msp.jmapiproxy1.cc/media/photos/100200300/00001.webp?v=1699999999'
    );
  });

  it('omits query when empty', () => {
    expect(buildImageUrl({...photo, queryParams: ''}, '00002.webp')).toBe(
      'https://cdn-msp.jmapiproxy1.cc/media/photos/100200300/00002.webp'
    );
  });
});

describe('model buildFallbackImageUrl', () => {
  it('pads index to 5 digits', () => {
    expect(buildFallbackImageUrl(100200300, 3)).toBe(
      'https://cdn-msp.jmapiproxy.cc/media/photos/100200300/00003.jpg'
    );
  });
});

describe('model createImageItem', () => {
  it('splits file name and suffix', () => {
    const item = createImageItem(photo, '00001.webp', 1);
    expect(item.fileName).toBe('00001');
    expect(item.suffix).toBe('webp');
    expect(item.aid).toBe(100200300);
    expect(item.scrambleId).toBe(400);
    expect(item.index).toBe(1);
  });
});
