import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { PRODUCTION_INTEGRATIONS } from '../../src/lifecycle/integrations.js';
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
  [
    'session.auto-upgrade',
    'hooks/lib/auto-upgrade.ts',
    'runAutoUpgrade',
    'sessionStart',
    'hooks/session-cursor-auto-upgrade.ts',
  ],
  [
    'feedback.lint',
    'hooks/lib/lint.ts',
    'lintFile',
    'afterFileEdit',
    'hooks/cursor/after-file-edit.ts',
  ],
] as const;
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
it('adopts both Cursor library entrypoints without assigning wrapper policy authority', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  expect(selected(current), 'CURSOR_LIBRARY_SHARED_ADOPTION_MISSING').toHaveLength(4);
  for (const [id, owner, entrypoint, event, delegate] of intended) {
    expect(current.data.behavior_bindings).toContainEqual(
      expect.objectContaining({ id, owner, entrypoint }),
    );
    const pair = selected(current, id);
    expect(
      pair
        .map((row: { source_family?: string }) => row.source_family ?? 'legacy')
        .toSorted((a: string, b: string) => a.localeCompare(b)),
    ).toEqual(['cursor-native', 'legacy']);
    for (const row of pair) {
      expect(row).toMatchObject({ owner, event, guarantees: ['observe'] });
      const actual = current.data.handler_inventory[row.registration_index];
      expect(actual).toMatchObject({ execution: 'synchronous', interpreter: 'bun' });
      expect(actual.matcher).toBeUndefined();
      expect(actual.condition).toBeUndefined();
      if (!row.source_family) expect(actual.command).toBe(`bun ./.safeword/${delegate}`);
    }
  }
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});
it('declares the supported Cursor local SessionStart surface as observation only', () => {
  const cursor = PRODUCTION_INTEGRATIONS.find(row => row.id === 'cursor');
  expect(cursor).toBeDefined();
  expect(
    cursor?.capabilities.lifecycle.session_start,
    'CURSOR_SESSION_START_CAPABILITY_MISMATCH',
  ).toBe('observe');
  expect(cursor?.capabilities.blockableHooks).not.toContain('session_start');
  expect(cursor?.capabilities.activation.availability).toBe('unavailable');
  expect(cursor?.capabilities.conformance.availability).toBe('unavailable');
});

it.each(intended)(
  'rejects %s shared call and import bypasses then repairs',
  (id, _owner, entrypoint, _event, adapter) => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(root, 'packages/cli/templates', adapter);
    const original = readFileSync(path, 'utf8');
    for (const changed of [
      original.replace(`await ${entrypoint}(`, `await Promise.resolve(`),
      original.replace(
        entrypoint === 'runAutoUpgrade' ? './lib/auto-upgrade.ts' : '../lib/lint.ts',
        './foreign.ts',
      ),
    ]) {
      writeFileSync(path, changed);
      const current = report(root);
      expect(selected(current, id)).toEqual([]);
      expect(current.findings).toContainEqual(
        expect.objectContaining({
          code: 'HOST_CONTRACT_BINDING_DELEGATION_MISSING',
          metadata: expect.objectContaining({ host: 'cursor', behavior_id: id }),
        }),
      );
    }
    writeFileSync(path, original);
    expect(selected(report(root), id)).toHaveLength(2);
  },
);

it.each(['type-only', 'hook-fallback'])('rejects a %s claim of the lint library owner', kind => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/templates/hooks/cursor/after-file-edit.ts');
  const original = readFileSync(path, 'utf8');
  const changed =
    kind === 'type-only'
      ? `${original.replace('import { lintFile }', 'import type { lintFile }')}\nasync function lintFile(..._args: unknown[]) {}\n`
      : [
          "import { runClaudeHook, translatePostOutput } from './gate-adapter.ts';",
          "import nodePath from 'node:path';",
          'const hookDirectory=import.meta.dirname;',
          "const claudeHookPath=nodePath.join(hookDirectory,'..','lint.ts');",
          'translatePostOutput(runClaudeHook({claudeHookPath}).stdout);',
        ].join('\n');
  writeFileSync(path, changed);
  const current = report(root);
  expect(selected(current, 'feedback.lint'), 'FALSE_LIBRARY_OWNER_ACCEPTED').toEqual([]);
  expect(current.findings).toContainEqual(
    expect.objectContaining({
      code: 'HOST_CONTRACT_BINDING_DELEGATION_MISSING',
      metadata: expect.objectContaining({ host: 'cursor', behavior_id: 'feedback.lint' }),
    }),
  );
  writeFileSync(path, original);
  expect(selected(report(root), 'feedback.lint')).toHaveLength(2);
});
it.each([
  ['event', 'CURSOR_HOOKS.postToolUse.push(...CURSOR_HOOKS.afterFileEdit.splice(0,1));'],
  ['matcher', "Object.assign(CURSOR_HOOKS.afterFileEdit[0],{matcher:'Read'});"],
  ['condition', "Object.assign(CURSOR_HOOKS.afterFileEdit[0],{if:'never'});"],
  ['execution', 'Object.assign(CURSOR_HOOKS.afterFileEdit[0],{async:true});'],
  ['command', "CURSOR_HOOKS.afterFileEdit[0].command='bun ./.safeword/hooks/prompt-timestamp.ts';"],
])('rejects lint %s registration drift and repairs both deliveries', (_kind, mutation) => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/templates/config.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, `${original}\n${mutation}\n`);
  const current = report(root);
  expect(selected(current, 'feedback.lint')).toEqual([]);
  expect(current.findings).toContainEqual(
    expect.objectContaining({
      code: 'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
      metadata: expect.objectContaining({ host: 'cursor', behavior_id: 'feedback.lint' }),
    }),
  );
  writeFileSync(path, original);
  expect(selected(report(root), 'feedback.lint')).toHaveLength(2);
});

it.each(intended)(
  'requires %s to export its declared shared entrypoint',
  (id, owner, entrypoint) => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(root, 'packages/cli/templates', owner);
    const original = readFileSync(path, 'utf8');
    writeFileSync(
      path,
      original.replace(`export async function ${entrypoint}`, () => `async function ${entrypoint}`),
    );
    expect(selected(report(root), id), 'UNEXPORTED_LIBRARY_OWNER_ACCEPTED').toEqual([]);
    writeFileSync(path, original);
    expect(selected(report(root), id)).toHaveLength(2);
  },
);
