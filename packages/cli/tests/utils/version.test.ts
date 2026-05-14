/**
 * Test Suite: Version helpers for safeword hooks
 *
 * Pure-function helpers extracted from session-auto-upgrade.ts during
 * the PR #81 refactor pass. Behavior is the same as the inline logic
 * that shipped in the original hook; these tests pin that behavior so
 * future changes can't silently drift.
 */

import { describe, expect, it } from 'vitest';

import {
  bumpType,
  compareVersions,
  parseVersion,
  upgradeDecision,
} from '../../templates/hooks/lib/version.ts';

describe('parseVersion()', () => {
  it('parses a standard semver string', () => {
    expect(parseVersion('0.30.1')).toEqual([0, 30, 1]);
  });

  it('defaults missing components to 0', () => {
    expect(parseVersion('1')).toEqual([1, 0, 0]);
    expect(parseVersion('1.2')).toEqual([1, 2, 0]);
  });

  it('handles the empty string', () => {
    expect(parseVersion('')).toEqual([0, 0, 0]);
  });
});

describe('compareVersions()', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('0.30.1', '0.30.1')).toBe(0);
  });

  it('returns -1 when a < b at patch level', () => {
    expect(compareVersions('0.30.0', '0.30.1')).toBe(-1);
  });

  it('returns 1 when a > b at patch level', () => {
    expect(compareVersions('0.30.2', '0.30.1')).toBe(1);
  });

  it('compares minor before patch', () => {
    expect(compareVersions('0.29.99', '0.30.0')).toBe(-1);
    expect(compareVersions('0.30.0', '0.29.99')).toBe(1);
  });

  it('compares major before minor', () => {
    expect(compareVersions('0.99.99', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0', '0.99.99')).toBe(1);
  });
});

describe('bumpType()', () => {
  it('returns "none" for equal versions', () => {
    expect(bumpType('0.30.1', '0.30.1')).toBe('none');
  });

  it('returns "none" for downgrades', () => {
    expect(bumpType('0.30.1', '0.30.0')).toBe('none');
    expect(bumpType('1.0.0', '0.99.99')).toBe('none');
  });

  it('returns "patch" for patch bumps', () => {
    expect(bumpType('0.30.0', '0.30.1')).toBe('patch');
  });

  it('returns "minor" for minor bumps (even when patch goes down)', () => {
    expect(bumpType('0.30.5', '0.31.0')).toBe('minor');
  });

  it('returns "major" for major bumps (even when minor/patch go down)', () => {
    expect(bumpType('0.30.5', '1.0.0')).toBe('major');
  });
});

describe('upgradeDecision()', () => {
  // Pins safeword's auto-upgrade policy as data. See:
  // .claude/skills/versioning/SKILL.md

  it('returns "skip" when there is no update', () => {
    expect(upgradeDecision('none')).toBe('skip');
  });

  it('returns "apply" for patch bumps (auto-upgrade silently)', () => {
    expect(upgradeDecision('patch')).toBe('apply');
  });

  it('returns "apply" for minor bumps (additive contract — auto-upgrade silently)', () => {
    expect(upgradeDecision('minor')).toBe('apply');
  });

  it('returns "notify" for major bumps (may include breaking changes — user decides)', () => {
    expect(upgradeDecision('major')).toBe('notify');
  });
});
