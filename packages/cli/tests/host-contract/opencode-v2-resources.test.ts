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
it.each([
  [
    'inserted foreign transform',
    'packages/opencode-v2-plugin/src/index.ts',
    'const initial = await context.skill.transform(apply);',
    'await context.skill.transform(() => {});\nconst initial = await context.skill.transform(apply);',
    'HOST_CONTRACT_RESOURCE_SELECTION_INVALID',
  ],
  [
    'owner',
    'packages/cli/src/lifecycle/integrations.ts',
    "owner: 'packages/cli/src/host-contract/catalogue.ts'",
    "owner: 'packages/cli/src/host-contract/workers.ts'",
    'HOST_CONTRACT_RESOURCE_PROVENANCE_MISSING',
  ],
  [
    'event',
    'packages/cli/src/lifecycle/integrations.ts',
    "['v2.commands', 'command.transform'",
    "['v2.commands', 'session.context'",
    'HOST_CONTRACT_RESOURCE_SELECTION_INVALID',
  ],
  [
    'duplicate',
    'packages/cli/src/lifecycle/integrations.ts',
    "['v2.commands', 'command.transform', 'registerCommands', 0],",
    "['v2.commands', 'command.transform', 'registerCommands', 0],\n['v2.commands', 'command.transform', 'registerCommands', 0],",
    'HOST_CONTRACT_RESOURCE_SELECTION_INVALID',
  ],
  [
    'source family',
    'packages/cli/src/lifecycle/integrations.ts',
    "sourceFamily: 'opencode-v2'",
    "sourceFamily: 'foreign-sdk'",
    'HOST_CONTRACT_RESOURCE_SELECTION_INVALID',
  ],
  [
    'resource output',
    'packages/opencode-v2-plugin/src/index.ts',
    'readPackagedText(layout.commands)',
    'readPackagedText(layout.workers)',
    'HOST_CONTRACT_RESOURCE_PROVENANCE_MISSING',
  ],
  [
    'forwarding bypass',
    'packages/opencode-v2-plugin/src/index.ts',
    'await context.session.prompt({',
    'await Promise.resolve({',
    'HOST_CONTRACT_RESOURCE_SELECTION_INVALID',
  ],
] as const)('rejects %s and restores exact accounting', (_name, path, from, to, code) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const file = nodePath.join(root, path),
    original = readFileSync(file, 'utf8');
  expect(original).toContain(from);
  writeFileSync(
    file,
    original.replace(from, () => to),
  );
  expect(report(root).findings).toContainEqual(expect.objectContaining({ code }));
  writeFileSync(file, original);
  expect(report(root).data.callback_resources?.map(row => row.id)).toEqual(expected);
});
it('keeps a removed resource disposition visibly unclassified', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const file = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts'),
    original = readFileSync(file, 'utf8');
  const row = "    ['v2.commands', 'command.transform', 'registerCommands', 0],";
  expect(original).toContain(row);
  writeFileSync(file, original.replace(row, ''));
  expect(report(root).findings).toContainEqual(
    expect.objectContaining({
      code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
      metadata: expect.objectContaining({
        host: 'opencode',
        event: 'command.transform',
        source_family: 'opencode-v2',
      }),
    }),
  );
  writeFileSync(file, original);
  expect(report(root).data.callback_resources?.map(item => item.id)).toEqual(expected);
});
function report(root: string) {
  const result = runContractRepoCheck(root);
  return JSON.parse(result.output) as {
    findings: { code: string; metadata?: { id?: string } }[];
    data: {
      callback_resources?: {
        id: string;
        owner: string;
        producer: string;
        registration_index: number;
      }[];
      inventory_complete: boolean;
      admission_eligible: boolean;
    };
  };
}
const expected = ['v2.skills.initial', 'v2.skills.refresh', 'v2.skills.prompt', 'v2.commands'];
it('accounts the four actual V2 resource registrations with canonical catalogue provenance', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  expect(
    current.data.callback_resources?.map(row => row.id),
    'V2_RESOURCE_ACCOUNTING_MISSING',
  ).toEqual(expected);
  expect(current.data.callback_resources?.map(row => row.owner)).toEqual(
    Array.from({ length: 4 }, () => 'packages/cli/src/host-contract/catalogue.ts'),
  );
  expect(
    current.data.callback_resources?.map(row => row.producer),
    'ACTUAL_RESOURCE_WRITER_MISSING',
  ).toEqual([
    'packages/cli/src/host-contract/portable-core.ts',
    'packages/cli/src/host-contract/portable-core.ts',
    'packages/cli/src/host-contract/portable-core.ts',
    'packages/cli/scripts/generate-opencode-v2-plugin.ts',
  ]);
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});
