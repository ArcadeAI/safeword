import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

const roots: string[] = [];
const binding = 'session.quality-state-cleanup';
const bindingPath = 'packages/cli/templates/hooks/lib/behavior-contract.ts';
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(nodePath.dirname(root), { recursive: true, force: true });
});
function fixture(): string {
  const root = createContractRepoFixture();
  roots.push(root);
  return root;
}
function report(root: string) {
  const result = runContractRepoCheck(root);
  // The shared fixture helper validates state/exit pairs and rejects unavailable proof.
  return JSON.parse(result.output.trim()) as {
    findings: { code: string; metadata?: Record<string, unknown> }[];
    data: {
      inventory_complete: boolean;
      admission_eligible: boolean;
      handler_inventory: { configuration: unknown }[];
      behavior_adoptions: {
        behavior_id: string;
        owner: string;
        source_family?: string;
        guarantees: string[];
        trigger: string;
        registration_index: number;
      }[];
    };
  };
}
it('rejects a shared binding trigger that disagrees with its actual SessionEnd routes', () => {
  const root = fixture();
  const path = nodePath.join(root, bindingPath);
  const original = readFileSync(path, 'utf8');
  expect(original).toContain(`id: '${binding}'`);
  expect(original).toContain("trigger: 'session_end'");
  writeFileSync(path, original.replace("trigger: 'session_end'", "trigger: 'pre_tool'"));
  const changed = report(root);
  expect(changed.findings, 'SHARED_BINDING_TRIGGER_MISMATCH_UNDETECTED').toContainEqual(
    expect.objectContaining({
      code: 'HOST_CONTRACT_BINDING_TRIGGER_MISMATCH',
      metadata: expect.objectContaining({ behavior_id: binding }),
    }),
  );
  writeFileSync(path, original);
  expect(
    report(root).findings.some(row => row.code === 'HOST_CONTRACT_BINDING_TRIGGER_MISMATCH'),
  ).toBe(false);
});

it('does not classify a selected legacy registration after its explicit route is removed', () => {
  const root = fixture();
  const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts');
  const original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\n(PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.behaviorRoutes as unknown[]).splice(0, 1);\n`,
  );
  const changed = report(root);
  expect(changed.findings, 'MISSING_EXPLICIT_ROUTE_ACCEPTED').toContainEqual(
    expect.objectContaining({
      code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
      metadata: expect.objectContaining({
        host: 'claude',
        event: 'SessionEnd',
        handler_path: 'hooks/session-cleanup-quality.ts',
      }),
    }),
  );
  writeFileSync(path, original);
  expect(
    report(root).findings.filter(
      row =>
        row.code === 'UNCLASSIFIED_HOST_CONTRACT_HANDLER' &&
        row.metadata?.handler_path === 'hooks/session-cleanup-quality.ts',
    ),
  ).toEqual([]);
});

it('reports cleanup adoption while a deliberately omitted route remains unclassified', () => {
  const root = fixture();
  const path = nodePath.join(root, integrationsPath);
  const original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}
const routes = PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.behaviorRoutes!;
const omitted = routes.findIndex(row => row.behavior === 'quality.stop' && !row.sourceFamily);
if (omitted >= 0) (routes as unknown[]).splice(omitted, 1);
`,
  );
  const current = report(root);
  expect(current.data).toMatchObject({ inventory_complete: false, admission_eligible: false });
  const cleanup = current.data.behavior_adoptions.filter(row => row.behavior_id === binding);
  expect(cleanup).toHaveLength(2);
  expect(cleanup.map(row => row.source_family ?? 'legacy')).toEqual(['legacy', 'claude-native']);
  expect(new Set(cleanup.map(row => row.registration_index)).size).toBe(2);
  for (const row of cleanup)
    expect(row).toMatchObject({
      behavior_id: binding,
      owner: 'hooks/session-cleanup-quality.ts',
      trigger: 'session_end',
      guarantees: ['observe'],
    });
  expect(current.findings).toContainEqual(
    expect.objectContaining({
      code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
      metadata: expect.objectContaining({ handler_path: 'hooks/stop-quality.ts' }),
    }),
  );
  writeFileSync(path, original);
  expect(
    report(root).findings.filter(
      row =>
        row.code === 'UNCLASSIFIED_HOST_CONTRACT_HANDLER' &&
        row.metadata?.handler_path === 'hooks/stop-quality.ts',
    ),
  ).toEqual([]);
});
it.each([
  [
    'second owner',
    bindingPath,
    'HOST_CONTRACT_BINDING_OWNER_CONFLICT',
    (source: string) =>
      `${source}\nSHARED_BEHAVIOR_BINDINGS.push({...SHARED_BEHAVIOR_BINDINGS[0]!,owner:'hooks/stop-retro.ts'});\n`,
  ],
  [
    'missing owner',
    'packages/cli/templates/hooks/session-cleanup-quality.ts',
    'HOST_CONTRACT_BINDING_OWNER_MISSING',
    () => {},
  ],
  [
    'stronger guarantee',
    bindingPath,
    'HOST_CONTRACT_BINDING_GUARANTEE_MISMATCH',
    (source: string) => source.replace("guarantees: ['observe']", "guarantees: ['reject_action']"),
  ],
  [
    'bypassed command',
    'packages/cli/src/templates/config.ts',
    'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
    (source: string) => `${source}\nSETTINGS_HOOKS.SessionEnd[0]!.hooks[0]!.command = 'true';\n`,
  ],
  [
    'duplicate registration',
    'packages/cli/src/templates/config.ts',
    'HOST_CONTRACT_BINDING_ADOPTION_DUPLICATE',
    (source: string) =>
      `${source}\nSETTINGS_HOOKS.SessionEnd.push(structuredClone(SETTINGS_HOOKS.SessionEnd[0]!));\n`,
  ],
] as const)(
  'rejects %s through the actual checker and clears only after restoration',
  (_name, relative, code, mutate) => {
    const root = fixture(),
      path = nodePath.join(root, relative),
      original = readFileSync(path, 'utf8');
    const changed = mutate(original);
    if (changed === undefined) rmSync(path);
    else writeFileSync(path, changed);
    const findings = report(root).findings;
    expect(findings).toContainEqual(
      expect.objectContaining({
        code,
        metadata: expect.objectContaining({ behavior_id: binding }),
      }),
    );
    if (_name === 'duplicate registration')
      expect(findings).toContainEqual(
        expect.objectContaining({ code, metadata: expect.objectContaining({ matching_count: 2 }) }),
      );
    writeFileSync(path, original);
    expect(report(root).findings.filter(row => row.metadata?.behavior_id === binding)).toEqual([]);
  },
);

