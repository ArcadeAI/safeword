import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

type Facet = {
  composition_id: string;
  behavior_id: string;
  owner: string;
  declared_guarantee: string;
  registration_index: number;
  complete: boolean;
  loop_limit?: number;
};
const intended = [
  ['completion.session-evidence', 'hooks/lib/done-gate.ts', 'bounded_continuation'],
  ['presentation.terminal-handoff', 'hooks/lib/quality.ts', 'bounded_continuation'],
  ['architecture.done-advice', 'hooks/lib/architecture-document-nudge.ts', 'observe'],
  ['retrospective.filing-decision', 'hooks/lib/retro-filing-gate.ts', 'bounded_continuation'],
] as const;
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
it('relates actual Codex Stop calls without adopting the outer multiplexed registration', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  const rows = current.data.handler_facets.filter(
    (row: Facet) => row.composition_id === 'codex.stop',
  );
  expect(rows, 'CODEX_STOP_SHARED_FACETS_MISSING').toHaveLength(4);
  expect(rows.map((row: Facet) => [row.behavior_id, row.owner, row.declared_guarantee])).toEqual(
    intended,
  );
  for (const row of rows) {
    expect(row.complete).toBe(false);
    expect(row.loop_limit).toBeUndefined();
    expect(current.data.handler_inventory[row.registration_index]).toMatchObject({
      host: 'codex',
      event: 'Stop',
      source_family: 'codex-native',
      execution: 'synchronous',
      matcher: '',
    });
    expect(
      current.data.behavior_adoptions.some(
        (item: { registration_index: number }) =>
          item.registration_index === row.registration_index,
      ),
    ).toBe(false);
  }
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});
it.each([
  [
    'missing facet',
    'packages/cli/src/lifecycle/integrations.ts',
    'c.facets.pop();',
    'HOST_CONTRACT_FACET_DISPOSITION_MISSING',
  ],
  [
    'duplicate facet',
    'packages/cli/src/lifecycle/integrations.ts',
    'c.facets.push({...c.facets[0]});',
    'HOST_CONTRACT_FACET_DUPLICATE',
  ],
  [
    'wrong owner',
    'packages/cli/src/lifecycle/integrations.ts',
    "c.facets[0].behavior='review.stop-option';",
    'HOST_CONTRACT_FACET_SOURCE_MISSING',
  ],
  [
    'unsupported guarantee',
    'packages/cli/src/lifecycle/integrations.ts',
    "PRODUCTION_INTEGRATIONS.find(row=>row.id==='codex').capabilities.continuationHooks=[];",
    'HOST_CONTRACT_FACET_DISPOSITION_INVALID',
  ],
  [
    'wrong selection',
    'packages/cli/src/lifecycle/integrations.ts',
    "c.event='PostToolUse';",
    'HOST_CONTRACT_COMPOSITION_SELECTION_INVALID',
  ],
  [
    'wrong execution',
    'packages/cli/src/lifecycle/integrations.ts',
    "c.execution='background';",
    'HOST_CONTRACT_COMPOSITION_SELECTION_INVALID',
  ],
  [
    'unexpected host bound',
    'packages/cli/codex-plugin/hooks.json',
    'bound',
    'HOST_CONTRACT_COMPOSITION_OPTIONS_INVALID',
  ],
  [
    'dispatcher bypass',
    'packages/cli/src/commands/codex-hook.ts',
    'bypass',
    'HOST_CONTRACT_FACET_SOURCE_MISSING',
  ],
  [
    'packaged call bypass',
    'packages/cli/templates/hooks/codex/stop.ts',
    'owner',
    'HOST_CONTRACT_FACET_SOURCE_MISSING',
  ],
] as const)(
  'rejects %s and restores through the public checker',
  (_name, relative, mutation, code) => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(root, relative),
      original = readFileSync(path, 'utf8');
    writeFileSync(path, mutatedSource(original, mutation));
    expect(report(root).findings).toContainEqual(
      expect.objectContaining({
        code,
        metadata: expect.objectContaining({ composition_id: 'codex.stop' }),
      }),
    );
    writeFileSync(path, original);
    expect(
      report(root).data.handler_facets.filter((row: Facet) => row.composition_id === 'codex.stop'),
    ).toHaveLength(4);
  },
);

function mutatedSource(original: string, mutation: string): string {
  switch (mutation) {
    case 'bound': {
      const manifest = JSON.parse(original);
      manifest.hooks.Stop[0].hooks[0].loop_limit = 1;
      return JSON.stringify(manifest);
    }
    case 'bypass': {
      return original.replace('stop: runStop,', 'stop: runSessionStart,');
    }
    case 'owner': {
      return original.replace(
        'evaluateSessionDoneEvidence(projectDirectory, runIdentity)',
        'undefined',
      );
    }
    default: {
      return `${original}\nconst c = PRODUCTION_INTEGRATIONS.find(row=>row.id==='codex')!.handlerCompositions!.find(row=>row.id==='codex.stop') as any;\n${mutation}\n`;
    }
  }
}
