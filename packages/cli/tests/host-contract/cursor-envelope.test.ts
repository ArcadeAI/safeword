import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(nodePath.dirname(root), { recursive: true, force: true });
});
it('accounts both exact Cursor Stop compositions without closing the facet/lane graph', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const result = runContractRepoCheck(root),
    report = JSON.parse(result.output);
  const rows = report.data.handler_envelopes.filter(
    (row: { composition_id?: string }) => row.composition_id === 'cursor.stop',
  );
  expect(rows, 'CURSOR_STOP_OUTER_ACCOUNTING_MISSING').toHaveLength(2);
  expect(
    rows.map(
      (row: { registration_index: number }) =>
        report.data.handler_inventory[row.registration_index].source_family ?? 'legacy',
    ),
  ).toEqual(['legacy', 'cursor-native']);
  expect(report.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
  expect(result.status).toBe(0);
  expect(report.state).toBe('healthy');
  for (const row of rows) {
    expect(row.owner).toBe('packages/cli/templates/hooks/cursor/stop.ts');
    expect(row.facet_behaviors).toEqual([
      'completion.session-evidence',
      'presentation.terminal-handoff',
      'review.stop-option',
      'architecture.done-advice',
      'retrospective.filing-decision',
      'retrospective.availability',
    ]);
    expect(row.local_policy_scopes).toEqual([
      '<module>',
      'assistantText',
      'readLastAssistantMessage',
      'emitRetroOrEmpty',
      'isAutomatedEvidenceRun',
      'architectureNudgeForDonePhase',
    ]);
    expect(
      report.data.behavior_adoptions.some(
        (adoption: { registration_index: number }) =>
          adoption.registration_index === row.registration_index,
      ),
    ).toBe(false);
  }
  expect(report.data.handler_facets).toHaveLength(22);
  expect(
    report.findings.filter((finding: { severity: string }) => finding.severity === 'error'),
  ).toEqual([]);
});

it.each([
  [
    'wrong owner',
    'packages/cli/src/lifecycle/integrations.ts',
    "owner: 'packages/cli/templates/hooks/cursor/stop.ts'",
    "owner: 'foreign.ts'",
  ],
  [
    'status condition',
    'packages/cli/templates/hooks/cursor/stop.ts',
    "input.status !== 'completed'",
    "input.status !== 'aborted'",
  ],
  [
    'loop condition',
    'packages/cli/templates/hooks/cursor/stop.ts',
    'if ((input.loop_count ?? 0) === 0) {',
    'if ((input.loop_count ?? 0) === 1) {',
  ],
  [
    'workspace argument',
    'packages/cli/templates/hooks/cursor/stop.ts',
    'process.chdir(workspace)',
    'process.chdir(process.cwd())',
  ],
  ['missing scope', 'packages/cli/src/lifecycle/integrations.ts', "          '<module>',\n", ''],
  [
    'native target',
    'packages/cli/src/cursor-plugin/dispatch.ts',
    "'hooks', binding.path",
    "'hooks', 'foreign.ts'",
  ],
  ['native argument loss', 'packages/cli/src/cursor-plugin/dispatch.ts', ', ...binding.args]', ']'],
])(
  'rejects %s through the checker and restores the selected pair',
  (_name, relative, before, after) => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(root, relative),
      original = readFileSync(path, 'utf8');
    expect(original).toContain(before);
    writeFileSync(
      path,
      original.replace(before, () => after),
    );
    const broken = JSON.parse(runContractRepoCheck(root).output);
    expect(broken.findings.map((finding: { code: string }) => finding.code)).toContain(
      'HOST_CONTRACT_ENVELOPE_PROVENANCE_MISSING',
    );
    writeFileSync(path, original);
    expect(runContractRepoCheck(root).status).toBe(0);
  },
);

it('names an omitted outer disposition instead of relying on a permanently unknown row', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts'),
    original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\nconst c=PRODUCTION_INTEGRATIONS.find(row=>row.id==='cursor')!; for(const route of c.handlerCompositions!) delete (route as any).envelope;\n`,
  );
  const result = runContractRepoCheck(root),
    broken = JSON.parse(result.output);
  expect(result.status).toBe(2);
  expect(
    broken.findings.filter(
      (finding: { code: string; metadata?: { host?: string } }) =>
        finding.code === 'UNCLASSIFIED_HOST_CONTRACT_HANDLER' &&
        finding.metadata?.host === 'cursor',
    ),
  ).toHaveLength(2);
  expect(
    broken.data.handler_facets.filter(
      (row: { composition_id: string }) => row.composition_id === 'cursor.stop',
    ),
  ).toHaveLength(12);
  writeFileSync(path, original);
  expect(runContractRepoCheck(root).status).toBe(0);
});

it('rejects a duplicated composition without inflating the two intentional selections', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts'),
    original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\nconst c=PRODUCTION_INTEGRATIONS.find(row=>row.id==='cursor')!; (c.handlerCompositions as any).push({...c.handlerCompositions![0]});\n`,
  );
  const broken = JSON.parse(runContractRepoCheck(root).output);
  expect(broken.findings.map((finding: { code: string }) => finding.code)).toContain(
    'HOST_CONTRACT_COMPOSITION_SELECTION_INVALID',
  );
  expect(
    broken.data.handler_envelopes.filter(
      (row: { composition_id?: string }) => row.composition_id === 'cursor.stop',
    ).length,
  ).toBeLessThanOrEqual(2);
  writeFileSync(path, original);
  expect(runContractRepoCheck(root).status).toBe(0);
});

it('keeps a missing source unavailable rather than accepting it as incomplete registration accounting', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/templates/hooks/cursor/stop.ts'),
    original = readFileSync(path);
  rmSync(path);
  expect(() => runContractRepoCheck(root)).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
  writeFileSync(path, original);
  expect(runContractRepoCheck(root).status).toBe(0);
});
