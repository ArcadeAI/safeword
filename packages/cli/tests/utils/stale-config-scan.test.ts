/**
 * Stale tooling-config scanner tests (ticket JYWZG1, epic AQJ95G follow-up).
 *
 * scanStaleNamespaceConfigs(cwd) names curated tooling-config files that still
 * reference the legacy `.safeword-project/` path after a namespace migration —
 * excluding documentary refs under the moved `.project/`, the owned `.safeword/`
 * dir, substring near-misses, and the managed `.prettierignore` block.
 *
 * Scenario lineage: migration-stale-config-warning.DEV1.* (test-definitions.md).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scanStaleNamespaceConfigs } from '../../src/utils/stale-config-scan.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

function write(cwd: string, relativePath: string, content: string): void {
  const full = nodePath.join(cwd, relativePath);
  mkdirSync(nodePath.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

const MANAGED_PRETTIER_BLOCK = [
  '# Safeword - managed prettier exclusions',
  '.safeword/',
  '.project/tickets/INDEX.md',
  '.safeword-project/tickets/INDEX.md',
  '',
].join('\n');

describe('scanStaleNamespaceConfigs (JYWZG1)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('DEV1.AC1.scanner_finds_stale_eslint_config', () => {
    write(cwd, 'eslint.config.ts', "export default [{ ignores: ['.safeword-project/'] }];\n");

    expect(scanStaleNamespaceConfigs(cwd)).toContain('eslint.config.ts');
  });

  it('DEV1.AC1.scanner_finds_multiple_config_types', () => {
    write(cwd, 'tsconfig.json', '{ "exclude": [".safeword-project/"] }\n');
    write(cwd, '.github/workflows/ci.yml', "paths-ignore: ['.safeword-project/**']\n");

    expect(new Set(scanStaleNamespaceConfigs(cwd))).toEqual(
      new Set(['tsconfig.json', '.github/workflows/ci.yml']),
    );
  });

  it('DEV1.AC3.clean_repo_produces_no_warning', () => {
    write(cwd, 'eslint.config.ts', "export default [{ ignores: ['.project/'] }];\n");

    expect(scanStaleNamespaceConfigs(cwd)).toEqual([]);
  });

  it('DEV1.AC3.managed_prettierignore_block_not_flagged', () => {
    write(cwd, '.prettierignore', MANAGED_PRETTIER_BLOCK);

    expect(scanStaleNamespaceConfigs(cwd)).toEqual([]);
  });

  it('DEV1.AC3.customer_prettierignore_line_is_flagged', () => {
    write(cwd, '.prettierignore', `${MANAGED_PRETTIER_BLOCK}\n.safeword-project/cache/\n`);

    expect(scanStaleNamespaceConfigs(cwd)).toContain('.prettierignore');
  });

  it('DEV1.AC3.raw_legacy_line_without_managed_block_is_flagged', () => {
    write(cwd, '.prettierignore', '.safeword-project/\nnode_modules/\n');

    expect(scanStaleNamespaceConfigs(cwd)).toContain('.prettierignore');
  });

  it('DEV1.AC3.substring_near_miss_not_flagged', () => {
    write(cwd, 'eslint.config.ts', "export default [{ ignores: ['.safeword-projectile/'] }];\n");

    expect(scanStaleNamespaceConfigs(cwd)).toEqual([]);
  });

  it('DEV1.AC3.reference_under_safeword_owned_dir_not_flagged', () => {
    write(cwd, '.safeword/config.json', '{ "note": ".safeword-project/ legacy" }\n');

    expect(scanStaleNamespaceConfigs(cwd)).toEqual([]);
  });

  it('DEV1.AC3.documentary_reference_under_namespace_not_flagged', () => {
    write(cwd, '.project/tickets/T/ticket.md', 'This ticket moved from .safeword-project/.\n');

    expect(scanStaleNamespaceConfigs(cwd)).toEqual([]);
  });
});
