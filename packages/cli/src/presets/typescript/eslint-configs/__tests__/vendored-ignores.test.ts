/**
 * Tests for vendoredIgnores config - Ticket 152
 *
 * Covers scenarios:
 * - 1.1: configs.vendoredIgnores is a typed, spreadable array
 * - 1.2: The single config block is a globalIgnores() result
 * - 2.1: Contains exactly '.safeword/**' and '.dependency-cruiser.cjs'
 */

import { describe, expect, it } from 'vitest';

import safeword from '../../index.js';
import { vendoredIgnoresConfig } from '../vendored-ignores.js';

describe('vendoredIgnoresConfig', () => {
  it('is a non-empty array (spreadable)', () => {
    expect(Array.isArray(vendoredIgnoresConfig)).toBe(true);
    expect(vendoredIgnoresConfig.length).toBeGreaterThan(0);
  });

  it('contains exactly one global-ignores config block', () => {
    expect(vendoredIgnoresConfig).toHaveLength(1);
    const block = vendoredIgnoresConfig[0];
    expect(block).toBeTypeOf('object');
    expect(block).not.toBeNull();
    expect(block).toHaveProperty('ignores');
  });

  it('the block has no rules / files / languageOptions keys (stays global)', () => {
    const block = vendoredIgnoresConfig[0] as Record<string, unknown>;
    expect(block).not.toHaveProperty('rules');
    expect(block).not.toHaveProperty('files');
    expect(block).not.toHaveProperty('languageOptions');
  });

  it('ignores exactly the safeword vendored paths', () => {
    const block = vendoredIgnoresConfig[0] as { ignores: string[] };
    expect(block.ignores).toEqual(['.safeword/**', '.dependency-cruiser.cjs']);
  });

  it('is reachable via safeword.configs.vendoredIgnores (namespace wiring)', () => {
    expect(safeword.configs.vendoredIgnores).toBe(vendoredIgnoresConfig);
  });
});
