import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const currentRepoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const repoRoot = process.env.SAFEWORD_PROOF_ROOT ?? currentRepoRoot;

const read = (path: string): string => {
  const fullPath = nodePath.join(repoRoot, path);
  expect(existsSync(fullPath), `missing installed Ready-gate surface: ${path}`).toBe(true);
  return readFileSync(fullPath, 'utf8');
};

const installedHosts = [
  {
    host: 'Claude Code',
    lifecycle: '.claude/settings.json',
    lifecycleMarker: '.safeword/hooks/pre-tool-quality.ts',
    gate: 'packages/cli/templates/hooks/pre-tool-quality.ts',
  },
  {
    host: 'OpenAI Codex',
    lifecycle: 'packages/cli/codex-plugin/hooks.json',
    lifecycleMarker: 'hook codex pre-tool-use',
    gate: 'packages/cli/codex-plugin/templates/hooks/pre-tool-quality.ts',
  },
  {
    host: 'Cursor',
    lifecycle: '.cursor/hooks.json',
    lifecycleMarker: '.safeword/hooks/cursor/before-shell-execution.ts',
    gate: 'packages/cli/templates/hooks/pre-tool-quality.ts',
  },
];

describe('installed Ready gate', () => {
  it.each(installedHosts)(
    '$host routes its lifecycle configuration through the shared gate',
    row => {
      expect(read(row.lifecycle)).toContain(row.lifecycleMarker);
      expect(read(row.gate)).toContain("from './lib/pr-readiness-guard.ts'");
    },
  );
});
