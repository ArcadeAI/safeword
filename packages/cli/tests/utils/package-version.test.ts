import { describe, expect, it } from 'vitest';

import { compareVersions, isSafePackageVersion } from '../../src/utils/version.js';

describe('safe package version', () => {
  it.each(['0.70.0', '1.2.3-beta.1', '1.2.3+build.5'])('accepts %s', version => {
    expect(isSafePackageVersion(version)).toBe(true);
  });

  it.each([
    'abc.def',
    'garbage',
    'v999.0.0',
    '1.2',
    '01.2.3',
    '1.2.3-beta.01',
    '1.2.3;echo-owned',
    '1.2.3/next',
    '1.2.3..4',
  ])('rejects %s', version => {
    expect(isSafePackageVersion(version)).toBe(false);
  });

  it('compares prerelease precedence and ignores build metadata', () => {
    expect(compareVersions('0.69.1-beta.1', '0.69.0')).toBe(1);
    expect(compareVersions('0.69.1-beta.1', '0.69.1')).toBe(-1);
    expect(compareVersions('0.69.1-beta.2', '0.69.1-beta.10')).toBe(-1);
    expect(compareVersions('0.69.1+build.5', '0.69.0')).toBe(1);
    expect(compareVersions('0.69.1+build.5', '0.69.1+build.6')).toBe(0);
  });
});
