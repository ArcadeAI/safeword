import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

// Literal intended policy/selection oracle, independent of the production registry.
const intended = [
  ['session.runtime-readiness', 'session-bun-check.sh', 'synchronous', undefined, 'bash', ''],
  ['session.dependencies', 'session-dependency-readiness.ts', 'synchronous', undefined, 'bun', ''],
  ['session.auto-upgrade', 'session-auto-upgrade.ts', 'async-rewake', undefined, 'bun', ''],
  [
    'session.standing-context',
    'session-safeword-context.ts',
    'synchronous',
    undefined,
    'bun',
    ' --agent=claude',
  ],
  [
    'session.reply-format',
    'session-reply-format.ts',
    'synchronous',
    undefined,
    'bun',
    ' --agent=claude',
  ],
  ['session.version-advice', 'session-version.ts', 'synchronous', undefined, 'bun', ''],
  ['session.lint-advice', 'session-lint-check.ts', 'synchronous', undefined, 'bun', ''],
  [
    'session.architecture-heal',
    'session-architecture-heal.ts',
    'synchronous',
    undefined,
    'bun',
    '',
  ],
  ['session.author-model', 'session-author-model.ts', 'synchronous', undefined, 'bun', ''],
  ['session.reentry-context', 'session-start-reentry.ts', 'synchronous', undefined, 'bun', ''],
  ['session.compact-context', 'session-compact-context.ts', 'synchronous', 'compact', 'bun', ''],
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
function rows(current: ReturnType<typeof report>, id?: string) {
  return current.data.behavior_adoptions.filter(
    (row: { host: string; behavior_id: string }) =>
      row.host === 'claude' &&
      (id === undefined
        ? intended.some(([key]) => row.behavior_id === key)
        : row.behavior_id === id),
  );
}
it('adopts actual SessionStart owners with exact delivery, transport, arguments and selection', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  expect(rows(current), 'SESSION_START_SHARED_FAMILY_ADOPTION_MISSING').toHaveLength(21);
  for (const [id, owner, execution, matcher, interpreter, suffix] of intended) {
    const adopted = rows(current, id);
    const families =
      id === 'session.auto-upgrade' ? ['legacy'] : ['legacy', 'claude-native-event-groups'];
    expect(
      adopted
        .map((row: { source_family?: string }) => row.source_family ?? 'legacy')
        .toSorted((a: string, b: string) => a.localeCompare(b)),
    ).toEqual(families.toSorted((a, b) => a.localeCompare(b)));
    for (const row of adopted) {
      expect(row).toMatchObject({
        owner: id === 'session.auto-upgrade' ? 'hooks/lib/auto-upgrade.ts' : `hooks/${owner}`,
        event: 'SessionStart',
        trigger: 'session_start',
        guarantees: ['observe'],
      });
      const actual = current.data.handler_inventory[row.registration_index];
      expect(actual).toMatchObject({ execution, interpreter, event: 'SessionStart' });
      expect(actual.matcher).toBe(matcher);
      expect(actual.condition).toBeUndefined();
      const prefix =
        row.source_family === undefined
          ? '"$CLAUDE_PROJECT_DIR"/.safeword/hooks/'
          : '"${CLAUDE_PLUGIN_ROOT}"/runtime/hooks/';
      expect(actual.command).toBe(`${interpreter} ${prefix}${owner}${suffix}`);
    }
  }
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});

it.each([
  [
    'transport',
    'session.runtime-readiness',
    "hook.command = hook.command.replace('bash ', 'bun ');",
  ],
  [
    'arguments',
    'session.standing-context',
    "hook.command = hook.command.replace(' --agent=claude', '');",
  ],
  ['condition', 'session.reply-format', "hook.if = 'Bash(never *)';"],
  ['execution', 'session.author-model', 'hook.async = true;'],
  ['rewake', 'session.auto-upgrade', 'delete hook.asyncRewake;'],
  ['bypass', 'session.version-advice', "hook.command = 'true';"],
])('rejects actual session %s drift and restores exact adoption', (_name, id, edit) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/templates/config.ts');
  const original = readFileSync(path, 'utf8');
  const owner = intended.find(([key]) => key === id)?.[1];
  assert.ok(owner);
  writeFileSync(
    path,
    `${original}\nfor (const group of SETTINGS_HOOKS.SessionStart) for (const hook of group.hooks) if (hook.command.includes('/${owner}')) { ${edit} }\n`,
  );
  const changed = report(root);
  expect(rows(changed, id)).toEqual([]);
  expect(changed.findings).toContainEqual(
    expect.objectContaining({
      code: 'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
      metadata: expect.objectContaining({ behavior_id: id }),
    }),
  );
  writeFileSync(path, original);
  expect(rows(report(root), id)).toHaveLength(id === 'session.auto-upgrade' ? 1 : 2);
});
it.each([
  ['matcher', "group.matcher = 'startup';"],
  ['duplicate', 'SETTINGS_HOOKS.SessionStart.push(structuredClone(group));'],
  [
    'event',
    'SETTINGS_HOOKS.SessionStart.splice(SETTINGS_HOOKS.SessionStart.indexOf(group), 1); SETTINGS_HOOKS.UserPromptSubmit.push(group);',
  ],
])('rejects compact %s drift without adopting a different selection', (kind, edit) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/templates/config.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\nconst group = SETTINGS_HOOKS.SessionStart.find(row => row.hooks.some(hook => hook.command.includes('/session-compact-context.ts')))!; ${edit}\n`,
  );
  const current = report(root);
  expect(rows(current, 'session.compact-context')).toEqual([]);
  expect(current.findings).toContainEqual(
    expect.objectContaining({
      code:
        kind === 'duplicate'
          ? 'HOST_CONTRACT_BINDING_ADOPTION_DUPLICATE'
          : 'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
      metadata: expect.objectContaining({ behavior_id: 'session.compact-context' }),
    }),
  );
  writeFileSync(path, original);
  expect(rows(report(root), 'session.compact-context')).toHaveLength(2);
});
it('requires an explicit auto-upgrade route instead of path-membership fallback', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\nconst routes = PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.behaviorRoutes! as BehaviorRoute[]; for (let i = routes.length - 1; i >= 0; i--) if (routes[i]?.behavior === 'session.auto-upgrade') routes.splice(i, 1);\n`,
  );
  const current = report(root);
  expect(rows(current, 'session.auto-upgrade')).toEqual([]);
  expect(current.findings).toContainEqual(
    expect.objectContaining({
      code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
      metadata: expect.objectContaining({ handler_path: 'hooks/session-auto-upgrade.ts' }),
    }),
  );
  writeFileSync(path, original);
  expect(rows(report(root), 'session.auto-upgrade')).toHaveLength(1);
});
