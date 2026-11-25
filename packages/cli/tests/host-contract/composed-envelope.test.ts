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
const intended = [
  ['codex.session-context', 'SessionStart'],
  ['codex.post-context', 'PostToolUse'],
  ['codex.prompt-context', 'UserPromptSubmit'],
  ['codex.stop', 'Stop'],
];
function report(root: string) {
  return JSON.parse(runContractRepoCheck(root).output);
}
it('joins four Codex composed outer registrations without upgrading their facets', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  const rows = current.data.handler_envelopes.filter((row: { composition_id?: string }) =>
    row.composition_id?.startsWith('codex.'),
  );
  expect(
    rows.map((row: { composition_id: string; event: string }) => [row.composition_id, row.event]),
    'COMPOSED_OUTER_ACCOUNTING_MISSING',
  ).toEqual(intended);
  expect(current.data.handler_facets).toHaveLength(22);
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
  expect(rows.map((row: { facet_behaviors: string[] }) => row.facet_behaviors.length)).toEqual([
    1, 3, 2, 4,
  ]);
  for (const row of rows)
    expect(
      current.data.behavior_adoptions.some(
        (adoption: { registration_index: number }) =>
          adoption.registration_index === row.registration_index,
      ),
    ).toBe(false);
});

it.each([
  [
    'wrong owner',
    'packages/cli/src/lifecycle/integrations.ts',
    "owner: 'packages/cli/src/commands/codex-hook.ts'",
    "owner: 'foreign.ts'",
    'HOST_CONTRACT_ENVELOPE_PROVENANCE_MISSING',
  ],
  [
    'missing facet',
    'packages/cli/src/lifecycle/integrations.ts',
    '        primaryBehavior,',
    '',
    'HOST_CONTRACT_ENVELOPE_CHILD_UNACCOUNTED',
  ],
  [
    'queue argument',
    'packages/cli/src/commands/codex-hook.ts',
    'readProjectTextFile(projectDirectory, PROMPT_CONTEXT_PATH)',
    'readProjectTextFile(projectDirectory, STOP_CONTINUATION_PATH)',
    'HOST_CONTRACT_ENVELOPE_PROVENANCE_MISSING',
  ],
  [
    'native authority argument',
    'packages/cli/src/commands/codex-hook.ts',
    'requireNativeProject(input, normalized)',
    "requireNativeProject(input, 'stop')",
    'HOST_CONTRACT_ENVELOPE_PROVENANCE_MISSING',
  ],
  [
    'runner bypass',
    'packages/cli/src/commands/codex-hook.ts',
    'await CODEX_HOOK_RUNNERS[normalized](projectDirectory)',
    'await Promise.resolve()',
    'HOST_CONTRACT_ENVELOPE_PROVENANCE_MISSING',
  ],
  [
    'Stop extraction bypass',
    'packages/cli/templates/hooks/codex/stop.ts',
    'runRetroExtraction(projectDirectory, input);',
    ';',
    'HOST_CONTRACT_ENVELOPE_PROVENANCE_MISSING',
  ],
  [
    'scope omission',
    'packages/cli/src/lifecycle/integrations.ts',
    "          'runStop',\n",
    '',
    'HOST_CONTRACT_ENVELOPE_PROVENANCE_MISSING',
  ],
  [
    'classified local policy omission',
    'packages/cli/src/lifecycle/integrations.ts',
    "          'classifyPackagedStopOutput',\n",
    '',
    'HOST_CONTRACT_ENVELOPE_PROVENANCE_MISSING',
  ],
])(
  'rejects %s through the public checker and restores it',
  (_name, relative, before, after, code) => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(root, relative),
      original = readFileSync(path, 'utf8');
    expect(original).toContain(before);
    writeFileSync(
      path,
      original.replace(before, () => after),
    );
    const broken = report(root);
    expect(broken.findings.map((row: { code: string }) => row.code)).toContain(code);
    expect(
      broken.data.handler_envelopes.filter((row: { composition_id?: string }) =>
        row.composition_id?.startsWith('codex.'),
      ).length,
    ).toBeLessThan(4);
    writeFileSync(path, original);
    expect(
      report(root).data.handler_envelopes.filter((row: { composition_id?: string }) =>
        row.composition_id?.startsWith('codex.'),
      ),
    ).toHaveLength(4);
  },
);

it('rejects a second composition instead of treating it as an envelope exception', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts'),
    original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\nconst c=PRODUCTION_INTEGRATIONS.find(row=>row.id==='codex')!; (c.handlerCompositions as any).push({...c.handlerCompositions![0], id:'competing'});\n`,
  );
  expect(report(root).findings.map((row: { code: string }) => row.code)).toContain(
    'HOST_CONTRACT_COMPOSITION_SELECTION_INVALID',
  );
  writeFileSync(path, original);
  expect(
    report(root).data.handler_envelopes.filter((row: { composition_id?: string }) =>
      row.composition_id?.startsWith('codex.'),
    ),
  ).toHaveLength(4);
});
