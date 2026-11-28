import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

const roots: string[] = [];
const intended = [
  ['feedback.lint', 'hooks/lib/lint.ts', 'Edit|Write|MultiEdit|NotebookEdit'],
  ['feedback.quality', 'hooks/post-tool-quality.ts', 'Edit|Write|MultiEdit|NotebookEdit|Bash'],
  [
    'feedback.language-skill',
    'hooks/post-tool-skill-nudge.ts',
    'Edit|Write|MultiEdit|NotebookEdit',
  ],
  [
    'feedback.bypass-warning',
    'hooks/post-tool-bypass-warn.ts',
    'Edit|Write|MultiEdit|NotebookEdit',
  ],
  ['learning.index-sync', 'hooks/post-tool-sync-learnings.ts', 'Edit|Write|MultiEdit|NotebookEdit'],
  ['ticket.phase-work-log', 'hooks/post-tool-work-log.ts', 'Edit|Write|MultiEdit|NotebookEdit'],
  ['dependencies.install-stamp', 'hooks/post-tool-dependency-readiness.ts', 'Bash'],
];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(nodePath.dirname(root), { recursive: true, force: true });
});
function report(root: string) {
  const result = runContractRepoCheck(root);
  // The shared fixture helper validates state/exit pairs and rejects unavailable proof.
  return JSON.parse(result.output);
}
it('adopts the seven intended post-tool owners in both Claude deliveries', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  const rows = current.data.behavior_adoptions.filter(
    (row: { host: string; behavior_id: string }) =>
      row.host === 'claude' && intended.some(([id]) => id === row.behavior_id),
  );
  expect(rows, 'POST_TOOL_SHARED_FAMILY_ADOPTION_MISSING').toHaveLength(14);
  for (const [id, owner, matcher] of intended) {
    const pair = rows.filter((row: { behavior_id: string }) => row.behavior_id === id);
    expect(pair).toHaveLength(2);
    expect(
      pair
        .map((row: { source_family?: string }) => row.source_family ?? 'legacy')
        .toSorted((left: string, right: string) => left.localeCompare(right)),
    ).toEqual(['claude-native', 'legacy']);
    for (const row of pair) {
      expect(row).toMatchObject({
        owner,
        event: 'PostToolUse',
        trigger: 'post_tool',
        guarantees: ['observe'],
      });
      const actual = current.data.handler_inventory[row.registration_index];
      expect(actual).toMatchObject({
        host: 'claude',
        event: 'PostToolUse',
        matcher,
        execution: 'synchronous',
      });
      expect(actual.condition).toBeUndefined();
    }
  }
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});

