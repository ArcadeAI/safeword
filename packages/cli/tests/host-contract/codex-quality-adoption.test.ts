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
      behavior_adoptions: { host: string; behavior_id: string; owner: string }[];
      inventory_complete: boolean;
      admission_eligible: boolean;
    };
  };
}
function selected(j: ReturnType<typeof report>) {
  return j.data.behavior_adoptions.filter(
    row => row.host === 'codex' && row.behavior_id === 'quality.pre-tool',
  );
}
it('adopts the actual native Codex quality chain', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  expect(selected(report(root)), 'CODEX_SHARED_QUALITY_ADOPTION_MISSING').toEqual([
    expect.objectContaining({ owner: 'hooks/pre-tool-quality.ts' }),
  ]);
});
it('rejects a delegated-call bypass and verifies the repaired Codex quality chain', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/templates/hooks/codex/pre-tool-quality.ts'),
    original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original.replace(
      'runClaudeHookAsCodex(claudeHookPath, translated)',
      'fakeGate(claudeHookPath, translated)',
    )}\nfunction fakeGate(..._args:unknown[]) {return {stdout:""};}\n`,
  );
  const modified = report(root);
  expect(modified.findings).toContainEqual(
    expect.objectContaining({
      code: 'HOST_CONTRACT_BINDING_DELEGATION_MISSING',
      metadata: expect.objectContaining({ host: 'codex', behavior_id: 'quality.pre-tool' }),
    }),
  );
  expect(selected(modified)).toEqual([]);
  writeFileSync(path, original);
  expect(selected(report(root))).toHaveLength(1);
});
it.each([
  [
    'runner',
    'packages/cli/src/commands/codex-hook.ts',
    "'pre-tool-use': runPreToolUse,",
    "'pre-tool-use': runPostToolUse,",
    'HOST_CONTRACT_BINDING_DELEGATION_MISSING',
  ],
  [
    'snapshot target',
    'packages/cli/src/commands/codex-hook.ts',
    "const PRE_TOOL_QUALITY_HOOK_PATH = 'codex/pre-tool-quality.ts';",
    "const PRE_TOOL_QUALITY_HOOK_PATH = 'codex/stop.ts';",
    'HOST_CONTRACT_BINDING_DELEGATION_MISSING',
  ],
  [
    'command',
    'packages/cli/codex-plugin/hooks.json',
    'hook codex pre-tool-use --plugin-hook',
    'hook codex post-tool-use --plugin-hook',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
  ],
] as const)(
  'rejects Codex %s bypass and repairs through same checker',
  (_name, relative, from, to, code) => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(root, relative),
      original = readFileSync(path, 'utf8');
    expect(original).toContain(from);
    writeFileSync(
      path,
      original.replace(from, () => to),
    );
    expect(report(root).findings).toContainEqual(
      expect.objectContaining({
        code,
        metadata: expect.objectContaining({ host: 'codex', behavior_id: 'quality.pre-tool' }),
      }),
    );
    writeFileSync(path, original);
    const repaired = report(root);
    expect(
      repaired.data.behavior_adoptions.filter(
        row => row.host === 'codex' && row.behavior_id === 'quality.pre-tool',
      ),
    ).toHaveLength(1);
    expect(repaired.data).toMatchObject({
      inventory_complete: true,
      admission_eligible: false,
    });
  },
);

it.each(['matcher', 'if', 'async'] as const)(
  'excludes a restricted native Codex %s registration',
  field => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(root, 'packages/cli/codex-plugin/hooks.json'),
      original = readFileSync(path, 'utf8');
    const manifest = JSON.parse(original);
    const group = manifest.hooks.PreToolUse[0];
    if (field === 'matcher') group.matcher = 'never-matches';
    else group.hooks[0][field] = field === 'async' ? true : 'Bash(never *)';
    writeFileSync(path, JSON.stringify(manifest));
    expect(report(root).findings).toContainEqual(
      expect.objectContaining({
        code: 'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
        metadata: expect.objectContaining({ host: 'codex', behavior_id: 'quality.pre-tool' }),
      }),
    );
    writeFileSync(path, original);
    expect(
      report(root).data.behavior_adoptions.filter(
        row => row.host === 'codex' && row.behavior_id === 'quality.pre-tool',
      ),
    ).toHaveLength(1);
  },
);
