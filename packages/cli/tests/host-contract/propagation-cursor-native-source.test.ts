import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { CursorNativePluginActor } from '../helpers/cursor-native-write.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { preparePropagationReadiness } from '../helpers/propagation-policy-case.js';
import {
  createPropagationSource,
  requirePropagationVerificationMarker,
} from '../helpers/propagation-source.js';

// Source/package boundary only: no vendor, window or model. Real generators,
// installed producers and generated guard run; only the local GH action is fake.
it('prepares native IDE policy from its owned canonical source before any window', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-native-source-'));
  try {
    const inputs = createCanonicalCatalogueInputs(root);
    const sourcePackage = createPropagationSource(root, inputs);
    const marker = 'VERIFICATION_aa-bb';
    requirePropagationVerificationMarker(inputs, marker);
    const actor = new CursorNativePluginActor(
      {
        runsDirectory: root,
        applicationBundle: nodePath.join(root, 'unused-app'),
        profileDirectory: nodePath.join(root, 'unused-profile'),
        extensionsDirectory: nodePath.join(root, 'unused-extensions'),
      },
      'guard',
      { ...inputs, sourcePackage },
    );
    const { core, candidate, control } = await actor.prepareSources('3.29.9');
    const manifest = JSON.parse(readFileSync(nodePath.join(candidate, 'hooks/hooks.json'), 'utf8'));
    const binding = manifest.hooks.beforeShellExecution[0].command;
    const scope = '**PR Scope:** ✅ Synthetic fixture matches its scope\n';
    const valid = `${scope}\n${marker}\n`;
    const run = async (evidence: string) => {
      const fixture = await preparePropagationReadiness(
        actor.workspace,
        candidate,
        evidence,
        valid,
        actor.runDirectory,
      );
      rmSync(fixture.effect, { force: true });
      const result = spawnSync('sh', ['-c', binding], {
        cwd: actor.workspace,
        env: { ...process.env, CURSOR_PLUGIN_ROOT: candidate, SAFEWORD_CLI: undefined },
        input: JSON.stringify({
          workspace_roots: [actor.workspace],
          conversation_id: 'native-ide-source',
          hook_event_name: 'beforeShellExecution',
          command: fixture.command,
        }),
        encoding: 'utf8',
      });
      expect(result.status, result.stderr).toBe(0);
      const decision = JSON.parse(result.stdout);
      if (decision.permission === 'allow') {
        const action = spawnSync('sh', ['-c', fixture.command], { encoding: 'utf8' });
        expect(action.status, action.stderr).toBe(0);
      }
      return { decision, fixture };
    };
    const denied = await run(scope);
    expect(denied.decision.permission, 'PROPAGATION_NATIVE_IDE_POLICY_STALE').toBe('deny');
    expect(denied.decision.user_message).toContain('invalid verification evidence');
    expect(existsSync(denied.fixture.effect)).toBe(false);
    const allowed = await run(valid);
    expect(allowed.decision).toEqual({ permission: 'allow' });
    expect(readFileSync(allowed.fixture.effect, 'utf8')).toBe(allowed.fixture.marker);
    const missingScope = await run(`${marker}\n`);
    expect(missingScope.decision.permission).toBe('deny');
    expect(existsSync(missingScope.fixture.effect)).toBe(false);
    const discovery = JSON.parse(
      readFileSync(
        nodePath.join(actor.workspace, '.host-contract/workspace-open-config.json'),
        'utf8',
      ),
    );
    expect(discovery).toEqual({
      workspace: actor.workspace,
      version: '3.29.9',
      pluginPaths: [core, candidate, control],
    });
    expect(readFileSync(nodePath.join(core, 'skills/explain/SKILL.md'), 'utf8')).toContain(
      inputs.workflowMarker,
    );
    expect(readFileSync(nodePath.join(candidate, 'runtime/cli.js'), 'utf8')).toContain(marker);
    expect(readFileSync(nodePath.join(core, 'runtime/cli.js'), 'utf8')).toContain(marker);
    const helper = spawnSync(
      'bun',
      [
        nodePath.join(core, 'runtime/cli.js'),
        'project',
        'runtime',
        'audit-principle-trace',
        actor.workspace,
      ],
      { cwd: actor.workspace, encoding: 'utf8' },
    );
    expect(helper.status, helper.stderr).toBe(0);
    expect(helper.stdout.trim()).toBe(inputs.helperMarker);
    const origin = JSON.parse(
      readFileSync(nodePath.join(actor.workspace, '.host-contract/native-helper.json'), 'utf8'),
    );
    expect(realpathSync(origin.origin)).toBe(
      realpathSync(nodePath.join(core, 'templates/hooks/audit-principle-trace.ts')),
    );
    expect(
      readFileSync(nodePath.join(sourcePackage, 'templates/hooks/lib/done-gate.ts'), 'utf8'),
    ).toContain(marker);
    const project = JSON.parse(
      readFileSync(nodePath.join(actor.workspace, '.cursor/hooks.json'), 'utf8'),
    );
    expect(Object.keys(project.hooks).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'afterShellExecution',
      'preToolUse',
      'stop',
      'workspaceOpen',
    ]);
    for (const event of ['preToolUse', 'afterShellExecution', 'stop']) {
      expect(project.hooks[event]).toHaveLength(1);
      expect(project.hooks[event][0].command).toMatch(/cursor-write-observer\.ts'$/u);
    }
    for (const path of ['.cursor/commands', '.cursor/rules', '.claude'])
      expect(existsSync(nodePath.join(actor.workspace, path))).toBe(false);
    const independent = JSON.parse(
      readFileSync(nodePath.join(control, 'hooks/hooks.json'), 'utf8'),
    );
    expect(Object.keys(independent.hooks).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'preToolUse',
      'workspaceOpen',
    ]);
    for (const entries of Object.values<{ command: string }[]>(independent.hooks))
      expect(entries[0]?.command).toContain('cursor-write-observer.ts');
    await expect(
      preparePropagationReadiness(actor.workspace, core, valid, valid, actor.runDirectory),
    ).rejects.toThrow('readiness package outside owned native actor');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);
