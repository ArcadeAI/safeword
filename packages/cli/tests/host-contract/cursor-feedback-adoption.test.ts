import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

const intended = [
  ['session.standing-context', 'hooks/session-safeword-context.ts', 'sessionStart', undefined],
  ['feedback.quality', 'hooks/post-tool-quality.ts', 'postToolUse', 'Write|Shell'],
  ['feedback.language-skill', 'hooks/post-tool-skill-nudge.ts', 'postToolUse', 'Write'],
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
function selected(current: ReturnType<typeof report>, id?: string) {
  return current.data.behavior_adoptions.filter(
    (row: { host: string; behavior_id: string }) =>
      row.host === 'cursor' &&
      (id ? row.behavior_id === id : intended.some(([key]) => row.behavior_id === key)),
  );
}
function projectRows(current: ReturnType<typeof report>, event: string) {
  return current.data.handler_inventory.filter(
    (entry: { host: string; event: string; source_family?: string }) =>
      entry.host === 'cursor' && entry.event === event && entry.source_family === undefined,
  );
}
it('reports a real delegate registration orphaned by removing its explicit route', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\nconst routes=PRODUCTION_INTEGRATIONS.find(row=>row.id==='cursor')!.behaviorRoutes! as BehaviorRoute[]; for(let i=routes.length-1;i>=0;i--) if(routes[i]?.behavior==='feedback.quality') routes.splice(i,1);\n`,
  );
  const current = report(root);
  expect(selected(current, 'feedback.quality')).toEqual([]);
  expect(current.findings).toContainEqual(
    expect.objectContaining({
      code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
      metadata: expect.objectContaining({
        host: 'cursor',
        handler_path: 'hooks/cursor/post-tool-quality.ts',
      }),
    }),
  );
  writeFileSync(path, original);
  expect(selected(report(root))).toHaveLength(6);
});
it('adopts actual Cursor standing-context and canonical post-tool delegates in both deliveries', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  expect(selected(current), 'CURSOR_FEEDBACK_SHARED_ADOPTION_MISSING').toHaveLength(6);
  for (const [id, owner, event, matcher] of intended) {
    const adapter = event === 'sessionStart' ? owner : owner.replace('hooks/', 'hooks/cursor/');
    const expected = `bun ./.safeword/${adapter}${event === 'sessionStart' ? ' --agent=cursor' : ''}`;
    const rows = selected(current, id);
    expect(
      rows
        .map((row: { source_family?: string }) => row.source_family ?? 'legacy')
        .toSorted((a: string, b: string) => a.localeCompare(b)),
    ).toEqual(['cursor-native', 'legacy']);
    for (const row of rows) {
      expect(row).toMatchObject({
        owner,
        event,
        trigger: event === 'sessionStart' ? 'session_start' : 'post_tool',
        guarantees: ['observe'],
      });
      const actual = current.data.handler_inventory[row.registration_index];
      expect(actual.execution).toBe('synchronous');
      expect(actual.matcher).toBe(matcher);
      expect(actual.condition).toBeUndefined();

      if (row.source_family === undefined) expect(actual.command).toBe(expected);
      else {
        const index = Number(actual.command.split(':').at(-1));
        expect(projectRows(current, event)[index].command).toBe(expected);
      }
    }
  }
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});

it.each(['post-tool-quality.ts', 'post-tool-skill-nudge.ts'])(
  'rejects an actual %s delegation bypass and restores both deliveries',
  adapter => {
    const root = createContractRepoFixture();
    roots.push(root);
    const id = adapter === 'post-tool-quality.ts' ? 'feedback.quality' : 'feedback.language-skill';
    const path = nodePath.join(root, 'packages/cli/templates/hooks/cursor', adapter);
    const original = readFileSync(path, 'utf8');
    writeFileSync(
      path,
      `${original.replace(
        'runClaudeHook({',
        'fakeHook({',
      )}\nfunction fakeHook(_input: unknown) {return {stdout:""};}\n`,
    );
    const current = report(root);
    expect(selected(current, id)).toEqual([]);
    expect(current.findings).toContainEqual(
      expect.objectContaining({
        code: 'HOST_CONTRACT_BINDING_DELEGATION_MISSING',
        metadata: expect.objectContaining({ host: 'cursor', behavior_id: id }),
      }),
    );
    writeFileSync(path, original);
    expect(selected(report(root), id)).toHaveLength(2);
  },
);
it.each([
  [
    'arguments',
    'session.standing-context',
    "CURSOR_HOOKS.sessionStart[0].command = CURSOR_HOOKS.sessionStart[0].command.replace('--agent=cursor','--agent=claude');",
  ],
  [
    'event',
    'session.standing-context',
    'CURSOR_HOOKS.stop.push(...CURSOR_HOOKS.sessionStart.splice(0,1));',
  ],
  ['matcher', 'feedback.quality', "CURSOR_HOOKS.postToolUse[0].matcher = 'Read';"],
  ['condition', 'feedback.quality', "Object.assign(CURSOR_HOOKS.postToolUse[0],{if:'never'});"],
  [
    'execution',
    'feedback.language-skill',
    'Object.assign(CURSOR_HOOKS.postToolUse[1],{async:true});',
  ],
])('rejects Cursor %s drift then repairs the actual selected rows', (_kind, id, mutation) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/templates/config.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, `${original}\n${mutation}\n`);
  const current = report(root);
  expect(selected(current, id)).toEqual([]);
  expect(current.findings).toContainEqual(
    expect.objectContaining({
      code: 'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
      metadata: expect.objectContaining({ host: 'cursor', behavior_id: id }),
    }),
  );
  writeFileSync(path, original);
  expect(selected(report(root), id)).toHaveLength(2);
});
it('follows the real delegate after native index movement rather than a foreign first binding', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/templates/config.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\nCURSOR_HOOKS.postToolUse.unshift({command:'bun ./.safeword/hooks/prompt-timestamp.ts',matcher:'Write|Shell'});\n`,
  );
  const current = report(root);
  const native = selected(current, 'feedback.quality').find(
    (row: { source_family?: string }) => row.source_family === 'cursor-native',
  );
  expect(current.data.handler_inventory[native.registration_index].command).toMatch(
    /postToolUse:1$/u,
  );
  const legacy = current.data.handler_inventory.filter(
    (row: { host: string; event: string; source_family?: string }) =>
      row.host === 'cursor' && row.event === 'postToolUse' && row.source_family === undefined,
  );
  expect(legacy[1].command).toBe('bun ./.safeword/hooks/cursor/post-tool-quality.ts');
  writeFileSync(path, original);
  expect(selected(report(root))).toHaveLength(6);
});
