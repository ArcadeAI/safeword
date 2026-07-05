/**
 * Unit tests for the narrative-drift helpers (ticket BY7RNR, GitHub #848).
 * Pure-function coverage: root-index package extraction, the "mentioned"
 * matcher (spec Vocabulary rule), and the capped advisory formatter. The
 * IO seam is proven in the cucumber acceptance lane
 * (features/architecture-narrative-blindspots.feature, TB2 rules).
 */

import { describe, expect, it } from 'vitest';

import {
  extractRootIndexPackages,
  isMentioned,
  narrativeDriftAdvisory,
} from '../../src/utils/architecture-narrative-drift.js';

const ROOT_INDEX = [
  '---',
  'generator: safeword-architecture',
  'fingerprint: abc123',
  '---',
  '',
  '# Architecture',
  '',
  '## Packages',
  '',
  '### @acme/design-system',
  '',
  'Prose.',
  '',
  '### web',
  '',
  'Prose.',
  '',
  '## Dependencies',
  '',
  '- `web` → `@acme/design-system`',
  '',
].join('\n');

const SINGLE_REPO_DOC = [
  '---',
  'generator: safeword-architecture',
  'fingerprint: abc123',
  '---',
  '',
  '# Architecture',
  '',
  '## Modules',
  '',
  '### commands',
  '',
  '### utils',
  '',
].join('\n');

describe('extractRootIndexPackages', () => {
  it('collects ### names under ## Packages only', () => {
    expect(extractRootIndexPackages(ROOT_INDEX)).toEqual(['@acme/design-system', 'web']);
  });

  it('returns nothing for a single-repo ## Modules doc (scope guard)', () => {
    expect(extractRootIndexPackages(SINGLE_REPO_DOC)).toEqual([]);
  });

  it('returns nothing for empty content', () => {
    expect(extractRootIndexPackages('')).toEqual([]);
  });
});

describe('isMentioned', () => {
  it('matches the full package name', () => {
    expect(isMentioned('web', 'The web package serves the UI.')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(isMentioned('web', 'The Web layer.')).toBe(true);
  });

  it('matches a scoped package by its full name', () => {
    expect(isMentioned('@acme/design-system', 'Uses `@acme/design-system` for UI.')).toBe(true);
  });

  it('matches a scoped package by its unscoped tail', () => {
    expect(isMentioned('@acme/design-system', 'The design-system holds shared components.')).toBe(
      true,
    );
  });

  it('does not match inside a longer word (cli vs click)', () => {
    expect(isMentioned('cli', 'Users click the button.')).toBe(false);
  });

  it('does not match a hyphen-extended name (web vs web-app)', () => {
    expect(isMentioned('web', 'The web-app bundle.')).toBe(false);
  });

  it('does not match when the name is absent', () => {
    expect(isMentioned('billing', 'The web package serves the UI.')).toBe(false);
  });
});

describe('narrativeDriftAdvisory', () => {
  it('names missing packages and points at /audit', () => {
    const advisory = narrativeDriftAdvisory(
      ['web', 'billing'],
      'Only web is described.',
      'ARCHITECTURE.md',
    );
    expect(advisory).toBeDefined();
    expect(advisory).toContain('billing');
    expect(advisory).not.toContain('web,'); // mentioned package is not listed as missing
    expect(advisory).toContain('ARCHITECTURE.md');
    expect(advisory).toContain('/audit');
  });

  it('is undefined when every package is mentioned', () => {
    expect(
      narrativeDriftAdvisory(['web', 'billing'], 'web and billing are here.', 'ARCHITECTURE.md'),
    ).toBeUndefined();
  });

  it('is undefined when there are no packages (single-repo)', () => {
    expect(narrativeDriftAdvisory([], 'anything', 'ARCHITECTURE.md')).toBeUndefined();
  });

  it('caps the list at 6 names and reports the remainder', () => {
    const packages = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const advisory = narrativeDriftAdvisory(packages, 'nothing mentioned', 'docs/arch.md');
    expect(advisory).toBeDefined();
    for (const name of packages.slice(0, 6)) expect(advisory).toContain(name);
    expect(advisory).not.toContain('p7');
    expect(advisory).not.toContain('p8');
    expect(advisory).toContain('and 2 more');
  });
});
