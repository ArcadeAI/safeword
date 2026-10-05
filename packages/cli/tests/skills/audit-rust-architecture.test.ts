/**
 * /audit's Rust architecture step must not report module cycles as checked
 * (#5374): Cargo rejects circular crate dependencies, but modules inside one
 * crate may reference each other, so a passing build proves nothing about them.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const audit = readFileSync(
  nodePath.join(import.meta.dirname, '../../templates/skills/audit/SKILL.md'),
  'utf8',
);

// From the Rust step's header comment to the end of its `fi`.
const rustStep = audit.slice(
  audit.indexOf('# 1d. Architecture - Rust.'),
  audit.indexOf('# DEAD CODE DETECTION'),
);

describe('/audit Rust architecture step (#5374)', () => {
  it('finds the Rust step', () => {
    expect(rustStep).toContain('RUST_CRATE_DIRS');
  });

  it('limits the compiler guarantee to crate dependencies', () => {
    expect(rustStep).toContain('crate dependency cycles are compiler-guaranteed absent');
    expect(rustStep).not.toContain('crate/module cycles are compiler-guaranteed absent');
    expect(rustStep).not.toContain('forbids mutually-recursive modules');
  });

  it('reports module cycles as not checked, with manual evidence required', () => {
    expect(rustStep).toContain('Manual evidence required');
    expect(rustStep).toMatch(/module cycles[^"]*NOT (statically )?checked/);
  });
});
