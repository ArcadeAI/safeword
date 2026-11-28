import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

const intended = [
  [
    'prompt.timestamp',
    'prompt-timestamp.ts',
    'UserPromptSubmit',
    'prompt_submit',
    'observe',
    'synchronous',
  ],
  [
    'prompt.work-reminders',
    'prompt-questions.ts',
    'UserPromptSubmit',
    'prompt_submit',
    'observe',
    'synchronous',
  ],
  [
    'retrospective.filing-nudge',
    'prompt-retro-nudge.ts',
    'UserPromptSubmit',
    'prompt_submit',
    'observe',
    'synchronous',
  ],
  ['quality.stop', 'stop-quality.ts', 'Stop', 'stop', 'reject_action', 'synchronous'],
  ['session.reentry-capture', 'stop-reentry.ts', 'Stop', 'stop', 'observe', 'synchronous'],
  ['diagnostics.self-report', 'stop-self-report.ts', 'Stop', 'stop', 'observe', 'synchronous'],
  [
    'retrospective.filing',
    'stop-retro-filing.ts',
    'Stop',
    'stop',
    'bounded_continuation',
    'synchronous',
  ],
  ['retrospective.extract', 'stop-retro.ts', 'Stop', 'stop', 'observe', 'background'],
] as const; // Literal intended oracle, not obtained from the production registry.
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
  return current.data.behavior_adoptions.filter((row: { behavior_id: string }) =>
    id === undefined ? intended.some(([key]) => key === row.behavior_id) : id === row.behavior_id,
  );
}
it('adopts each intended prompt and Stop owner with its actual execution and guarantee', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  expect(rows(current), 'PROMPT_STOP_SHARED_FAMILY_ADOPTION_MISSING').toHaveLength(16);
  for (const [id, owner, event, trigger, guarantee, execution] of intended) {
    const pair = rows(current, id);
    expect(pair).toHaveLength(2);
    expect(
      pair
        .map((row: { source_family?: string }) => row.source_family ?? 'legacy')
        .toSorted((a: string, b: string) => a.localeCompare(b)),
    ).toEqual([event === 'Stop' ? 'claude-native' : 'claude-native-event-groups', 'legacy']);
    for (const row of pair) {
      expect(row).toMatchObject({
        owner: `hooks/${owner}`,
        event,
        trigger,
        guarantees: [guarantee],
      });
      const actual = current.data.handler_inventory[row.registration_index];
      expect(actual).toMatchObject({ event, execution });
      expect([actual.matcher, actual.condition]).toEqual([undefined, undefined]);
      expect(actual.command).toContain(`/${owner}`);
      expect(actual.configuration.hook.timeout).toBe(id === 'quality.stop' ? 2400 : undefined);
    }
  }
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});

it.each([
  [
    'event',
    'quality.stop',
    "const i = SETTINGS_HOOKS.Stop.findIndex(group => group.hooks.some(hook => hook.command.includes('/stop-quality.ts'))); SETTINGS_HOOKS.PreToolUse.push(...SETTINGS_HOOKS.Stop.splice(i, 1));",
  ],
  [
    'matcher',
    'prompt.timestamp',
    "for (const group of SETTINGS_HOOKS.UserPromptSubmit) if (group.hooks.some(hook => hook.command.includes('/prompt-timestamp.ts'))) Object.assign(group, {matcher:'never'});",
  ],
  [
    'condition',
    'prompt.work-reminders',
    "for (const group of SETTINGS_HOOKS.UserPromptSubmit) for (const hook of group.hooks) if (hook.command.includes('/prompt-questions.ts')) Object.assign(hook, {if:'Bash(never *)'});",
  ],
  [
    'background',
    'quality.stop',
    "for (const group of SETTINGS_HOOKS.Stop) for (const hook of group.hooks) if (hook.command.includes('/stop-quality.ts')) Object.assign(hook, {async:true});",
  ],
  [
    'extraction execution',
    'retrospective.extract',
    "for (const group of SETTINGS_HOOKS.Stop) for (const hook of group.hooks) if (hook.command.includes('/stop-retro.ts')) delete (hook as {async?:boolean}).async;",
  ],
  [
    'bypass',
    'retrospective.filing',
    "for (const group of SETTINGS_HOOKS.Stop) for (const hook of group.hooks) if (hook.command.includes('/stop-retro-filing.ts')) hook.command = 'true';",
  ],
])('rejects prompt/Stop %s drift and repairs the real registrations', (_kind, id, mutation) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/templates/config.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, `${original}\n${mutation}\n`);
  const changed = report(root);
  expect(rows(changed, id)).toEqual([]);
  expect(changed.findings).toContainEqual(
    expect.objectContaining({
      code: 'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
      metadata: expect.objectContaining({ behavior_id: id }),
    }),
  );
  writeFileSync(path, original);
  expect(rows(report(root), id)).toHaveLength(2);
});

it.each([
  [
    'missing owner',
    "SHARED_BEHAVIOR_BINDINGS.find(row => row.id === 'quality.stop')!.owner = 'hooks/missing-owner.ts';",
    'HOST_CONTRACT_BINDING_OWNER_MISSING',
  ],
  [
    'second owner',
    "SHARED_BEHAVIOR_BINDINGS.push({...SHARED_BEHAVIOR_BINDINGS.find(row => row.id === 'quality.stop')!});",
    'HOST_CONTRACT_BINDING_OWNER_CONFLICT',
  ],
])('rejects %s without accepting caller owner declarations', (_kind, mutation, code) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/templates/hooks/lib/behavior-contract.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, `${original}\n${mutation}\n`);
  expect(report(root).findings).toContainEqual(
    expect.objectContaining({
      code,
      metadata: expect.objectContaining({ behavior_id: 'quality.stop' }),
    }),
  );
  writeFileSync(path, original);
  expect(rows(report(root), 'quality.stop')).toHaveLength(2);
});
it('does not classify a retrospective registration by owner path after route removal', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\nconst routes = PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.behaviorRoutes! as BehaviorRoute[]; for (let i = routes.length - 1; i >= 0; i--) if (routes[i]?.behavior === 'retrospective.extract') routes.splice(i, 1);\n`,
  );
  const current = report(root);
  expect(rows(current, 'retrospective.extract')).toEqual([]);
  expect(current.findings).toContainEqual(
    expect.objectContaining({
      code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
      metadata: expect.objectContaining({ handler_path: 'hooks/stop-retro.ts' }),
    }),
  );
  writeFileSync(path, original);
  expect(rows(report(root), 'retrospective.extract')).toHaveLength(2);
});
