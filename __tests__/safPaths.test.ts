import {toSafRelativePath, joinLogicalPath} from '@/web/library/safPaths';

describe('toSafRelativePath', () => {
  it('strips downloadPath prefix', () => {
    expect(toSafRelativePath('Documents/JMFDownloads/测试/pages', 'Documents/JMFDownloads')).toBe(
      '测试/pages'
    );
  });

  it('returns empty string for download root', () => {
    expect(toSafRelativePath('Documents/JMFDownloads', 'Documents/JMFDownloads')).toBe('');
  });

  it('falls back to legacy prefixes', () => {
    expect(toSafRelativePath('JMFMobile/downloads/旧本/pages', 'Documents/JMFDownloads')).toBe(
      '旧本/pages'
    );
  });
});

describe('joinLogicalPath', () => {
  it('joins relative segments', () => {
    expect(joinLogicalPath('Documents/JMFDownloads', '测试/pages')).toBe(
      'Documents/JMFDownloads/测试/pages'
    );
  });
});
