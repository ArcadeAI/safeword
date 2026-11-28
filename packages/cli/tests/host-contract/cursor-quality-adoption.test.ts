import { spawnSync } from 'node:child_process';
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
  const result = runContractRepoCheck(root);
  // The shared fixture helper validates state/exit pairs and rejects unavailable proof.
  return JSON.parse(result.output) as {
    findings: { code: string; metadata?: Record<string, unknown> }[];
    data: {
      behavior_adoptions: {
        behavior_id: string;
        host: string;
        owner: string;
        source_family?: string;
        event: string;
        registration_index: number;
      }[];
      handler_inventory: { command?: string }[];
      inventory_complete: boolean;
      admission_eligible: boolean;
    };
  };
}
function dispatchId(
  current: ReturnType<typeof report>,
  index: number | undefined,
): string | undefined {
  return index === undefined
    ? undefined
    : current.data.handler_inventory[index]?.command?.split(' ').at(-1);
}
const selected = (j: ReturnType<typeof report>) =>
  j.data.behavior_adoptions.filter(
    row => row.host === 'cursor' && row.behavior_id === 'quality.pre-tool',
  );
it.each(['pre-tool-quality.ts', 'before-shell-execution.ts'])(
  'adopts Cursor %s through the shared owner and rejects its bypass',
  adapter => {
    const root = createContractRepoFixture();
    roots.push(root);
    expect(selected(report(root)), 'CURSOR_QUALITY_SHARED_ADOPTION_MISSING').toHaveLength(4);
    const path = nodePath.join(root, 'packages/cli/templates/hooks/cursor', adapter),
      original = readFileSync(path, 'utf8');
    writeFileSync(
      path,
      `${original.replace(
        'runClaudeHook({',
        'fakeGate({',
      )}\nfunction fakeGate(_input: unknown) {return {failed:false,stdout:"",timedOut:false};}\n`,
    );
    const changed = report(root);
    expect(changed.findings, 'CURSOR_QUALITY_DELEGATION_BYPASS_ACCEPTED').toContainEqual(
      expect.objectContaining({
        code: 'HOST_CONTRACT_BINDING_DELEGATION_MISSING',
        metadata: expect.objectContaining({ behavior_id: 'quality.pre-tool', host: 'cursor' }),
      }),
    );
    expect(selected(changed)).toHaveLength(2);
    writeFileSync(path, original);
    expect(selected(report(root))).toHaveLength(4);
  },
);

