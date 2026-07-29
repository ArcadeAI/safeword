import { describe, expect, it } from 'vitest';

import { isSafePackageVersion } from '../../src/utils/version.js';

describe('safe package version', () => {
  it.each(['0.70.0', '1.2.3-beta.1', '1.2.3+build.5'])('accepts %s', version => {
    expect(isSafePackageVersion(version)).toBe(true);
  });

  it.each(['abc.def', '1.2', '1.2.3;echo-owned', '1.2.3/next', '1.2.3..4'])(
    'rejects %s',
    version => {
      expect(isSafePackageVersion(version)).toBe(false);
    },
  );
});
