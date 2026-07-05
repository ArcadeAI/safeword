/**
 * Unit Tests: Rust deny.toml generation
 *
 * Tests the `deny.toml` generator in src/packs/rust/files.ts — the config the
 * `cargo deny check` supply-chain gate reads. These run without cargo, so they
 * cover the schema-critical properties that the (cargo-dependent) golden-path
 * integration test cannot exercise in a sandbox.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { rustManagedFiles } from '../../src/packs/rust/files.js';
import { createProjectContext } from '../../src/utils/context.js';
import { createTemporaryDirectory, removeTemporaryDirectory, writeTestFile } from '../helpers.js';

const denyGenerator = rustManagedFiles['deny.toml']?.generator;

describe('rust deny.toml generator', () => {
  let dir: string;

  beforeEach(() => {
    dir = createTemporaryDirectory();
    writeTestFile(dir, 'Cargo.toml', `[package]\nname = "app"\nedition = "2021"\n`);
  });

  afterEach(() => {
    removeTemporaryDirectory(dir);
  });

  it('emits config only for Rust projects', () => {
    const nonRust = createTemporaryDirectory();
    try {
      writeTestFile(nonRust, 'package.json', JSON.stringify({ name: 'x' }));
      expect(denyGenerator?.(createProjectContext(nonRust))).toBeUndefined();
    } finally {
      removeTemporaryDirectory(nonRust);
    }
  });

  it('declares all four cargo-deny check sections', () => {
    const config = denyGenerator?.(createProjectContext(dir)) ?? '';
    expect(config).toContain('[advisories]');
    expect(config).toContain('[licenses]');
    expect(config).toContain('[bans]');
    expect(config).toContain('[sources]');
  });

  it('avoids the churned version/severity keys that break across cargo-deny releases', () => {
    // The schema for advisory severity (`vulnerability`, `yanked`, …) and the
    // section `version` field moved across releases; relying on defaults keeps
    // the generated file valid on current cargo-deny. Regression guard.
    const config = denyGenerator?.(createProjectContext(dir)) ?? '';
    expect(config).not.toMatch(/^[ \t]*version[ \t]*=/m);
    expect(config).not.toMatch(/vulnerability[ \t]*=/);
    expect(config).not.toMatch(/\byanked[ \t]*=/);
  });

  it('ships a broad permissive license allow-list so the gate does not false-red on install', () => {
    const config = denyGenerator?.(createProjectContext(dir)) ?? '';
    for (const license of ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'Unicode-3.0']) {
      expect(config).toContain(`"${license}"`);
    }
  });

  it('treats duplicate versions as a warning, not a hard failure', () => {
    const config = denyGenerator?.(createProjectContext(dir)) ?? '';
    expect(config).toContain('multiple-versions = "warn"');
  });
});
