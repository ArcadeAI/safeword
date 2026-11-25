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
      inventory_complete: boolean;
      admission_eligible: boolean;
      behavior_adoptions: {
        host: string;
        behavior_id: string;
        source_family?: string;
        registration_index: number;
      }[];
      handler_inventory: { event: string; handler_path: string; source_family?: string }[];
    };
  };
}
function selected(current: ReturnType<typeof report>, family: string) {
  return current.data.behavior_adoptions.filter(
    row =>
      row.host === 'opencode' &&
      row.behavior_id === 'quality.pre-tool' &&
      row.source_family === family,
  );
}
it('adopts exactly the V2 SDK registration independently of V1', () => {
  const root = createContractRepoFixture();
  roots.push(root);
  const current = report(root);
  expect(
    selected(current, 'opencode-v2'),
    'OPENCODE_V2_SHARED_QUALITY_ADOPTION_MISSING',
  ).toHaveLength(1);
  expect(
    current.data.handler_inventory[selected(current, 'opencode-v2')[0]?.registration_index ?? -1],
  ).toMatchObject({
    event: 'tool.execute.before',
    source_family: 'opencode-v2',
    handler_path: 'packages/opencode-v2-plugin/src/index.ts',
  });
  expect(selected(current, 'opencode-v1')).toHaveLength(0);
  expect(current.data).toMatchObject({ inventory_complete: true, admission_eligible: false });
});
it.each([
  [
    'callback bypass',
    'await dispatch(project, {',
    'await Promise.resolve({',
    'HOST_CONTRACT_BINDING_DELEGATION_MISSING',
  ],
  [
    'dispatcher target',
    '[nodePath.join(packageRoot, layout.dispatcher)]',
    '[nodePath.join(packageRoot, layout.runtime)]',
    'HOST_CONTRACT_BINDING_DELEGATION_MISSING',
  ],
  [
    'event translation',
    "hook_event_name: 'PreToolUse'",
    "hook_event_name: 'PostToolUse'",
    'HOST_CONTRACT_BINDING_DELEGATION_MISSING',
  ],
  [
    'codec owner bypass',
    '../../cli/src/opencode/tool-codec.js',
    '../../cli/src/opencode/foreign-codec.js',
    'HOST_CONTRACT_BINDING_DELEGATION_MISSING',
  ],
  [
    'codec protocol inverse',
    "normalizeOpenCodeTool('v2', tool, input)",
    "normalizeOpenCodeTool('v1', tool, input)",
    'HOST_CONTRACT_BINDING_DELEGATION_MISSING',
  ],
  [
    'registration removal',
    "context.tool.hook('execute.before'",
    "context.tool.hook('execute.after'",
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
  ],
] as const)(
  'rejects V2 %s even with healthy V1 and restores the same checker',
  (_name, from, to, code) => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(root, 'packages/opencode-v2-plugin/src/index.ts'),
      original = readFileSync(path, 'utf8');
    expect(original).toContain(from);
    writeFileSync(
      path,
      original.replace(from, () => to),
    );
    const changed = report(root);
    expect(changed.findings, 'OPENCODE_V2_BYPASS_UNDETECTED').toContainEqual(
      expect.objectContaining({
        code,
        metadata: expect.objectContaining({
          host: 'opencode',
          behavior_id: 'quality.pre-tool',
          source_family: 'opencode-v2',
        }),
      }),
    );
    expect(selected(changed, 'opencode-v2')).toHaveLength(0);
    expect(selected(changed, 'opencode-v1')).toHaveLength(0);
    writeFileSync(path, original);
    expect(selected(report(root), 'opencode-v2')).toHaveLength(1);
  },
);