it('rejects an omitted Cursor quality route and restores complete source accounting', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  expect(selected(report(root)), 'CURSOR_QUALITY_SHARED_ADOPTION_MISSING').toHaveLength(4);
  const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts'),
    original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${
      original
    }\nconst selectedCursor=PRODUCTION_INTEGRATIONS.find(row=>row.id==='cursor')!; const missingQuality=selectedCursor.behaviorRoutes!.findIndex(row=>row.behavior==='quality.pre-tool' && row.event==='preToolUse' && row.sourceFamily===undefined); if(missingQuality<0) throw new Error('Independent Cursor quality route fixture missing'); (selectedCursor.behaviorRoutes as unknown[]).splice(missingQuality,1);\n`,
  );
  const changed = report(root);
  expect(selected(changed)).toHaveLength(3);
  expect(changed.findings).toContainEqual(
    expect.objectContaining({
      code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
      metadata: expect.objectContaining({ host: 'cursor', event: 'preToolUse' }),
    }),
  );
  writeFileSync(path, original);
  const restored = report(root);
  expect(selected(restored)).toHaveLength(4);
  expect(restored.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});

it.each(['if', 'async', 'matcher'] as const)(
  'does not grant shell rejection adoption to a %s restricted registration',
  field => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(root, 'packages/cli/src/templates/config.ts'),
      original = readFileSync(path, 'utf8');
    writeFileSync(
      path,
      `${original}\n(CURSOR_HOOKS.beforeShellExecution[0] as unknown as Record<string,unknown>)[${JSON.stringify(field)}] = ${field === 'async' ? 'true' : "'never-matches'"};\n`,
    );
    expect(report(root).findings, 'CURSOR_RESTRICTED_GUARD_ADOPTION_ACCEPTED').toContainEqual(
      expect.objectContaining({
        code: 'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
        metadata: expect.objectContaining({
          behavior_id: 'quality.pre-tool',
          host: 'cursor',
          event: 'beforeShellExecution',
        }),
      }),
    );
    writeFileSync(path, original);
    expect(
      report(root).data.behavior_adoptions.filter(
        row => row.host === 'cursor' && row.behavior_id === 'quality.pre-tool',
      ),
    ).toHaveLength(4);
  },
);

it.each(['insert', 'replace'] as const)(
  'never attributes native quality to a foreign %s binding',
  mutation => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(root, 'packages/cli/src/templates/config.ts'),
      original = readFileSync(path, 'utf8');
    const foreign = "{command:'bun ./.safeword/hooks/session-cleanup-quality.ts'}";
    const change =
      mutation === 'insert'
        ? `CURSOR_HOOKS.beforeShellExecution.unshift(${foreign});`
        : `CURSOR_HOOKS.beforeShellExecution.splice(0,1,${foreign});`;
    writeFileSync(path, `${original}\n${change}\n`);
    const changed = report(root);
    const bindings = spawnSync(
      'bun',
      [
        '--eval',
        "import {cursorPluginBindings} from './packages/cli/src/cursor-plugin/bindings.ts';console.log(JSON.stringify(cursorPluginBindings()));",
      ],
      { cwd: root, encoding: 'utf8', timeout: 30_000 },
    );
    expect(bindings.status, `CURSOR_BINDING_ORACLE_UNAVAILABLE: ${bindings.stderr}`).toBe(0);
    const actual = JSON.parse(bindings.stdout) as { id: string; path: string }[];
    expect(actual.find(row => row.id === 'beforeShellExecution:0')?.path).toBe(
      'session-cleanup-quality.ts',
    );
    const native = changed.data.behavior_adoptions.filter(
      row =>
        row.host === 'cursor' &&
        row.behavior_id === 'quality.pre-tool' &&
        row.source_family === 'cursor-native',
    );
    for (const row of native) {
      const id = dispatchId(changed, row.registration_index);
      expect(
        actual.find(binding => binding.id === id)?.path,
        'CURSOR_NATIVE_QUALITY_WRONG_BINDING_ADOPTED',
      ).toBe(
        row.event === 'preToolUse'
          ? 'cursor/pre-tool-quality.ts'
          : 'cursor/before-shell-execution.ts',
      );
    }
    if (mutation === 'replace') {
      expect(native.filter(row => row.event === 'beforeShellExecution')).toEqual([]);
      expect(changed.findings).toContainEqual(
        expect.objectContaining({
          code: 'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
          metadata: expect.objectContaining({
            host: 'cursor',
            source_family: 'cursor-native',
            event: 'beforeShellExecution',
            behavior_id: 'quality.pre-tool',
          }),
        }),
      );
    } else {
      const shell = native.filter(row => row.event === 'beforeShellExecution');
      expect(shell).toHaveLength(1);
      expect(dispatchId(changed, shell[0]?.registration_index)).toBe('beforeShellExecution:1');
      expect(changed.findings).toContainEqual(
        expect.objectContaining({
          code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
          metadata: expect.objectContaining({
            host: 'cursor',
            source_family: 'cursor-native',
            event: 'beforeShellExecution',
          }),
        }),
      );
    }
    writeFileSync(path, original);
    expect(
      report(root).data.behavior_adoptions.filter(
        row => row.host === 'cursor' && row.behavior_id === 'quality.pre-tool',
      ),
    ).toHaveLength(4);
  },
);
