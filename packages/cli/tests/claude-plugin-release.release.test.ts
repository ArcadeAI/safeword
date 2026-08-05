import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const CLI_ROOT = nodePath.resolve(import.meta.dirname, '..');
const REPO_ROOT = nodePath.resolve(CLI_ROOT, '../..');

describe('Claude plugin release contract', () => {
  it('binds the committed catalogue to package version, hooks, inventory, and guidance', () => {
    const result = spawnSync('bun', ['scripts/check-claude-plugin-release.ts'], {
      cwd: CLI_ROOT,
      encoding: 'utf8',
    });
    expect(`${result.stdout}${result.stderr}`).toContain(
      'Claude plugin release contract is aligned',
    );
    expect(result.status).toBe(0);
  });

  it('keeps the real-host upgrade gate in the maintainer release path', () => {
    const readme = readFileSync(nodePath.join(REPO_ROOT, 'README.md'), 'utf8');
    const runbookPath = nodePath.join(CLI_ROOT, 'tests/smoke/claude-plugin-manual-acceptance.md');
    const runbook = readFileSync(runbookPath, 'utf8');

    expect(readme).toContain('Claude plugin manual acceptance runbook');
    expect(runbook).toContain('previous stable release');
    expect(runbook).toContain('same marketplace name');
    expect(runbook).toContain('exact candidate tag');
    expect(runbook).toContain('canonical candidate cache root');
    expect(runbook).toContain('Stable publication is blocked');
  });

  it('promotes one monotonic stable channel only after stable publication', () => {
    const workflow = readFileSync(
      nodePath.join(REPO_ROOT, '.github/workflows/release.yml'),
      'utf8',
    );

    expect(workflow).toContain('group: safeword-stable-release');
    expect(workflow).toContain('needs: publish');
    expect(workflow).toContain("if: ${{ !contains(github.ref_name, '-') }}");
    expect(workflow).toContain('npm view "safeword@$TAG_VERSION" version');
    expect(workflow).toContain('git push origin "$GITHUB_SHA:refs/heads/stable"');
    expect(workflow).not.toMatch(/git push[^\n]*(?:--force|-f\b)/u);
  });
});