const integrationsPath = 'packages/cli/src/lifecycle/integrations.ts';
it.each([
  [
    'actual event inverse',
    'HOST_CONTRACT_BINDING_TRIGGER_MISMATCH',
    `const route = PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.behaviorRoutes![0]!;
     (route as {event:string}).event = 'Stop';
     SETTINGS_HOOKS.Stop.push({hooks:[{type:'command',command:route.command('hooks/session-cleanup-quality.ts')}]});`,
  ],
  [
    'native event inverse',
    'HOST_CONTRACT_BINDING_TRIGGER_MISMATCH',
    `const route = PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.behaviorRoutes![1]!;
     (route as {event:string}).event = 'Stop';
     (route as {command:(owner:string)=>string}).command = owner => pluginHookCommand('Stop',projectHookCommand(owner));
     SETTINGS_HOOKS.Stop.push({hooks:[{type:'command',command:projectHookCommand('hooks/session-cleanup-quality.ts')}]});`,
  ],
  [
    'duplicate route',
    'HOST_CONTRACT_BINDING_ADOPTION_DUPLICATE',
    `const routes = PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.behaviorRoutes!;
     (routes as unknown[]).push({...routes[0]!});`,
  ],
  [
    'repeated guarantee on both sides',
    'HOST_CONTRACT_BINDING_GUARANTEE_MISMATCH',
    `for (const route of PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.behaviorRoutes!.filter(row => row.behavior === 'session.quality-state-cleanup'))
       (route as {guarantees:string[]}).guarantees = ['observe','observe'];`,
  ],
  [
    'non-set guarantee comparison',
    'HOST_CONTRACT_BINDING_GUARANTEE_MISMATCH',
    `for (const route of PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.behaviorRoutes!.filter(row => row.behavior === 'session.quality-state-cleanup'))
       (route as {guarantees:string[]}).guarantees = ['observe','observe'];`,
  ],
] as const)(
  'rejects %s without inflating actual adoption and repairs through the same checker',
  (name, code, mutation) => {
    const root = fixture(),
      path = nodePath.join(root, integrationsPath),
      original = readFileSync(path, 'utf8');
    const ownerPath = nodePath.join(root, bindingPath),
      owner = readFileSync(ownerPath, 'utf8');
    if (name === 'non-set guarantee comparison')
      writeFileSync(
        ownerPath,
        owner.replace("guarantees: ['observe']", "guarantees: ['observe','reject_action']"),
      );
    else if (name === 'repeated guarantee on both sides')
      writeFileSync(
        ownerPath,
        owner.replace("guarantees: ['observe']", "guarantees: ['observe','observe']"),
      );
    writeFileSync(path, `${original}\n${mutation}\n`);
    const changed = report(root);
    expect(changed.findings, `UNDETECTED_${name}`).toContainEqual(
      expect.objectContaining({
        code,
        metadata: expect.objectContaining({ behavior_id: binding }),
      }),
    );
    expect(new Set(changed.data.behavior_adoptions.map(row => row.registration_index)).size).toBe(
      changed.data.behavior_adoptions.length,
    );
    writeFileSync(path, original);
    writeFileSync(ownerPath, owner);
    expect(report(root).findings.filter(row => row.metadata?.behavior_id === binding)).toEqual([]);
  },
);

