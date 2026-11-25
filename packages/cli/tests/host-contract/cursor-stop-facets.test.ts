import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

// Independent intended semantic owners, not production discovery output.
const intended = [
  ['completion.session-evidence', 'hooks/lib/done-gate.ts', 'permitted_alternative'],
  ['presentation.terminal-handoff', 'hooks/lib/quality.ts', 'permitted_alternative'],
  ['review.stop-option', 'hooks/lib/review-ledger.ts', 'implementation'],
  ['architecture.done-advice', 'hooks/lib/architecture-document-nudge.ts', 'implementation'],
  ['retrospective.filing-decision', 'hooks/lib/retro-filing-gate.ts', 'implementation'],
  ['retrospective.availability', 'hooks/lib/retro-trigger.ts', 'implementation'],
] as const;
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(nodePath.dirname(root), { recursive: true, force: true });
});
function report(root: string) {
  const result = runContractRepoCheck(root);
  // The shared fixture helper validates state/exit pairs and rejects unavailable proof.
  const current = JSON.parse(result.output);
  // This oracle owns Cursor partials; other hosts have independent relation tests.
  current.data.handler_facets = current.data.handler_facets.filter(
    (row: { composition_id: string }) => row.composition_id === 'cursor.stop',
  );
  return current;
}
it('rejects continuation relations after the explicit host capability is removed', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\n(PRODUCTION_INTEGRATIONS.find(row=>row.id==='cursor')!.capabilities as any).continuationHooks=[];\n`,
  );
  expect(report(root).findings, 'CONTINUATION_CAPABILITY_NOT_CHECKED').toContainEqual(
    expect.objectContaining({ code: 'HOST_CONTRACT_FACET_DISPOSITION_INVALID' }),
  );
  writeFileSync(path, original);
  expect(report(root).data.handler_facets).toHaveLength(12);
});
it('rejects whole adoption overlapping an explicitly partial composition', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const binding = nodePath.join(root, 'packages/cli/templates/hooks/lib/behavior-contract.ts');
  const registry = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts');
  const oldBinding = readFileSync(binding, 'utf8'),
    oldRegistry = readFileSync(registry, 'utf8');
  writeFileSync(
    binding,
    `${oldBinding}\nSHARED_BEHAVIOR_BINDINGS.push({id:'whole.stop',owner:'hooks/cursor/stop.ts',requireExplicitRoutes:true,trigger:'stop',guarantees:['observe']});\n`,
  );
  writeFileSync(
    registry,
    `${oldRegistry}\n(PRODUCTION_INTEGRATIONS.find(row=>row.id==='cursor')!.behaviorRoutes! as any[]).push({behavior:'whole.stop',event:'stop',trigger:'stop',guarantees:['observe'],execution:'synchronous',command:()=> 'bun ./.safeword/hooks/cursor/stop.ts'});\n`,
  );
  const current = report(root);
  expect(current.findings, 'WHOLE_ADOPTION_COMPOSITION_OVERLAP_ACCEPTED').toContainEqual(
    expect.objectContaining({ code: 'HOST_CONTRACT_COMPOSITION_ADOPTION_OVERLAP' }),
  );
  const adopted = new Set(
    current.data.behavior_adoptions.map(
      (row: { registration_index: number }) => row.registration_index,
    ),
  );
  expect(
    current.data.handler_facets.some((row: { registration_index: number }) =>
      adopted.has(row.registration_index),
    ),
  ).toBe(false);
  writeFileSync(binding, oldBinding);
  writeFileSync(registry, oldRegistry);
  expect(report(root).data.handler_facets).toHaveLength(12);
});
it('relates all six known Stop facets to each exact registration without granting whole-handler adoption', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  expect(current.data.handler_facets, 'CURSOR_STOP_FACET_RELATION_MISSING').toHaveLength(12);
  for (const [id, owner, disposition] of intended) {
    const pair = current.data.handler_facets.filter(
      (row: { behavior_id: string }) => row.behavior_id === id,
    );
    expect(pair).toHaveLength(2);
    for (const row of pair) {
      expect(row).toMatchObject({
        owner,
        disposition,
        composition_id: 'cursor.stop',
        loop_limit: 1,
        complete: false,
      });
      const actual = current.data.handler_inventory[row.registration_index];
      expect(actual).toMatchObject({ host: 'cursor', event: 'stop', execution: 'synchronous' });
      expect(actual.configuration.hook.loop_limit).toBe(1);
      const guarantee =
        disposition === 'permitted_alternative' || id === 'retrospective.filing-decision'
          ? 'bounded_continuation'
          : 'observe';
      expect(row.declared_guarantee).toBe(guarantee);
      expect(
        current.data.behavior_adoptions.some(
          (adoption: { registration_index: number }) =>
            adoption.registration_index === row.registration_index,
        ),
      ).toBe(false);
    }
  }
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});

it.each([
  [
    'unsupported rejection',
    "c.facets[0].disposition='implementation'; c.facets[0].guarantee='reject_action';",
    'HOST_CONTRACT_FACET_DISPOSITION_INVALID',
  ],
  ['omitted', 'c.facets.splice(0,1);', 'HOST_CONTRACT_FACET_DISPOSITION_MISSING'],
  ['duplicate', 'c.facets.push({...c.facets[0]});', 'HOST_CONTRACT_FACET_DUPLICATE'],
  [
    'extra',
    "c.facets.push({behavior:'unknown.extra',disposition:'unmet',reason:'unknown',recovery:'inspect'});",
    'HOST_CONTRACT_FACET_SOURCE_MISSING',
  ],
  [
    'wrong guarantee',
    "c.facets[0].guarantee='reject_action';",
    'HOST_CONTRACT_FACET_DISPOSITION_INVALID',
  ],
  [
    'unmet reason',
    "c.facets[2]={behavior:c.facets[2].behavior,disposition:'unmet',reason:'',recovery:'restore explicit recovery'};",
    'HOST_CONTRACT_FACET_DISPOSITION_INVALID',
  ],
  ['second composition', 'rows.push({...c});', 'HOST_CONTRACT_COMPOSITION_SELECTION_INVALID'],
])('rejects %s facet disposition and restores the relation', (_kind, mutation, code) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\nconst rows=PRODUCTION_INTEGRATIONS.find(row=>row.id==='cursor')!.handlerCompositions! as any[]; const c=rows[0]; ${mutation}\n`,
  );
  expect(report(root).findings).toContainEqual(
    expect.objectContaining({
      code,
      metadata: expect.objectContaining({ composition_id: 'cursor.stop' }),
    }),
  );
  writeFileSync(path, original);
  expect(report(root).data.handler_facets).toHaveLength(12);
});
it.each([
  ['bound', 'CURSOR_HOOKS.stop[0].loop_limit=2;', 'HOST_CONTRACT_COMPOSITION_OPTIONS_INVALID'],
  [
    'execution',
    'Object.assign(CURSOR_HOOKS.stop[0],{async:true});',
    'HOST_CONTRACT_COMPOSITION_SELECTION_INVALID',
  ],
  [
    'matcher',
    "Object.assign(CURSOR_HOOKS.stop[0],{matcher:'Read'});",
    'HOST_CONTRACT_COMPOSITION_SELECTION_INVALID',
  ],
])('rejects actual Stop %s drift and restores both deliveries', (_kind, mutation, code) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/templates/config.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, `${original}\n${mutation}\n`);
  const changed = report(root);
  expect(changed.data.handler_facets).toEqual([]);
  expect(changed.findings).toContainEqual(expect.objectContaining({ code }));
  writeFileSync(path, original);
  expect(report(root).data.handler_facets).toHaveLength(12);
});
it('rejects a completion decision bypass and repairs its actual owner relation', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/templates/hooks/cursor/stop.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    original.replace('evaluateSessionDoneEvidence(process.cwd(), runIdentity)', 'undefined'),
  );
  expect(report(root).findings).toContainEqual(
    expect.objectContaining({
      code: 'HOST_CONTRACT_FACET_SOURCE_MISSING',
      metadata: expect.objectContaining({ behavior_id: 'completion.session-evidence' }),
    }),
  );
  writeFileSync(path, original);
  expect(report(root).data.handler_facets).toHaveLength(12);
});
