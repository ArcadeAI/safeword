import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

const roots: string[] = [];
const behavior = 'quality.pre-tool';
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
      inventory_complete: boolean;
      admission_eligible: boolean;
      behavior_adoptions: {
        behavior_id: string;
        host: string;
        owner: string;
        source_family?: string;
        registration_index: number;
        trigger: string;
        guarantees: string[];
      }[];
    };
  };
}
it('adopts both actual quality matchers in legacy and native Claude without counting translations as owners', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  const adopted = current.data.behavior_adoptions.filter(
    row => row.behavior_id === behavior && row.host === 'claude',
  );
  expect(adopted, 'QUALITY_SHARED_OWNER_ADOPTION_MISSING').toHaveLength(4);
  expect(new Set(adopted.map(row => row.registration_index)).size).toBe(4);
  expect(
    adopted
      .map(row => row.source_family ?? 'legacy')
      .toSorted((left, right) => left.localeCompare(right)),
  ).toEqual(['claude-native', 'claude-native', 'legacy', 'legacy']);
  for (const row of adopted)
    expect(row).toMatchObject({
      owner: 'hooks/pre-tool-quality.ts',
      trigger: 'pre_tool',
      guarantees: ['reject_action'],
    });
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});

it('detects and restores a bypassed Claude quality matcher', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const path = nodePath.join(root, 'packages/cli/src/templates/config.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\nfor (const group of SETTINGS_HOOKS.PreToolUse.filter(row => row.matcher === 'Bash'))\nfor (const hook of group.hooks) if (hook.command.includes('/pre-tool-quality.ts')) hook.command = 'true';\n`,
  );
  const changed = report(root);
  for (const family of ['legacy', 'claude-native'])
    expect(changed.findings).toContainEqual(
      expect.objectContaining({
        code: 'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
        metadata: expect.objectContaining({ behavior_id: behavior, source_family: family }),
      }),
    );
  expect(
    changed.data.behavior_adoptions.filter(
      row => row.behavior_id === behavior && row.host === 'claude',
    ),
  ).toHaveLength(2);
  writeFileSync(path, original);
  expect(
    report(root).data.behavior_adoptions.filter(
      row => row.behavior_id === behavior && row.host === 'claude',
    ),
  ).toHaveLength(4);
});

it.each([
  [
    'missing route',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    `const routes = PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.behaviorRoutes!;
   (routes as unknown[]).splice(routes.findIndex(row => row.behavior === 'quality.pre-tool' && row.matcher === 'Bash' && !row.sourceFamily), 1);`,
    'packages/cli/src/lifecycle/integrations.ts',
  ],
  [
    'wrong matcher',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    `for (const group of SETTINGS_HOOKS.PreToolUse) if (group.matcher === 'Bash' && group.hooks.some(hook => hook.command.includes('/pre-tool-quality.ts'))) group.matcher = 'Read';`,
    'packages/cli/src/templates/config.ts',
  ],
  [
    'conditional bypass',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    `for (const group of SETTINGS_HOOKS.PreToolUse) for (const hook of group.hooks) if (group.matcher === 'Bash' && hook.command.includes('/pre-tool-quality.ts')) hook.if = 'Bash(never *)';`,
    'packages/cli/src/templates/config.ts',
  ],
  [
    'duplicate actual registration',
    'HOST_CONTRACT_BINDING_ADOPTION_DUPLICATE',
    `SETTINGS_HOOKS.PreToolUse.push(structuredClone(SETTINGS_HOOKS.PreToolUse.find(group => group.matcher === 'Bash' && group.hooks.some(hook => hook.command.includes('/pre-tool-quality.ts')))!));`,
    'packages/cli/src/templates/config.ts',
  ],
] as const)(
  'rejects quality %s and restores the same real checker',
  (name, code, mutation, relative) => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(root, relative),
      original = readFileSync(path, 'utf8');
    writeFileSync(path, `${original}\n${mutation}\n`);
    const changed = report(root);
    if (name === 'missing route') {
      expect(changed.findings).toContainEqual(
        expect.objectContaining({
          code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
          metadata: expect.objectContaining({
            host: 'claude',
            event: 'PreToolUse',
            handler_path: 'hooks/pre-tool-quality.ts',
          }),
        }),
      );
      expect(
        changed.data.behavior_adoptions.filter(
          row => row.behavior_id === behavior && row.host === 'claude',
        ),
      ).toHaveLength(3);
    } else {
      expect(changed.findings).toContainEqual(
        expect.objectContaining({
          code,
          metadata: expect.objectContaining({
            behavior_id: behavior,
            source_family: 'legacy',
            ...(name === 'duplicate actual registration' && { matching_count: 2 }),
          }),
        }),
      );
    }
    writeFileSync(path, original);
    const repaired = report(root);
    expect(repaired.findings.filter(row => row.metadata?.behavior_id === behavior)).toEqual([]);
    expect(
      repaired.data.behavior_adoptions.filter(
        row => row.behavior_id === behavior && row.host === 'claude',
      ),
    ).toHaveLength(4);
  },
);
