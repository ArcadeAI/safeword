import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

// Independent intended owner/selection oracle; not obtained from the integration registry.
const intended = [
  ['dependencies.pre-tool', 'pre-tool-dependency-readiness.ts', 'Bash', undefined, 'reject_action'],
  [
    'config.approval-request',
    'pre-tool-config-guard.ts',
    'Edit|Write|MultiEdit|NotebookEdit',
    undefined,
    'observe',
  ],
  ['architecture.stage', 'pre-tool-architecture-stage.ts', 'Bash', 'Bash(git commit*)', 'observe'],
  ['git.stale-branch-warning', 'pre-tool-stale-main.ts', 'Bash', 'Bash(git checkout*)', 'observe'],
  ['git.stale-branch-warning', 'pre-tool-stale-main.ts', 'Bash', 'Bash(git switch*)', 'observe'],
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
function selected(current: ReturnType<typeof report>) {
  return current.data.behavior_adoptions.filter((row: { behavior_id: string }) =>
    intended.some(([id]) => id === row.behavior_id),
  );
}
it('adopts each intended pre-tool selection in both Claude deliveries', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  expect(selected(current), 'PRE_TOOL_SHARED_FAMILY_ADOPTION_MISSING').toHaveLength(10);
  for (const [id, owner, matcher, condition, guarantee] of intended)
    for (const family of ['legacy', 'claude-native']) {
      const matching = selected(current).filter(
        (row: { behavior_id: string; source_family?: string; registration_index: number }) => {
          const actual = current.data.handler_inventory[row.registration_index];
          return (
            row.behavior_id === id &&
            (row.source_family ?? 'legacy') === family &&
            actual.matcher === matcher &&
            actual.condition === condition
          );
        },
      );
      expect(matching).toHaveLength(1);
      expect(matching[0]).toMatchObject({
        owner: `hooks/${owner}`,
        event: 'PreToolUse',
        trigger: 'pre_tool',
        guarantees: [guarantee],
      });
      expect(current.data.handler_inventory[matching[0].registration_index]).toMatchObject({
        host: 'claude',
        event: 'PreToolUse',
        execution: 'synchronous',
        matcher,
      });
    }
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});

it.each([
  [
    'missing owner',
    'HOST_CONTRACT_BINDING_OWNER_MISSING',
    'binding',
    "SHARED_BEHAVIOR_BINDINGS.find(row => row.id === 'dependencies.pre-tool')!.owner = 'hooks/missing-owner.ts';",
    'dependencies.pre-tool',
    2,
  ],
  [
    'second owner',
    'HOST_CONTRACT_BINDING_OWNER_CONFLICT',
    'binding',
    "SHARED_BEHAVIOR_BINDINGS.push({...SHARED_BEHAVIOR_BINDINGS.find(row => row.id === 'dependencies.pre-tool')!});",
    'dependencies.pre-tool',
    2,
  ],
  [
    'matcher',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    'settings',
    "for (const group of SETTINGS_HOOKS.PreToolUse) if (group.hooks.some(hook => hook.command.includes('/pre-tool-config-guard.ts'))) group.matcher = 'Read';",
    'config.approval-request',
    2,
  ],
  [
    'checkout condition',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    'settings',
    "for (const group of SETTINGS_HOOKS.PreToolUse) for (const hook of group.hooks) if (hook.command.includes('/pre-tool-stale-main.ts') && hook.if === 'Bash(git checkout*)') hook.if = 'Bash(git reset*)';",
    'git.stale-branch-warning',
    4,
  ],
  [
    'switch removal',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    'settings',
    "for (const group of SETTINGS_HOOKS.PreToolUse) group.hooks = group.hooks.filter(hook => !(hook.command.includes('/pre-tool-stale-main.ts') && hook.if === 'Bash(git switch*)'));",
    'git.stale-branch-warning',
    4,
  ],
  [
    'background',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    'settings',
    "for (const group of SETTINGS_HOOKS.PreToolUse) for (const hook of group.hooks) if (hook.command.includes('/pre-tool-architecture-stage.ts')) hook.async = true;",
    'architecture.stage',
    2,
  ],
  [
    'rewake',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    'settings',
    "for (const group of SETTINGS_HOOKS.PreToolUse) for (const hook of group.hooks) if (hook.command.includes('/pre-tool-architecture-stage.ts')) hook.asyncRewake = true;",
    'architecture.stage',
    2,
  ],
  [
    'bypass',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    'settings',
    "for (const group of SETTINGS_HOOKS.PreToolUse) for (const hook of group.hooks) if (hook.command.includes('/pre-tool-dependency-readiness.ts')) hook.command = 'true';",
    'dependencies.pre-tool',
    2,
  ],
  [
    'event',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    'settings',
    "const index = SETTINGS_HOOKS.PreToolUse.findIndex(group => group.hooks.some(hook => hook.command.includes('/pre-tool-config-guard.ts'))); SETTINGS_HOOKS.PostToolUse.push(...SETTINGS_HOOKS.PreToolUse.splice(index, 1));",
    'config.approval-request',
    2,
  ],
  [
    'duplicate',
    'HOST_CONTRACT_BINDING_ADOPTION_DUPLICATE',
    'settings',
    "SETTINGS_HOOKS.PreToolUse.push(structuredClone(SETTINGS_HOOKS.PreToolUse.find(group => group.hooks.some(hook => hook.command.includes('/pre-tool-config-guard.ts')))!));",
    'config.approval-request',
    2,
  ],
])(
  'rejects pre-tool %s drift then restores adoption',
  (...[_name, code, target, mutation, id, count]) => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(
      root,
      target === 'binding'
        ? 'packages/cli/templates/hooks/lib/behavior-contract.ts'
        : 'packages/cli/src/templates/config.ts',
    );
    const original = readFileSync(path, 'utf8');
    writeFileSync(path, `${original}\n${mutation}\n`);
    const changed = report(root);
    expect(changed.findings).toContainEqual(
      expect.objectContaining({
        code,
        metadata: expect.objectContaining({ behavior_id: id }),
      }),
    );
    // A broken selection cannot be silently replaced by another registration.
    const rows = selected(changed).filter((row: { behavior_id: string }) => row.behavior_id === id);
    expect(rows.length).toBeLessThan(count);
    if (target === 'settings')
      for (const family of ['legacy', 'claude-native'])
        expect(changed.findings).toContainEqual(
          expect.objectContaining({
            code,
            metadata: expect.objectContaining({ behavior_id: id, source_family: family }),
          }),
        );
    writeFileSync(path, original);
    expect(
      selected(report(root)).filter((row: { behavior_id: string }) => row.behavior_id === id),
    ).toHaveLength(count);
  },
);

it('reports actual registrations orphaned by removing the explicit family routes', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}
const routes = PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.behaviorRoutes! as BehaviorRoute[];
for (let index = routes.length - 1; index >= 0; index--) if (routes[index]?.behavior === 'architecture.stage') routes.splice(index, 1);
`,
  );
  const changed = report(root);
  expect(changed.findings).toContainEqual(
    expect.objectContaining({
      code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
      metadata: expect.objectContaining({
        host: 'claude',
        event: 'PreToolUse',
        handler_path: 'hooks/pre-tool-architecture-stage.ts',
      }),
    }),
  );
  expect(
    selected(changed).filter(
      (row: { behavior_id: string }) => row.behavior_id === 'architecture.stage',
    ),
  ).toEqual([]);
  writeFileSync(path, original);
  expect(selected(report(root))).toHaveLength(10);
});
