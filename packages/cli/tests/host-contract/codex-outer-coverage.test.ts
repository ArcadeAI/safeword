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
function report(root: string) {
  const result = runContractRepoCheck(root);
  // The shared fixture helper validates state/exit pairs and rejects unavailable proof.
  return JSON.parse(result.output);
}
it('accounts actual Codex outer calls while retaining incomplete semantic and native coverage', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  const rows = current.data.outer_call_coverage;
  expect(rows, 'CODEX_OUTER_CALL_COVERAGE_MISSING').toHaveLength(4);
  expect(rows.map((row: { composition_id: string }) => row.composition_id)).toEqual([
    'codex.session-context',
    'codex.post-context',
    'codex.prompt-context',
    'codex.stop',
  ]);
  for (const row of rows) {
    expect(row.complete).toBe(false);
    expect(row.unresolved_scopes).toContain('transitive-policy-and-imported-bodies');
    expect(row.unresolved_scopes).toContain('const-bound-functions-and-default-imports');
    expect(
      row.calls.some(
        (call: { callee: string; kind: string }) =>
          call.callee === 'legacyCodexEventIsViable' && call.kind === 'host_policy',
      ),
    ).toBe(true);
  }
  const stop = rows[3];
  const kinds = new Map<string, string>(
    rows.flatMap((row: { calls: { callee: string; kind: string }[] }) =>
      row.calls.map(call => [call.callee, call.kind] as const),
    ),
  );
  expect([...kinds].toSorted(([left], [right]) => left.localeCompare(right))).toEqual([
    ['augmentSessionStart', 'transport'],
    ['classifyPackagedStopOutput', 'host_policy'],
    ['collectPostToolLintContexts', 'shared_delegate'],
    ['emitAdditionalContext', 'transport'],
    ['emitStopContinuation', 'transport'],
    ['emitStopNoop', 'transport'],
    ['hasSafewordProjectMarker', 'host_policy'],
    ['legacyCodexEventIsViable', 'host_policy'],
    ['normalizeEvent', 'transport'],
    ['packagedAdditionalContext', 'transport'],
    ['packagedSafewordHandbookPath', 'host_policy'],
    ['packagedWorkflowContext', 'host_policy'],
    ['parseCodexHookInput', 'transport'],
    ['postToolLintInputs', 'transport'],
    ['readPackagedSafewordInstructions', 'host_policy'],
    ['readProjectTextFile', 'host_policy'],
    ['readStdin', 'transport'],
    ['recordCodexHookProof', 'evidence'],
    ['requireNativeProject', 'host_policy'],
    ['resolveCodexProjectDirectory', 'host_policy'],
    ['runPackagedHook', 'shared_delegate'],
    ['usablePackagedHandbookPath', 'host_policy'],
  ]);
  expect(stop.calls).toContainEqual(
    expect.objectContaining({
      callee: 'classifyPackagedStopOutput',
      kind: 'host_policy',
      owner: 'packages/cli/src/commands/codex-hook.ts',
    }),
  );
  expect(stop.calls).toContainEqual(
    expect.objectContaining({
      callee: 'readProjectTextFile',
      kind: 'host_policy',
      arguments: ['projectDirectory', 'STOP_CONTINUATION_PATH'],
    }),
  );
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});

it.each([
  [
    'missing',
    "c.outerCallDispositions.splice(c.outerCallDispositions.findIndex(row=>row.callee==='legacyCodexEventIsViable'),1);",
    'HOST_CONTRACT_OUTER_DISPOSITION_MISSING',
  ],
  [
    'duplicate',
    'c.outerCallDispositions.push({...c.outerCallDispositions[0]});',
    'HOST_CONTRACT_OUTER_DISPOSITION_DUPLICATE',
  ],
  [
    'extra',
    "c.outerCallDispositions.push({callee:'inventedOwner',kind:'transport',reason:'not a source binding'});",
    'HOST_CONTRACT_OUTER_DISPOSITION_EXTRA',
  ],
  [
    'invalid',
    "c.outerCallDispositions[0].kind='denial';",
    'HOST_CONTRACT_OUTER_DISPOSITION_INVALID',
  ],
  [
    'event',
    "c.outerCallDispositions.find(row=>row.callee==='readProjectTextFile').events=['SessionStart'];",
    'HOST_CONTRACT_OUTER_DISPOSITION_EXTRA',
  ],
] as const)('rejects %s disposition and repairs', (_name, mutation, code) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts'),
    original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\nconst c = PRODUCTION_INTEGRATIONS.find(row=>row.id==='codex') as any;\n${mutation}`,
  );
  expect(report(root).findings).toContainEqual(expect.objectContaining({ code }));
  writeFileSync(path, original);
  expect(
    report(root).findings.some((row: { code: string }) =>
      row.code.startsWith('HOST_CONTRACT_OUTER_'),
    ),
  ).toBe(false);
});
it('rejects a prompt queue bypass even when the same reader remains in Stop and post-tool', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/commands/codex-hook.ts'),
    original = readFileSync(path, 'utf8');
  const before = 'readProjectTextFile(projectDirectory, PROMPT_CONTEXT_PATH)';
  expect(original).toContain(before);
  writeFileSync(
    path,
    original.replace(before, () => 'readPackagedSafewordInstructions()'),
  );
  expect(report(root).findings).toContainEqual(
    expect.objectContaining({
      code: 'HOST_CONTRACT_OUTER_DISPOSITION_MISSING',
      metadata: expect.objectContaining({
        callee: 'readProjectTextFile',
        event: 'UserPromptSubmit',
      }),
    }),
  );
  writeFileSync(path, original);
  expect(
    report(root).findings.some((row: { code: string }) =>
      row.code.startsWith('HOST_CONTRACT_OUTER_'),
    ),
  ).toBe(false);
});
