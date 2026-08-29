import {CDN_DOMAINS, DOWNLOAD, HTML_DOMAINS, PDF, REQUEST, SCRAMBLE} from '@/core/constants';
import {config} from '@/config';

describe('constants', () => {
  it('exposes scramble thresholds', () => {
    expect(SCRAMBLE.SCRAMBLE_220980).toBe(220980);
    expect(SCRAMBLE.SCRAMBLE_268850).toBe(268850);
    expect(SCRAMBLE.SCRAMBLE_421926).toBe(421926);
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

  it('exposes pdf max width', () => {
    expect(PDF.MAX_WIDTH).toBe(1190);
  });

  it('loads app secrets from config', () => {
    expect(config.app.apiTokenVersion).toBe('2.0.6');
    expect(config.app.tokenSecret).toBe('18comicAPP');
    expect(config.app.tokenSecret2).toBe('18comicAPPContent');
    expect(config.app.dataSecret).toBe('185Hcomic3PAPP7R');
  });
});
