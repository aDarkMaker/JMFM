import {compareSemver, isNewerVersion, parseSemver} from '@/core/update/semver';

describe('semver', () => {
  it('parses valid versions', () => {
    expect(parseSemver('1.0.0')).toEqual({major: 1, minor: 0, patch: 0});
    expect(parseSemver('2.10.3')).toEqual({major: 2, minor: 10, patch: 3});
  });

  it('rejects invalid versions', () => {
    expect(parseSemver('1.0')).toBeNull();
    expect(parseSemver('v1.0.0')).toBeNull();
  });

  it('compares major/minor/patch', () => {
    expect(compareSemver('1.0.0', '1.1.0')).toBe(-1);
    expect(compareSemver('1.1.0', '1.0.0')).toBe(1);
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });

  it('detects newer remote version', () => {
    expect(isNewerVersion('1.0.0', '1.1.0')).toBe(true);
    expect(isNewerVersion('1.1.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
  });
});
