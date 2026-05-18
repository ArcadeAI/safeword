/**
 * Unit tests for eslint peer-dep mismatch detection.
 *
 * The guard reads the project's declared eslint version (dep or devDep) and
 * compares against safeword's own peerDependencies.eslint range. If the major
 * version is outside the supported set, returns a warning string; otherwise
 * returns undefined. Skips silently when nothing is declared or the range can't
 * be parsed — only positively-mismatched majors warn.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  writeTestFile,
} from '../../tests/helpers.js';
import { getEslintPeerMismatchWarning } from './eslint-peer-check.js';

describe('getEslintPeerMismatchWarning', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  it('returns undefined when no package.json exists', () => {
    expect(getEslintPeerMismatchWarning(temporaryDirectory)).toBeUndefined();
  });

  it('returns undefined when package.json declares no eslint dependency', () => {
    writeTestFile(
      temporaryDirectory,
      'package.json',
      JSON.stringify({ name: 'x', version: '0.0.0', devDependencies: { typescript: '^5.0.0' } }),
    );
    expect(getEslintPeerMismatchWarning(temporaryDirectory)).toBeUndefined();
  });

  it('returns undefined when eslint is in the supported major (9.x as caret range)', () => {
    writeTestFile(
      temporaryDirectory,
      'package.json',
      JSON.stringify({ name: 'x', version: '0.0.0', devDependencies: { eslint: '^9.39.4' } }),
    );
    expect(getEslintPeerMismatchWarning(temporaryDirectory)).toBeUndefined();
  });

  it('returns undefined for a pinned 9.x version', () => {
    writeTestFile(
      temporaryDirectory,
      'package.json',
      JSON.stringify({ name: 'x', version: '0.0.0', devDependencies: { eslint: '9.39.4' } }),
    );
    expect(getEslintPeerMismatchWarning(temporaryDirectory)).toBeUndefined();
  });

  it('returns a warning for pinned eslint 10.0.0 (above safeword supported range)', () => {
    writeTestFile(
      temporaryDirectory,
      'package.json',
      JSON.stringify({ name: 'x', version: '0.0.0', devDependencies: { eslint: '10.0.0' } }),
    );
    const warning = getEslintPeerMismatchWarning(temporaryDirectory);
    expect(warning).not.toBeUndefined();
    expect(warning).toContain('eslint');
    expect(warning).toContain('10');
  });

  it('returns a warning for eslint ^10 caret range', () => {
    writeTestFile(
      temporaryDirectory,
      'package.json',
      JSON.stringify({ name: 'x', version: '0.0.0', devDependencies: { eslint: '^10.4.0' } }),
    );
    expect(getEslintPeerMismatchWarning(temporaryDirectory)).not.toBeUndefined();
  });

  it('returns a warning for eslint below supported range (8.x)', () => {
    writeTestFile(
      temporaryDirectory,
      'package.json',
      JSON.stringify({ name: 'x', version: '0.0.0', devDependencies: { eslint: '^8.57.0' } }),
    );
    expect(getEslintPeerMismatchWarning(temporaryDirectory)).not.toBeUndefined();
  });

  it('detects eslint declared in dependencies (not just devDependencies)', () => {
    writeTestFile(
      temporaryDirectory,
      'package.json',
      JSON.stringify({ name: 'x', version: '0.0.0', dependencies: { eslint: '10.0.0' } }),
    );
    expect(getEslintPeerMismatchWarning(temporaryDirectory)).not.toBeUndefined();
  });

  it('returns undefined for unparseable ranges (workspace:*, file:, git:)', () => {
    writeTestFile(
      temporaryDirectory,
      'package.json',
      JSON.stringify({ name: 'x', version: '0.0.0', devDependencies: { eslint: 'workspace:*' } }),
    );
    expect(getEslintPeerMismatchWarning(temporaryDirectory)).toBeUndefined();
  });

  it('warning message names the safeword supported major (9) and the conflict', () => {
    writeTestFile(
      temporaryDirectory,
      'package.json',
      JSON.stringify({ name: 'x', version: '0.0.0', devDependencies: { eslint: '^10.0.0' } }),
    );
    const warning = getEslintPeerMismatchWarning(temporaryDirectory);
    expect(warning).toContain('9');
  });
});
