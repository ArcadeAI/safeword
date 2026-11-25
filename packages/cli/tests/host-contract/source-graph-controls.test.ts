import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

const fixtures: string[] = [];
afterEach(() => {
  for (const directory of fixtures.splice(0))
    rmSync(nodePath.dirname(directory), { recursive: true, force: true });
});
function fixture() {
  const directory = createContractRepoFixture({ generated: true });
  fixtures.push(directory);
  return directory;
}

it('accounts for unregistered shared resources on every intended delivery lane', () => {
  const result = runContractRepoCheck(fixture());
  const graph = JSON.parse(result.output).data.ownership_graph;
  // Independent representatives of every shared content class, not hook registration counts.
  for (const source of [
    'SAFEWORD.md',
    'skills/debug/SKILL.md',
    'skills/bdd/TDD.md',
    'guides/data-architecture-guide.md',
    'agents/safeword-reviewer.md',
    'hooks/lib/verify-stamp-claims.ts',
    'doc-templates/impl-plan-template.md',
  ]) {
    const path = `packages/cli/templates/${source}`;
    const node = graph?.facets.find((row: { path: string }) => row.path === path);
    expect(node, `UNREGISTERED_SHARED_CONTENT_UNACCOUNTED: ${path}`).toBeDefined();
    expect(node.owner).toBe(path);
    expect(
      node.lanes
        .map((row: { id: string }) => row.id)
        .toSorted((a: string, b: string) => a.localeCompare(b)),
    ).toEqual(
      [
        'claude:2.1.319:CLI:native',
        'codex:0.167.0:CLI:native',
        'cursor:2026.11.05-86047df:CLI:native',
        'cursor:3.29.9:IDE:native',
        'cursor:3.29.9:IDE:project-hooks',
        'opencode:2.4.1:CLI:native',
        'opencode:2.4.1:TUI:native',
      ].toSorted((a, b) => a.localeCompare(b)),
    );
    for (const lane of node.lanes) {
      expect(lane.applicable, `${path}/${lane.id}`).toBe(true);
      expect(lane.disposition, `${path}/${lane.id}`).toBe('implementation');
    }
  }
}, 120_000);

it('rejects stale generated output and clears the same named finding after repair', () => {
  const directory = fixture();
  const path = nodePath.join(directory, 'plugin/runtime/cli.js');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, `${original}\n// stale generated runtime\n`);
  const broken = runContractRepoCheck(directory);
  expect(broken.status).toBe(2);
  expect(JSON.parse(broken.output).findings).toContainEqual(
    expect.objectContaining({
      code: 'HOST_CONTRACT_GENERATED_OUTPUT_STALE',
    }),
  );
  writeFileSync(path, original);
  const repaired = runContractRepoCheck(directory);
  expect(repaired.status, repaired.output).toBe(0);
}, 120_000);

it.each([
  '.safeword/guides/testing-guide.md',
  '.claude/skills/bdd/TDD.md',
  '.safeword/hooks/lib/verify-stamp-claims.ts',
  '.claude/agents/safeword-reviewer.md',
])(
  'rejects the missing shared content projection %s independently of hook registrations',
  path => {
    const directory = fixture();
    const target = nodePath.join(directory, path);
    const original = readFileSync(target, 'utf8');
    rmSync(target);
    const broken = runContractRepoCheck(directory);
    expect(broken.status).toBe(2);
    expect(JSON.parse(broken.output).findings).toContainEqual(
      expect.objectContaining({
        code: 'HOST_CONTRACT_PROJECTION_DRIFT',
        message: expect.stringContaining(path),
      }),
    );
    writeFileSync(target, original);
    expect(runContractRepoCheck(directory).status).toBe(0);
  },
  120_000,
);