it.each([
  ['background', 'hook.async = true;'],
  ['rewake', 'hook.asyncRewake = true;'],
])('rejects a changed %s execution mode through both actual registrations', (_name, edit) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/templates/config.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\nfor (const group of SETTINGS_HOOKS.PostToolUse) for (const hook of group.hooks) if (hook.command.includes('/post-tool-work-log.ts')) { ${edit} }\n`,
  );
  const changed = report(root);
  const adopted = changed.data.behavior_adoptions.filter(
    (row: { behavior_id: string }) => row.behavior_id === 'ticket.phase-work-log',
  );
  expect(adopted, 'POST_TOOL_EXECUTION_DRIFT_ACCEPTED').toEqual([]);
  for (const family of ['legacy', 'claude-native'])
    expect(changed.findings).toContainEqual(
      expect.objectContaining({
        code: 'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
        metadata: expect.objectContaining({
          behavior_id: 'ticket.phase-work-log',
          source_family: family,
        }),
      }),
    );
  writeFileSync(path, original);
  expect(
    report(root).data.behavior_adoptions.filter(
      (row: { behavior_id: string }) => row.behavior_id === 'ticket.phase-work-log',
    ),
  ).toHaveLength(2);
});

it.each([
  [
    'matcher',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    "for (const group of SETTINGS_HOOKS.PostToolUse) if (group.hooks.some(hook => hook.command.includes('/post-tool-work-log.ts'))) group.matcher = 'Read';",
  ],
  [
    'condition',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    "for (const group of SETTINGS_HOOKS.PostToolUse) for (const hook of group.hooks) if (hook.command.includes('/post-tool-work-log.ts')) hook.if = 'Bash(never *)';",
  ],
  [
    'command bypass',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    "for (const group of SETTINGS_HOOKS.PostToolUse) for (const hook of group.hooks) if (hook.command.includes('/post-tool-work-log.ts')) hook.command = 'true';",
  ],
  [
    'event',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    "const group = SETTINGS_HOOKS.PostToolUse.find(group => group.hooks.some(hook => hook.command.includes('/post-tool-work-log.ts')))!; SETTINGS_HOOKS.PostToolUse.splice(SETTINGS_HOOKS.PostToolUse.indexOf(group), 1); SETTINGS_HOOKS.PreToolUse.push(group);",
  ],
  [
    'duplicate',
    'HOST_CONTRACT_BINDING_ADOPTION_DUPLICATE',
    "SETTINGS_HOOKS.PostToolUse.push(structuredClone(SETTINGS_HOOKS.PostToolUse.find(group => group.hooks.some(hook => hook.command.includes('/post-tool-work-log.ts')))!));",
  ],
])('rejects post-tool %s drift and repairs both deliveries', (_name, code, mutation) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/templates/config.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, `${original}\n${mutation}\n`);
  const changed = report(root);
  for (const family of ['legacy', 'claude-native'])
    expect(changed.findings).toContainEqual(
      expect.objectContaining({
        code,
        metadata: expect.objectContaining({
          behavior_id: 'ticket.phase-work-log',
          source_family: family,
        }),
      }),
    );
  expect(
    changed.data.behavior_adoptions.filter(
      (row: { behavior_id: string }) => row.behavior_id === 'ticket.phase-work-log',
    ),
  ).toEqual([]);
  writeFileSync(path, original);
  expect(
    report(root).data.behavior_adoptions.filter(
      (row: { behavior_id: string }) => row.behavior_id === 'ticket.phase-work-log',
    ),
  ).toHaveLength(2);
});

it.each([
  [
    'missing owner',
    'HOST_CONTRACT_BINDING_OWNER_MISSING',
    "SHARED_BEHAVIOR_BINDINGS.find(row => row.id === 'ticket.phase-work-log')!.owner = 'hooks/missing-owner.ts';",
  ],
  [
    'second owner',
    'HOST_CONTRACT_BINDING_OWNER_CONFLICT',
    "SHARED_BEHAVIOR_BINDINGS.push({...SHARED_BEHAVIOR_BINDINGS.find(row => row.id === 'ticket.phase-work-log')!});",
  ],
])('rejects %s through the same required check', (_name, code, mutation) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/templates/hooks/lib/behavior-contract.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, `${original}\n${mutation}\n`);
  const changed = report(root);
  expect(changed.findings).toContainEqual(
    expect.objectContaining({
      code,
      metadata: expect.objectContaining({ behavior_id: 'ticket.phase-work-log' }),
    }),
  );
  writeFileSync(path, original);
  expect(
    report(root).data.behavior_adoptions.filter(
      (row: { behavior_id: string }) => row.behavior_id === 'ticket.phase-work-log',
    ),
  ).toHaveLength(2);
});

it('names an orphaned owner registration when its declared routes are removed', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}
const selected = PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.behaviorRoutes! as BehaviorRoute[];
for (let index = selected.length - 1; index >= 0; index--) if (selected[index]?.behavior === 'ticket.phase-work-log') selected.splice(index, 1);
`,
  );
  const changed = report(root);
  expect(changed.findings).toContainEqual(
    expect.objectContaining({
      code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
      metadata: expect.objectContaining({
        host: 'claude',
        event: 'PostToolUse',
        handler_path: 'hooks/post-tool-work-log.ts',
      }),
    }),
  );
  expect(
    changed.data.behavior_adoptions.filter(
      (row: { behavior_id: string }) => row.behavior_id === 'ticket.phase-work-log',
    ),
  ).toEqual([]);
  writeFileSync(path, original);
  expect(
    report(root).data.behavior_adoptions.filter(
      (row: { behavior_id: string }) => row.behavior_id === 'ticket.phase-work-log',
    ),
  ).toHaveLength(2);
});
