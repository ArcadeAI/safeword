import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const root = nodePath.resolve(import.meta.dirname, '../../../..');

describe('planning fallback documentation', () => {
  it('explains bounded approvals, currency, recovery, and host enforcement in public guidance', () => {
    const readme = readFileSync(nodePath.join(root, 'README.md'), 'utf8');
    const workflow = readFileSync(
      nodePath.join(root, 'packages/website/src/content/docs/getting-started/workflow.mdx'),
      'utf8',
    );
    for (const content of [readme, workflow]) {
      expect(content).toContain('Product Plan approval');
      expect(content).toContain('Implementation Plan approval');
      expect(content).toContain('Execution Plan approval');
      expect(content).toContain('exact plan bytes');
      expect(content).toContain('semantic dependencies');
      expect(content).toContain('re-review');
      expect(content).toMatch(/reduced\s+independence/u);
      expect(content).toContain('Codex Cloud');
      expect(content).toContain('OpenCode Desktop');
      expect(content).toContain('OpenCode CLI');
    }
  });
  it('marks the older coordinator decision as superseded in part', () => {
    const architecture = readFileSync(nodePath.join(root, 'ARCHITECTURE.md'), 'utf8');
    const olderRecord = architecture
      .split('**Date:** 2026-08-02', 2)[1]
      ?.split('**OpenCode extension', 1)[0];
    expect(olderRecord).toContain(
      'Superseded in part by the 2026-09-20 planning fallback decision',
    );
    expect(olderRecord).toContain('immutable coordinator packet');
  });

  it('describes reduced fallback honestly in the public overview', () => {
    const readme = readFileSync(nodePath.join(root, 'README.md'), 'utf8');
    expect(readme).toContain('reduced independence');
    expect(readme).toContain('Cursor itself has no headless reviewer route');
    expect(readme).toContain('A current receipt is still required at the phase');
    expect(readme).not.toContain('Both read the live worktree, so');
    expect(readme).toContain('opt-in `architectureReviewGate`');
    expect(readme).toContain('reasoned skip');
  });

  it('distinguishes planning approval from the later independent architecture gate', () => {
    const guidance = readFileSync(
      nodePath.join(root, 'packages/cli/templates/skills/bdd/PLAN_IMPLEMENTATION.md'),
      'utf8',
    );
    expect(guidance).toMatch(/does not clear\s+the later architecture gate/u);
    expect(guidance).toContain('reasoned skip');
  });

  it('describes the Cursor Cloud transition boundary without claiming stop hooks are absent', () => {
    const guidance = readFileSync(
      nodePath.join(root, 'packages/cli/templates/skills/bdd/PLAN_IMPLEMENTATION.md'),
      'utf8',
    );
    expect(guidance).toContain('Cursor Cloud Agents run command-based `preToolUse` and stop hooks');
    expect(guidance).toContain('enforcement\n   rides the transition gate');
  });
});
