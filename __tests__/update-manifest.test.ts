import {describe, expect, test} from 'bun:test';
import {decideUpdate, parseManifest} from '@/core/update/manifest';
import {buildApkCandidates} from '@/core/update/source';
import {assetMirrorUrls} from '@/core/update/constants';

describe('parseManifest', () => {
  test('accepts the minimal contract', () => {
    expect(parseManifest({version: '3.6.0', versionCode: 30600})).toEqual({
      version: '3.6.0',
      versionCode: 30600,
    });
  });

  test('keeps optional fields when valid', () => {
    const sha = 'a'.repeat(64).toUpperCase();
    expect(
      parseManifest({
        version: '3.6.0',
        versionCode: '30600',
        minVersionCode: 30000,
        apkSha256: sha,
        apkSize: 1234,
        notes: '  fix  ',
      })
    ).toEqual({
      version: '3.6.0',
      versionCode: 30600,
      minVersionCode: 30000,
      apkSha256: 'a'.repeat(64),
      apkSize: 1234,
      notes: 'fix',
    });
  });

  test('rejects broken manifests', () => {
    expect(() => parseManifest(null)).toThrow();
    expect(() => parseManifest({versionCode: 1})).toThrow();
    expect(() => parseManifest({version: 'x', versionCode: 1})).toThrow();
    expect(() => parseManifest({version: '1.0.0', versionCode: 0})).toThrow();
    expect(() => parseManifest({version: '1.0.0', versionCode: 1, apkSha256: 'short'})).not.toThrow();
  });
});

describe('decideUpdate', () => {
  const remote = {version: '3.6.0', versionCode: 30600};

  test('reports none when the local build is current', () => {
    expect(decideUpdate({version: '3.6.0', versionCode: 30600}, remote)).toEqual({kind: 'none'});
    expect(decideUpdate({version: '3.7.0', versionCode: 30700}, remote)).toEqual({kind: 'none'});
  });

  test('reports optional without minVersionCode', () => {
    expect(decideUpdate({version: '3.5.0', versionCode: 30500}, remote)).toEqual({
      kind: 'optional',
      manifest: remote,
    });
  });

  test('reports force below minVersionCode', () => {
    const forced = {...remote, minVersionCode: 30600};
    expect(decideUpdate({version: '3.5.0', versionCode: 30500}, forced)).toEqual({
      kind: 'force',
      manifest: forced,
    });
  });

  test('falls back to semver when versionCode is unknown', () => {
    expect(decideUpdate({version: '3.5.0'}, remote).kind).toBe('optional');
    expect(decideUpdate({version: '3.6.0'}, remote).kind).toBe('none');
  });
});

describe('asset mirrors', () => {
  test('builds one candidate per configured mirror', () => {
    const candidates = buildApkCandidates('latest');
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates[0]).toContain('github.com');
    expect(candidates.every((url) => url.endsWith('/JMFM.apk'))).toBe(true);
  });

  test('substitutes owner, repo, tag and asset', () => {
    const [url] = assetMirrorUrls('v1.2.3', 'version.json', [
      'https://example.test/{owner}/{repo}/{tag}/{asset}',
    ]);
    expect(url).toBe('https://example.test/aDarkMaker/JMFM/v1.2.3/version.json');
  });
});
