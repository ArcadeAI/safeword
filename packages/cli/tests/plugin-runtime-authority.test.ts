import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { assertNativePluginRuntimeAuthority } from '../src/plugin-runtime-authority.js';
import { createContractRepoFixture } from './helpers/contract-repo-fixture.js';

describe('native catalogue release authority', () => {
  it('validates executable references across the generated OpenCode V2 catalogue', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'opencode-release-'));
    try {
      const output = nodePath.join(root, 'package');
      const result = spawnSync(
        'bun',
        ['scripts/generate-opencode-v2-plugin.ts', '--output', output],
        {
          cwd: nodePath.resolve(import.meta.dirname, '..'),
          encoding: 'utf8',
          timeout: 60_000,
        },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(existsSync(nodePath.join(output, 'skills/quality-review/SKILL.md'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    'bunx tsx .safeword/hooks/run-review.ts',
    'npx tsx .safeword/hooks/run-review.ts',
    'python3 .safeword/scripts/cleanup-zombies.py',
    'deno run .safeword/hooks/check.ts',
    '$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts "$PROJECT_DIR" verify',
    'echo .safeword/hooks/old.ts; bun .safeword/hooks/run-review.ts',
  ])('rejects native runtime borrowing regardless of command shape: %s', content => {
    expect(() => {
      assertNativePluginRuntimeAuthority([{ relativePath: 'skills/audit/SKILL.md', content }]);
    }).toThrow('skills/audit/SKILL.md');
  });

  it.each([
    ['Codex', 'generate-codex-plugin.ts'],
    ['Claude Code', 'generate-claude-plugin.ts'],
    ['OpenCode', 'generate-opencode-v2-plugin.ts'],
  ] as const)(
    'rejects a project-runtime reference in the generated %s catalogue',
    (host, script) => {
      const repo = createContractRepoFixture({ generated: false });
      const root = nodePath.dirname(repo);
      try {
        const cli = nodePath.join(repo, 'packages/cli');
        appendFileSync(
          nodePath.join(cli, 'templates/skills/audit/SKILL.md'),
          '\nRun `bun .claude/skills/private-runtime/task.ts`.\n',
        );
        const args = [nodePath.join('scripts', script)];
        if (host === 'OpenCode') args.push('--output', nodePath.join(root, 'package'));
        const result = spawnSync('bun', args, { cwd: cli, encoding: 'utf8', timeout: 60_000 });
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
          'Native plugin assets reference project-local executable runtime: skills/audit/SKILL.md',
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    120_000,
  );
});
