/**
 * Unit tests for dogfood-repo detection (ticket 975N5T). The session
 * auto-upgrade hook must skip the safeword dev repo, whose `.safeword/` +
 * `.claude/` are deployed mirrors of LOCAL `packages/cli/templates/` (routinely
 * ahead of npm) — re-installing the published package would regress them.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { isDogfoodRepo } from '../../templates/hooks/lib/dogfood.js';

describe('isDogfoodRepo', () => {
  const created: string[] = [];
  function temporaryProject(): string {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'dogfood-'));
    created.push(directory);
    return directory;
  }
  afterEach(() => {
    const directories = [...created];
    created.length = 0;
    for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  });

  it('detects the dogfood repo by the canonical templates directory', () => {
    const directory = temporaryProject();
    mkdirSync(nodePath.join(directory, 'packages/cli/templates'), { recursive: true });
    expect(isDogfoodRepo(directory)).toBe(true);
  });

  it('detects the dogfood repo by a root package.json named safeword', () => {
    const directory = temporaryProject();
    writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'safeword' }));
    expect(isDogfoodRepo(directory)).toBe(true);
  });

  it('returns false for a consumer project (.safeword/ but no templates, other name)', () => {
    const directory = temporaryProject();
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'my-app' }));
    expect(isDogfoodRepo(directory)).toBe(false);
  });

  it('returns false when there is no package.json and no templates dir', () => {
    expect(isDogfoodRepo(temporaryProject())).toBe(false);
  });

  it('returns false when package.json is malformed and no templates dir', () => {
    const directory = temporaryProject();
    writeFileSync(nodePath.join(directory, 'package.json'), '{ not valid json');
    expect(isDogfoodRepo(directory)).toBe(false);
  });
});
