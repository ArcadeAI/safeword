/**
 * Unit Tests: Rust rustfmt edition derivation
 *
 * Tests for resolveRustEdition in src/packs/rust/files.ts — the rustfmt.toml
 * `edition` must mirror the crate's Cargo.toml edition (rustfmt.toml overrides
 * what `cargo fmt` infers), falling back to the current stable edition when it
 * can't be resolved.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveRustEdition } from '../../src/packs/rust/files.js';
import { createTemporaryDirectory, removeTemporaryDirectory, writeTestFile } from '../helpers.js';

describe('resolveRustEdition', () => {
  let dir: string;

  beforeEach(() => {
    dir = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(dir);
  });

  it('mirrors an explicit [package] edition (2024)', () => {
    writeTestFile(
      dir,
      'Cargo.toml',
      `[package]\nname = "app"\nedition = "2024"\n\n[dependencies]\n`,
    );
    expect(resolveRustEdition(dir)).toBe('2024');
  });

  it('mirrors an explicit [package] edition (2021)', () => {
    writeTestFile(dir, 'Cargo.toml', `[package]\nname = "app"\nedition = "2021"\n`);
    expect(resolveRustEdition(dir)).toBe('2021');
  });

  it('reads workspace-inherited edition from [workspace.package]', () => {
    // edition.workspace = true → the value lives in [workspace.package]
    writeTestFile(
      dir,
      'Cargo.toml',
      `[workspace.package]\nedition = "2024"\n\n[package]\nname = "app"\nedition.workspace = true\n`,
    );
    expect(resolveRustEdition(dir)).toBe('2024');
  });

  it('reads edition from a virtual manifest (no [package])', () => {
    writeTestFile(
      dir,
      'Cargo.toml',
      `[workspace]\nmembers = ["crates/*"]\n\n[workspace.package]\nedition = "2021"\n`,
    );
    expect(resolveRustEdition(dir)).toBe('2021');
  });

  it('falls back to 2024 when no edition is declared', () => {
    writeTestFile(dir, 'Cargo.toml', `[package]\nname = "app"\nversion = "0.1.0"\n`);
    expect(resolveRustEdition(dir)).toBe('2024');
  });

  it('falls back to 2024 when Cargo.toml is absent', () => {
    expect(resolveRustEdition(dir)).toBe('2024');
  });

  it('does not read edition from an unrelated later section', () => {
    // A [dependencies] entry named edition-like must not be picked up as the
    // package edition; the scan stops at the next section header.
    writeTestFile(
      dir,
      'Cargo.toml',
      `[package]\nname = "app"\n\n[dependencies]\nsome-edition-crate = "1.0"\n`,
    );
    expect(resolveRustEdition(dir)).toBe('2024');
  });
});
