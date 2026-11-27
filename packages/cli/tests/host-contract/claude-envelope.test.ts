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
  const current = JSON.parse(runContractRepoCheck(root).output) as {
    findings: { code: string }[];
    data: {
      handler_envelopes?: {
        id: string;
        event: string;
        child_indices: number[];
        local_policy_scopes: string[];
      }[];
      handler_inventory: { command?: string }[];
      inventory_complete: boolean;
      admission_eligible: boolean;
    };
  };
  // Keep this independent oracle scoped to its three Claude registrations.
  current.data.handler_envelopes = current.data.handler_envelopes?.filter(row =>
    row.id.startsWith('claude.'),
  );
  return current;
}
const ids = ['claude.startup-envelope', 'claude.prompt-envelope', 'claude.setup-envelope'];
it('accounts exact Claude envelopes without inheriting their child guarantees', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  expect(
    current.data.handler_envelopes?.map(row => [row.id, row.event]),
    'CLAUDE_ENVELOPE_ACCOUNTING_MISSING',
  ).toEqual([
    ['claude.startup-envelope', 'SessionStart'],
    ['claude.prompt-envelope', 'UserPromptSubmit'],
    ['claude.setup-envelope', 'Setup'],
  ]);
  expect(current.data.handler_envelopes?.map(row => row.child_indices.length)).toEqual([9, 3, 0]);
  expect(
    current.data.handler_envelopes?.[1]?.child_indices.map(
      index => current.data.handler_inventory[index]?.command,
    ),
  ).toEqual([
    'bun "${CLAUDE_PLUGIN_ROOT}"/runtime/hooks/prompt-timestamp.ts',
    'bun "${CLAUDE_PLUGIN_ROOT}"/runtime/hooks/prompt-questions.ts',
    'bun "${CLAUDE_PLUGIN_ROOT}"/runtime/hooks/prompt-retro-nudge.ts',
  ]);
  expect(current.data.handler_envelopes?.[1]?.local_policy_scopes).toContain(
    'automaticMigrationUnsafe',
  );
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});

it.each([
  [
    'outer command',
    'packages/cli/src/claude-plugin/hook-manifest.ts',
    'command: pluginEventGroupCommand(event)',
    "command: pluginEventGroupCommand('Stop')",
    'HOST_CONTRACT_ENVELOPE_SELECTION_INVALID',
  ],
  [
    'setup matcher',
    'packages/cli/src/claude-plugin/hook-manifest.ts',
    "matcher: 'init'",
    "matcher: 'resume'",
    'HOST_CONTRACT_ENVELOPE_SELECTION_INVALID',
  ],
  [
    'outer execution',
    'packages/cli/src/claude-plugin/hook-manifest.ts',
    'command: pluginEventGroupCommand(event),',
    'command: pluginEventGroupCommand(event), async: true,',
    'HOST_CONTRACT_ENVELOPE_SELECTION_INVALID',
  ],
  [
    'child missing',
    'packages/cli/src/claude-plugin/hook-manifest.ts',
    '(adapted[event] ?? [])',
    '[]',
    'HOST_CONTRACT_ENVELOPE_CHILD_UNACCOUNTED',
  ],
  [
    'extra unowned child',
    'packages/cli/src/claude-plugin/hook-manifest.ts',
    '(adapted[event] ?? [])',
    "[...(Array.isArray(adapted[event]) ? adapted[event] : []), { hooks: [{ type: 'command', command: 'true' }] }]",
    'HOST_CONTRACT_ENVELOPE_CHILD_UNACCOUNTED',
  ],
  [
    'direct bypass',
    'packages/cli/src/claude-plugin/runtime/dispatch.ts',
    'execution: executeConfiguredHooks(input)',
    "execution: { status: 0, stdout: '' }",
    'HOST_CONTRACT_ENVELOPE_PROVENANCE_MISSING',
  ],
  [
    'argument drift',
    'packages/cli/src/claude-plugin/runtime/dispatch.ts',
    'verifyPlugin(event, pluginRoot)',
    "verifyPlugin('Setup', pluginRoot)",
    'HOST_CONTRACT_ENVELOPE_PROVENANCE_MISSING',
  ],
  [
    'canonical owner removal',
    'packages/cli/src/claude-plugin/runtime/dispatch.ts',
    'migrateClaudeLegacyAutomatically }',
    'migrateClaudeLegacyAutomatically as removedOwner }',
    'HOST_CONTRACT_ENVELOPE_PROVENANCE_MISSING',
  ],
  [
    'local policy omission',
    'packages/cli/src/lifecycle/integrations.ts',
    "['viableLegacyAuthority', 'automaticMigrationUnsafe']",
    "['viableLegacyAuthority']",
    'HOST_CONTRACT_ENVELOPE_PROVENANCE_MISSING',
  ],
])('rejects %s and restores the exact relation', (_name, path, before, after, code) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const target = nodePath.join(root, path),
    original = readFileSync(target, 'utf8');
  expect(original).toContain(before);
  writeFileSync(
    target,
    original.replace(before, () => after),
  );
  const broken = report(root);
  expect(broken.findings.map(row => row.code)).toContain(code);
  expect(broken.data.handler_envelopes?.length).toBeLessThan(ids.length);
  writeFileSync(target, original);
  expect(report(root).data.handler_envelopes?.map(row => row.id)).toEqual(ids);
});

it('rejects duplicate envelope assignment without inflating accounting', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const target = nodePath.join(root, 'packages/cli/scripts/check-host-contract.ts');
  const original = readFileSync(target, 'utf8');
  const before = '(adapter.handlerEnvelopes ?? []).map';
  expect(original).toContain(before);
  writeFileSync(
    target,
    original.replace(
      before,
      '[...(adapter.handlerEnvelopes ?? []), ...(adapter.handlerEnvelopes ?? [])].map',
    ),
  );
  const broken = report(root);
  expect(
    broken.findings.filter(row => row.code === 'HOST_CONTRACT_ENVELOPE_SELECTION_INVALID'),
  ).toHaveLength(3);
  expect(broken.data.handler_envelopes?.map(row => row.id)).toEqual(ids);
  writeFileSync(target, original);
  expect(report(root).findings.map(row => row.code)).not.toContain(
    'HOST_CONTRACT_ENVELOPE_SELECTION_INVALID',
  );
});
