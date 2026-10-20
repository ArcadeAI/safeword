import { describe, expect, it } from 'vitest';

import { observeExactHostVersion } from '../helpers/host-contract-version.js';

describe('required host version observations', () => {
  it.each([
    ['2.1.170', '2.1.170 (Claude Code)\n'],
    ['0.160.0', 'codex-cli 0.160.0\n'],
    ['3.8.23', '3.8.23\n'],
    ['3.24.18', '3.24.18\n'],
    ['1.18.23', '1.18.23\n'],
    ['2.0.32', 'opencode v2.0.32\n'],
  ])('recognizes the exact required version %s', (expectedVersion, output) => {
    expect(observeExactHostVersion(expectedVersion, output)).toEqual({
      state: 'verified',
      version: expectedVersion,
    });
  });

  it('rejects a newer binary returned by a version-shaped download URL', () => {
    expect(observeExactHostVersion('3.8.23', '3.25.9\n')).toEqual({
      state: 'unavailable',
      reason: 'version-mismatch',
      expectedVersion: '3.8.23',
      observedVersion: '3.25.9',
    });
  });

  it.each([
    '',
    'requested 3.8.23; actually 3.25.9',
    '3.8.23\n3.25.9\n',
    'opencode v3.8.23-beta.1',
    '3.8.23 trailing diagnostics',
  ])('does not infer the required version from unreadable output %#', output => {
    expect(observeExactHostVersion('3.8.23', output)).toEqual({
      state: 'unavailable',
      reason: 'unreadable-version',
      expectedVersion: '3.8.23',
    });
  });
});
