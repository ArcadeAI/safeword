import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it, vi } from 'vitest';

import { propagationLanes } from '../../scripts/lib/resource-propagation.js';
import { prepareNativeResourceActor } from '../../scripts/lib/resource-propagation-run.js';
import { CursorNativeWindowActor } from '../helpers/cursor-native-window.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { preparePropagationReadiness } from '../helpers/propagation-policy-case.js';
import {
  createPropagationSource,
  requirePropagationVerificationMarker,
} from '../helpers/propagation-source.js';

// Substitute only host preparation/window I/O. Real factory, generation,
// reconciliation, discovery observer and installed policy execute; no native proof.
it('retains clean native IDE delivery through canonical policy refresh', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-retained-source-'));
  const edge = CursorNativeWindowActor.prototype as unknown as {
    prepareHost(): Promise<void>;
    launchWindow(): Promise<void>;
    action(action: string): Promise<string>;
  };
  let workspace = '',
    runDirectory = '',
    core = '',
    extension = '';
  try {
    vi.spyOn(edge, 'prepareHost').mockResolvedValue();
    vi.spyOn(edge, 'action').mockImplementation(action => {
      expect(action).toBe('close');
      return Promise.resolve('');
    });
    vi.spyOn(edge, 'launchWindow').mockImplementation(function (this: CursorNativeWindowActor) {
      ({ workspace, runDirectory } = this);
      for (const path of ['.cursor/commands', '.cursor/rules'])
        expect(existsSync(nodePath.join(workspace, path)), 'PROPAGATION_DELIVERY_SUBSTITUTED').toBe(
          false,
        );
      const config = nodePath.join(workspace, '.host-contract/workspace-open-config.json');
      const discovery = JSON.parse(readFileSync(config, 'utf8'));
      core = nodePath.join(runDirectory, 'candidate');
      extension = nodePath.join(runDirectory, 'extension');
      expect(discovery.pluginPaths).toEqual([
        nodePath.join(runDirectory, 'discovery-control'),
        core,
        extension,
      ]);
      const hooks = JSON.parse(
        readFileSync(nodePath.join(workspace, '.cursor/hooks.json'), 'utf8'),
      );
      expect(Object.keys(hooks.hooks).toSorted((a, b) => a.localeCompare(b))).toEqual([
        'afterShellExecution',
        'workspaceOpen',
      ]);
      const observed = spawnSync(
        'bun',
        [
          nodePath.resolve(
            import.meta.dirname,
            '../fixtures/host-contract/workspace-open-probe.ts',
          ),
          config,
        ],
        {
          input: JSON.stringify({
            hook_event_name: 'workspaceOpen',
            cursor_version: discovery.version,
            workspace_roots: [workspace],
          }),
          encoding: 'utf8',
        },
      );
      expect(observed.status, observed.stderr).toBe(0);
      return Promise.resolve();
    });
    const inputs = createCanonicalCatalogueInputs(root);
    const current = { ...inputs, sourcePackage: createPropagationSource(root, inputs) };
    const lane = propagationLanes().find(
      row => row.agent === 'cursor' && row.runtime === 'IDE' && row.delivery === 'native',
    );
    expect(lane).toBeDefined();
    if (!lane) throw new Error('NATIVE_IDE_REQUIRED_LANE_MISSING');
    const actor = await prepareNativeResourceActor(
      lane,
      current,
      {
        runsDirectory: root,
        applicationBundle: nodePath.join(root, 'unexecuted-app'),
        profileDirectory: nodePath.join(root, 'owned-profile'),
        extensionsDirectory: nodePath.join(root, 'owned-extensions'),
      },
      root,
    );
    const resources = [
      'skills/explain/SKILL.md',
      'skills/explain/references/HOST_CONTRACT_GUIDE.md',
      'templates/hooks/audit-principle-trace.ts',
    ];
    const before = resources.map(path => readFileSync(nodePath.join(core, path)));
    const identity = [workspace, core, extension];
    const scope = '**PR Scope:** ✅ Synthetic fixture matches its scope\n';
    const marker = 'VERIFICATION_ab-cd';
    const valid = `${scope}\n${marker}\n`;
    const run = async (evidence: string, setup = valid) => {
      const fixture = await preparePropagationReadiness(
        workspace,
        extension,
        evidence,
        setup,
        runDirectory,
      );
      rmSync(fixture.effect, { force: true });
      const manifest = JSON.parse(
        readFileSync(nodePath.join(extension, 'hooks/hooks.json'), 'utf8'),
      );
      const hook = spawnSync('sh', ['-c', manifest.hooks.beforeShellExecution[0].command], {
        cwd: workspace,
        env: { ...process.env, CURSOR_PLUGIN_ROOT: extension, SAFEWORD_CLI: undefined },
        input: JSON.stringify({
          workspace_roots: [workspace],
          conversation_id: 'source-retained',
          hook_event_name: 'beforeShellExecution',
          command: fixture.command,
        }),
        encoding: 'utf8',
      });
      expect(hook.status, hook.stderr).toBe(0);
      const decision = JSON.parse(hook.stdout);
      if (decision.permission === 'allow') {
        const effect = spawnSync('sh', ['-c', fixture.command], { encoding: 'utf8' });
        expect(effect.status, effect.stderr).toBe(0);
        expect(readFileSync(fixture.effect, 'utf8')).toBe(fixture.marker);
      } else expect(existsSync(fixture.effect)).toBe(false);
      return decision;
    };
    expect(await run(scope, scope)).toEqual({ permission: 'allow' });
    const configPath = nodePath.join(workspace, '.safeword/config.json');
    const config = {
      ...JSON.parse(readFileSync(configPath, 'utf8')),
      designApprovalGate: false,
      userOwnedFixtureSetting: 'preserve',
    };
    writeFileSync(configPath, JSON.stringify(config));
    requirePropagationVerificationMarker(inputs, marker);
    await actor.refreshResources(current);
    expect([workspace, core, extension]).toEqual(identity);
    expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual(config);
    expect(resources.map(path => readFileSync(nodePath.join(core, path)))).toEqual(before);
    expect(readFileSync(nodePath.join(core, 'runtime/cli.js'), 'utf8')).toContain(marker);
    expect(readFileSync(nodePath.join(extension, 'runtime/cli.js'), 'utf8')).toContain(marker);
    expect(await run(scope), 'PROPAGATION_NATIVE_IDE_POLICY_STALE').toMatchObject({
      permission: 'deny',
      user_message: expect.stringContaining('invalid verification evidence'),
    });
    expect(await run(valid)).toEqual({ permission: 'allow' });
    expect(await run(`**PR Scope:** ❌ Wrong scope\n${marker}\n`)).toMatchObject({
      permission: 'deny',
    });
    await expect(
      preparePropagationReadiness(workspace, core, valid, valid, runDirectory),
    ).rejects.toThrow('readiness package outside owned native actor');
  } finally {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);
