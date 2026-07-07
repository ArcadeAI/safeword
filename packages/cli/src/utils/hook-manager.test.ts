/**
 * Hook-manager world detection (ZJMZ50, #810 child 2).
 *
 * Supporting unit proof for TB1.R1/R3's detection dimension: which of the
 * four hook-manager worlds a host is in decides shim-append vs nudge. The
 * matrix pins the conservative-when-contested rule — safeword only appends
 * to .husky when husky is uncontested or actively confirmed by git config.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectHookManagerWorld } from './hook-manager.js';

const NO_DEPS = {};

describe('detectHookManagerWorld', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(nodePath.join(tmpdir(), 'hook-world-'));
    execFileSync('git', ['init', '--quiet'], { cwd: dir, stdio: 'pipe' });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const setHooksPath = (value: string) =>
    execFileSync('git', ['config', 'core.hooksPath', value], { cwd: dir, stdio: 'pipe' });

  it('returns bare for a git repo with no hook-manager signals', () => {
    expect(detectHookManagerWorld(dir, NO_DEPS)).toBe('bare');
  });

  it('returns husky when a .husky directory exists uncontested', () => {
    mkdirSync(nodePath.join(dir, '.husky'));
    expect(detectHookManagerWorld(dir, NO_DEPS)).toBe('husky');
  });

  it('returns husky when core.hooksPath points into .husky', () => {
    mkdirSync(nodePath.join(dir, '.husky'));
    setHooksPath('.husky/_');
    expect(detectHookManagerWorld(dir, NO_DEPS)).toBe('husky');
  });

  it('prefers the active manager when signals conflict (TB1.R1 rejection)', () => {
    // Mid-migration leftovers: .husky dir remains, but git actually runs
    // lefthook's hooks. Appending to .husky would be dead lines.
    mkdirSync(nodePath.join(dir, '.husky'));
    writeFileSync(nodePath.join(dir, 'lefthook.yml'), 'pre-commit:\n');
    setHooksPath('.git/hooks');
    expect(detectHookManagerWorld(dir, NO_DEPS)).toBe('lefthook');
  });

  it.each(['lefthook.yml', 'lefthook.yaml', '.lefthook.yml', '.lefthook.yaml'])(
    'returns lefthook when %s exists',
    configName => {
      writeFileSync(nodePath.join(dir, configName), 'pre-commit:\n');
      expect(detectHookManagerWorld(dir, NO_DEPS)).toBe('lefthook');
    },
  );

  it('returns pre-commit when .pre-commit-config.yaml exists', () => {
    writeFileSync(nodePath.join(dir, '.pre-commit-config.yaml'), 'repos: []\n');
    expect(detectHookManagerWorld(dir, NO_DEPS)).toBe('pre-commit');
  });

  it('a contested .husky dir loses to a lefthook config even without hooksPath', () => {
    // No active signal either way (fresh clone) — conservative: nudge, never
    // append into a contested .husky.
    mkdirSync(nodePath.join(dir, '.husky'));
    writeFileSync(nodePath.join(dir, 'lefthook.yml'), 'pre-commit:\n');
    expect(detectHookManagerWorld(dir, NO_DEPS)).toBe('lefthook');
  });

  it('returns husky-uninitialized when husky is a dependency but .husky is absent (TB1.R3)', () => {
    expect(detectHookManagerWorld(dir, { husky: '^9.1.7' })).toBe('husky-uninitialized');
  });

  it('a custom hooksPath outside every known manager reads as bare', () => {
    setHooksPath('tools/git-hooks');
    expect(detectHookManagerWorld(dir, NO_DEPS)).toBe('bare');
  });
});
