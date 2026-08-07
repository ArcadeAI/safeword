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

  it('blocks changed advisory surfaces on the disposable compatibility proof', () => {
    const workflow = readFileSync(
      nodePath.join(REPO_ROOT, '.github/workflows/release.yml'),
      'utf8',
    );
    expect(workflow).toContain('advisory-pr-review-smoke:');
    expect(workflow).toContain(
      'advisory_smoke_required: ${{ steps.advisory-smoke-scope.outputs.required }}',
    );
    expect(workflow).toContain('git fetch origin refs/heads/stable:refs/remotes/origin/stable');
    expect(workflow).toContain('git diff --quiet refs/remotes/origin/stable "$GITHUB_SHA"');
    expect(workflow).toContain('packages/cli/src/pr-review');
    expect(workflow).toContain("needs.build.outputs.advisory_smoke_required == 'true'");
    expect(workflow).toContain('environment: pr-review-smoke');
    expect(workflow).toContain('needs: [build, advisory-pr-review-smoke]');
    expect(workflow).toContain("needs['advisory-pr-review-smoke'].result == 'skipped'");
    expect(workflow).toContain("needs.build.outputs.advisory_smoke_required == 'false'");
    expect(workflow).toContain('secrets.SAFEWORD_PR_REVIEW_SMOKE_TOKEN');
    expect(workflow).toContain('smoke:pr-review:disposable');
  });

  it('watches platform drift with a sandbox-only advisory canary', () => {
    const canary = readFileSync(
      nodePath.join(REPO_ROOT, '.github/workflows/advisory-pr-review-canary.yml'),
      'utf8',
    );
    const runner = readFileSync(
      nodePath.join(CLI_ROOT, 'scripts/run-pr-review-disposable-smoke.ts'),
      'utf8',
    );
    const readme = readFileSync(nodePath.join(REPO_ROOT, 'README.md'), 'utf8');

    expect(canary).toContain('workflow_dispatch:');
    expect(canary).toContain("cron: '37 5 * * *'");
    expect(canary).toContain("github.event_name == 'schedule'");
    expect(canary).toContain('github.event.repository.default_branch');
    expect(canary).toContain('environment: pr-review-smoke');
    expect(canary).toContain('secrets.SAFEWORD_PR_REVIEW_SMOKE_TOKEN');
    expect(canary).toContain('smoke:pr-review:disposable');
    expect(runner).toContain('must name two dedicated sandbox owners');
    expect(readme).toContain('SAFEWORD_PR_REVIEW_SMOKE_OWNER');
    expect(readme).toMatch(/must not have authority over production\s+repositories/u);
    expect(readme).toContain('SAFEWORD_KEEP_PR_REVIEW_SMOKE=1');
    expect(readme).toMatch(/permanently\s+deletes both repositories/u);
  });
});
