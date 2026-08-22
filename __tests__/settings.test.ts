import {DEFAULT_SETTINGS, sanitizeSettings} from '@/data/settings';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('settings sanitizeSettings', () => {
  it('uses defaults for empty input', () => {
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('normalizes ints within bounds', () => {
    const s = sanitizeSettings({retryTimes: 99, imageThreads: -5});
    expect(s.retryTimes).toBe(10);
    expect(s.imageThreads).toBe(0);
  });

  it('normalizes non-numeric to fallback', () => {
    expect(sanitizeSettings({retryTimes: NaN}).retryTimes).toBe(3);
  });

  it('trims path and proxy', () => {
    const s = sanitizeSettings({downloadPath: '  x/y  ', proxy: ' 1.2.3.4:8080 '});
    expect(s.downloadPath).toBe('x/y');
    expect(s.proxy).toBe('1.2.3.4:8080');
  });
});
