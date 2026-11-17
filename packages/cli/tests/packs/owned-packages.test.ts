/**
 * Ownership records for packages Safeword adds (KQMPR5).
 *
 * Full uninstall removes typescript only when install recorded it as
 * Safeword's. The record must follow what package.json actually declares,
 * because a package-manager run can save the declaration and then fail.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getOwnedPackages, recordOwnedPackages } from '../../src/packs/config.js';
import { createTemporaryDirectory, removeTemporaryDirectory, writeTestFile } from '../helpers.js';

describe('recordOwnedPackages', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
    writeTestFile(cwd, '.safeword/config.json', '{"installedPacks":[]}\n');
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('records a package that package.json now declares, even after a failed install', () => {
    writeTestFile(cwd, 'package.json', '{"devDependencies":{"typescript":"~6.0.0"}}\n');

    recordOwnedPackages(cwd, ['typescript']);

    expect(getOwnedPackages(cwd)).toEqual(['typescript']);
  });

  it('records nothing for a package that package.json does not declare', () => {
    writeTestFile(cwd, 'package.json', '{"devDependencies":{}}\n');

    recordOwnedPackages(cwd, ['typescript']);

    expect(getOwnedPackages(cwd)).toEqual([]);
  });

  it('keeps one record across repeated installs', () => {
    writeTestFile(cwd, 'package.json', '{"devDependencies":{"typescript":"~6.0.0"}}\n');

    recordOwnedPackages(cwd, ['typescript']);
    recordOwnedPackages(cwd, ['typescript']);

    expect(getOwnedPackages(cwd)).toEqual(['typescript']);
  });
});
