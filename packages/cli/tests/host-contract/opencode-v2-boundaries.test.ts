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
  return JSON.parse(runContractRepoCheck(root).output) as {
    findings: { code: string }[];
    data: {
      callback_boundaries?: { id: string; disposition: string; owner: string }[];
      inventory_complete: boolean;
      admission_eligible: boolean;
    };
  };
}
const ids = ['v2.enrollment', 'v2.ticket.observation', 'v2.worker.prompt', 'v2.worker.context'];
it.each([
  [
    'inserted prompt',
    'packages/opencode-v2-plugin/src/index.ts',
    'const sessions = new Map<string, ReadonlySet<string>>();',
    "const sessions = new Map<string, ReadonlySet<string>>();\nawait context.session.hook('prompt', () => {});",
    { id: 'v2.worker.prompt', code: 'HOST_CONTRACT_RESOURCE_SELECTION_INVALID' },
  ],
  [
    'header owner',
    'packages/opencode-v2-plugin/src/index.ts',
    "import { workerInvocationHeader } from '../../cli/src/host-contract/workers.js';",
    "import { workerInvocationHeader } from '../../cli/src/opencode/names.js';",
    { id: 'v2.worker.prompt', code: 'HOST_CONTRACT_RESOURCE_PROVENANCE_MISSING' },
  ],
  [
    'enrollment owner',
    'packages/cli/src/lifecycle/integrations.ts',
    "owner: 'packages/cli/src/opencode/v2-enrollment.ts'",
    "owner: 'packages/cli/src/opencode/v2-profile.ts'",
    { id: 'v2.enrollment', code: 'HOST_CONTRACT_RESOURCE_PROVENANCE_MISSING' },
  ],
  [
    'duplicate identity',
    'packages/cli/src/lifecycle/integrations.ts',
    "id: 'v2.enrollment'",
    "id: 'v2.worker.prompt'",
    { id: 'v2.worker.prompt', code: 'HOST_CONTRACT_RESOURCE_SELECTION_INVALID' },
  ],
  [
    'scope',
    'packages/cli/src/lifecycle/integrations.ts',
    "scope: 'setup'",
    "scope: 'registerSkills'",
    { id: 'v2.enrollment', code: 'HOST_CONTRACT_RESOURCE_SELECTION_INVALID' },
  ],
  [
    'event',
    'packages/opencode-v2-plugin/src/index.ts',
    "context.session.hook('context',",
    "context.session.hook('title',",
    { id: 'v2.worker.context', code: 'HOST_CONTRACT_RESOURCE_SELECTION_INVALID' },
  ],
  [
    'producer',
    'packages/cli/src/lifecycle/integrations.ts',
    "producer: 'packages/cli/scripts/generate-opencode-v2-plugin.ts'",
    "producer: 'packages/cli/src/host-contract/portable-core.ts'",
    { id: 'v2.worker.prompt', code: 'HOST_CONTRACT_RESOURCE_PROVENANCE_MISSING' },
  ],
  [
    'argument',
    'packages/opencode-v2-plugin/src/index.ts',
    'Reflect.deleteProperty(event.tools, tool)',
    'Reflect.deleteProperty(event.options, tool)',
    { id: 'v2.worker.context', code: 'HOST_CONTRACT_RESOURCE_PROVENANCE_MISSING' },
  ],
  [
    'child condition',
    'packages/opencode-v2-plugin/src/index.ts',
    'session.parentID !== undefined && mask !== undefined',
    'session.parentID === undefined && mask !== undefined',
    { id: 'v2.worker.prompt', code: 'HOST_CONTRACT_RESOURCE_PROVENANCE_MISSING' },
  ],
  [
    'enrollment inversion',
    'packages/opencode-v2-plugin/src/index.ts',
    '!readOpenCodeV2Enrollment(profile, project, packageRoot, layout)',
    'readOpenCodeV2Enrollment(profile, project, packageRoot, layout)',
    { id: 'v2.enrollment', code: 'HOST_CONTRACT_RESOURCE_PROVENANCE_MISSING' },
  ],
] as const)(
  'rejects %s then repairs through the public checker',
  (_name, path, from, to, { id, code }) => {
    const root = createContractRepoFixture();
    roots.push(root);
    const file = nodePath.join(root, path),
      original = readFileSync(file, 'utf8');
    expect(report(root).findings).toEqual([]);
    expect(original).toContain(from);
    writeFileSync(
      file,
      original.replace(from, () => to),
    );
    expect(report(root).findings).toContainEqual(
      expect.objectContaining({ code, metadata: { id, host: 'opencode' } }),
    );
    writeFileSync(file, original);
    const repaired = report(root);
    expect(repaired.findings).toEqual([]);
    expect(repaired.data.callback_boundaries?.map(row => row.id)).toEqual(ids);
  },
);
it('accounts for enrollment, ticket observation and both worker callbacks with their owners', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  expect(
    current.data.callback_boundaries?.map(row => [row.id, row.disposition, row.owner]),
    'V2_BOUNDARY_ACCOUNTING_MISSING',
  ).toEqual([
    ['v2.enrollment', 'enrollment', 'packages/cli/src/opencode/v2-enrollment.ts'],
    ['v2.ticket.observation', 'host_policy', 'packages/cli/src/opencode/observe-ticket.ts'],
    ['v2.worker.prompt', 'host_policy', 'packages/cli/src/host-contract/workers.ts'],
    ['v2.worker.context', 'host_policy', 'packages/cli/src/host-contract/workers.ts'],
  ]);
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});
