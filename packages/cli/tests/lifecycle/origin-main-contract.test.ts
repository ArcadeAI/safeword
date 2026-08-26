import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const FIXTURE_ROOT = nodePath.join(import.meta.dirname, '../fixtures/lifecycle-origin-main');
const ORIGIN_MAIN_COMMIT = 'ee16c387d497ad39c2c007d4e4787a88d58ee45b';
const CONTRACT_CASES = [
  'claude-install',
  'claude-upgrade',
  'claude-check',
  'claude-uninstall',
  'codex-install',
  'codex-upgrade',
  'codex-check',
  'codex-uninstall',
  'cursor-install',
  'cursor-upgrade',
  'cursor-check',
  'cursor-uninstall',
] as const;

interface FixtureManifest {
  readonly originMainCommit: string;
  readonly fixtures: Readonly<Record<string, string>>;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('origin/main integration contracts', () => {
  it.each(CONTRACT_CASES)('SWM1.R3.S04 pins %s by committed digest', contractCase => {
    const manifestPath = nodePath.join(FIXTURE_ROOT, 'manifest.json');
    expect(existsSync(manifestPath), 'origin/main fixture manifest is committed').toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as FixtureManifest;
    const fixturePath = nodePath.join(FIXTURE_ROOT, `${contractCase}.json`);
    expect(manifest.originMainCommit).toBe(ORIGIN_MAIN_COMMIT);
    expect(existsSync(fixturePath), `${contractCase} fixture is committed`).toBe(true);
    expect(sha256(readFileSync(fixturePath, 'utf8'))).toBe(manifest.fixtures[contractCase]);
  });
});
