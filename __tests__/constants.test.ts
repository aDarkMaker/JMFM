import {
  APP,
  CDN_DOMAINS,
  DOWNLOAD,
  HTML_DOMAINS,
  PDF,
  PROGRESS,
  REQUEST,
  SCRAMBLE,
} from '@/core/constants';

describe('constants', () => {
  it('exposes scramble thresholds', () => {
    expect(SCRAMBLE.SCRAMBLE_220980).toBe(220980);
    expect(SCRAMBLE.SCRAMBLE_268850).toBe(268850);
    expect(SCRAMBLE.SCRAMBLE_421926).toBe(421926);
  });

  it('exposes app secrets', () => {
    expect(APP.APP_VERSION).toBe('2.0.6');
    expect(APP.APP_TOKEN_SECRET).toBe('18comicAPP');
    expect(APP.APP_TOKEN_SECRET_2).toBe('18comicAPPContent');
    expect(APP.APP_DATA_SECRET).toBe('185Hcomic3PAPP7R');
  });

  it('keeps reserved html domains', () => {
    expect(HTML_DOMAINS).toEqual([
      '18comic-mygo.vip',
      '18comic-mygo.org',
      '18comic-MHWs.CC',
      'jmcomic-zzz.one',
      'jmcomic-zzz.org',
    ]);
  });

  it('has non-empty cdn domains', () => {
    expect(CDN_DOMAINS.length).toBeGreaterThan(0);
  });

  it('exposes request defaults', () => {
    expect(REQUEST.MAX_RETRIES).toBe(3);
    expect(REQUEST.RETRY_INTERVAL_MS).toBe(500);
    expect(REQUEST.CONNECT_TIMEOUT_MS).toBe(30000);
  });

  it('exposes concurrency bounds', () => {
    expect(DOWNLOAD.CONCURRENCY_MAX).toBe(64);
    expect(DOWNLOAD.CONCURRENCY_MIN).toBe(2);
  });

  it('exposes pdf page size', () => {
    expect(PDF.PAGE_WIDTH_PT).toBe(595);
    expect(PDF.PAGE_HEIGHT_PT).toBe(842);
  });

  it('exposes progress thresholds in order', () => {
    expect(PROGRESS.START).toBeLessThan(PROGRESS.ALBUM_PARSED);
    expect(PROGRESS.ALBUM_PARSED).toBeLessThan(PROGRESS.CHAPTER_PARSED);
    expect(PROGRESS.CHAPTER_PARSED).toBeLessThan(PROGRESS.PDF_START);
    expect(PROGRESS.PDF_END).toBeLessThan(PROGRESS.DONE);
  });
});