it('adopts both actual Git repair registrations, preserving selection and explicit provenance after repair', () => {
  const root = fixture(),
    current = report(root);
  const selected = current.data.behavior_adoptions.filter(
    row => row.behavior_id === 'git.repair-bare-state',
  );
  expect(selected, 'GIT_REPAIR_EXPLICIT_ADOPTION_MISSING').toHaveLength(2);
  expect(selected.map(row => row.source_family ?? 'legacy')).toEqual(['legacy', 'claude-native']);
  for (const row of selected) {
    expect(row).toMatchObject({
      owner: 'hooks/pre-tool-git-bare-fix.sh',
      trigger: 'pre_tool',
      guarantees: ['observe'],
    });
    expect(current.data.handler_inventory[row.registration_index]?.configuration).toMatchObject({
      group: { matcher: 'Bash' },
      hook: { if: 'Bash(git *)' },
    });
  }
  const path = nodePath.join(root, integrationsPath),
    original = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    `${original}\nconst routes = PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.behaviorRoutes!;
    (routes as unknown[]).splice(routes.findIndex(row => row.behavior === 'git.repair-bare-state' && !row.sourceFamily),1);\n`,
  );
  expect(report(root).findings).toContainEqual(
    expect.objectContaining({
      code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
      metadata: expect.objectContaining({
        host: 'claude',
        event: 'PreToolUse',
        handler_path: 'hooks/pre-tool-git-bare-fix.sh',
      }),
    }),
  );
  writeFileSync(path, original);
  expect(
    report(root).data.behavior_adoptions.filter(row => row.behavior_id === 'git.repair-bare-state'),
  ).toHaveLength(2);
});

it('rejects a distinct behavior reusing an already adopted registration index', () => {
  const root = fixture(),
    path = nodePath.join(root, integrationsPath),
    original = readFileSync(path, 'utf8');
  const ownerPath = nodePath.join(root, bindingPath),
    owner = readFileSync(ownerPath, 'utf8');
  writeFileSync(
    ownerPath,
    `${owner}\nSHARED_BEHAVIOR_BINDINGS.push({...SHARED_BEHAVIOR_BINDINGS[0]!,id:'cleanup.alias'});\n`,
  );
  writeFileSync(
    path,
    `${original}\nconst routes = PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.behaviorRoutes!;
    (routes as unknown[]).push({...routes[0]!,behavior:'cleanup.alias'});\n`,
  );
  const changed = report(root);
  expect(changed.findings).toContainEqual(
    expect.objectContaining({
      code: 'HOST_CONTRACT_BINDING_ADOPTION_DUPLICATE',
      metadata: expect.objectContaining({ behavior_id: 'cleanup.alias', matching_count: 1 }),
    }),
  );
  expect(changed.data.behavior_adoptions.some(row => row.behavior_id === 'cleanup.alias')).toBe(
    false,
  );
  expect(new Set(changed.data.behavior_adoptions.map(row => row.registration_index)).size).toBe(
    changed.data.behavior_adoptions.length,
  );
  writeFileSync(path, original);
  writeFileSync(ownerPath, owner);
  expect(
    report(root).findings.filter(row => row.code === 'HOST_CONTRACT_BINDING_ADOPTION_DUPLICATE'),
  ).toEqual([]);
});
