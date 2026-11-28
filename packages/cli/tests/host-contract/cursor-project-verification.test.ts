import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { retainNativeResourceActor } from '../../scripts/lib/resource-propagation-run.js';
import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import { CursorNativeCatalogueActor } from '../helpers/cursor-native-catalogue.js';
import {
  nativeHookRecords,
  nativeVerificationObservation,
} from '../helpers/cursor-native-observations.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { preparePropagationReadiness } from '../helpers/propagation-policy-case.js';
import {
  createPropagationSource,
  requirePropagationVerificationMarker,
} from '../helpers/propagation-source.js';

it('observes installed project policy through its real observer-wrapped hooks across public upgrade', async () => {
  const temporary = mkdtempSync(nodePath.join(tmpdir(), 'project-verification-'));
  const root = realpathSync(temporary);
  const profile = nodePath.join(root, 'profile');
  mkdirSync(nodePath.join(profile, 'logs'), { recursive: true });
  const logFile = nodePath.join(profile, 'logs/cursor.hooks.workspaceId-owned.log');
  let prompt = '',
    turn = 0;
  const manifest = (workspace: string) =>
    JSON.parse(readFileSync(nodePath.join(workspace, '.cursor/hooks.json'), 'utf8')) as {
      hooks: Record<string, { command: string }[]>;
    };
  class SourceWindow extends CursorNativeCatalogueActor {
    protected override async prepareHost(): Promise<void> {}
    protected override launchWindow(): Promise<void> {
      return Promise.reject(new Error('SOURCE_READY'));
    }
    protected override action(action: string, payload?: string): Promise<string> {
      if (action === 'close') return Promise.resolve('');
      if (action === 'fill') {
        prompt = readFileSync(payload ?? '', 'utf8');
        expect(prompt).not.toContain('\n');
        return Promise.resolve('');
      }
      expect(action).toBe('submit');
      const command = /START COMMAND `([^`]+)` END COMMAND/u.exec(prompt)?.[1];
      expect(command).toBeTruthy();
      const input = {
        conversation_id: `conversation-${++turn}`,
        session_id: `session-${turn}`,
        generation_id: `generation-${turn}`,
        tool_use_id: `tool-${turn}`,
        cursor_version: hostReleases.cursorIde.version,
        workspace_roots: [this.workspace],
        command,
      };
      // Only the external host/window transport is substituted. Execute the
      // actual installed registered command, including its real observer.
      const invoke = (event: string, extra = {}) => {
        const entries = manifest(this.workspace).hooks[event];
        expect(entries).toHaveLength(1);
        const entry = entries?.[0];
        expect(entry).toBeDefined();
        const nativeInput = { ...input, ...extra, hook_event_name: event };
        const result = spawnSync('sh', ['-c', entry?.command ?? ''], {
          cwd: this.workspace,
          env: this.environment,
          input: JSON.stringify(nativeInput),
          encoding: 'utf8',
        });
        expect(result.status, result.stderr).toBe(0);
        appendFileSync(
          logFile,
          `Command: ${entry?.command} (23ms) exit code: ${result.status}\n\nINPUT:\n${JSON.stringify(nativeInput)}\n\nOUTPUT:\n${result.stdout || '(empty)'}\n════════════════\n`,
        );
        return result.stdout;
      };
      const decision = JSON.parse(invoke('beforeShellExecution'));
      if (decision.permission === 'allow') {
        const result = spawnSync('sh', ['-c', command ?? ''], {
          cwd: this.workspace,
          encoding: 'utf8',
        });
        expect(result.status, result.stderr).toBe(0);
        invoke('afterShellExecution');
      }
      invoke('stop', { status: 'completed' });
      return Promise.resolve('');
    }
  }
  try {
    const inputs = createCanonicalCatalogueInputs(root);
    const canonical = { ...inputs, sourcePackage: createPropagationSource(root, inputs) };
    const actor = new SourceWindow(
      {
        runsDirectory: root,
        applicationBundle: `${root}/unused-app`,
        profileDirectory: profile,
        extensionsDirectory: `${root}/extensions`,
      },
      canonical,
    );
    await expect(
      actor.prepare('Cursor', hostReleases.cursorIde.version, 'IDE', 'project-hooks'),
    ).rejects.toThrow('SOURCE_READY');
    for (const path of [
      nodePath.join(actor.runDirectory, 'candidate'),
      nodePath.join(root, 'foreign'),
    ]) {
      mkdirSync(path);
      await expect(
        preparePropagationReadiness(actor.workspace, path, '', '', actor.runDirectory),
      ).rejects.toThrow(/readiness package outside owned native actor/u);
    }
    expect(existsSync(nodePath.join(actor.workspace, '.git'))).toBe(false);
    const scope = '**PR Scope:** ✅ Synthetic fixture matches its scope\n';
    const baseline = await actor.observeVerification(scope, scope);
    expect(baseline.decision.permission).toBe('allow');
    expect(baseline.effect).toBe(baseline.expectedEffect);
    requirePropagationVerificationMarker(inputs, 'VERIFICATION_ab-cd');
    await expect(actor.refreshResources(canonical)).rejects.toThrow('SOURCE_READY');
    const valid = `${scope}\nVERIFICATION_ab-cd\n`;
    const denied = await actor.observeVerification(scope, valid);
    expect(denied.decision.permission).toBe('deny');
    expect(denied.decision.user_message).toContain('invalid verification evidence');
    expect(denied.effect).toBeUndefined();
    expect(denied.afterShellCount).toBe(0);
    const repaired = await actor.observeVerification(valid, valid);
    expect(repaired.decision.permission).toBe('allow');
    expect(repaired.effect).toBe(repaired.expectedEffect);
    expect(repaired.installation).toBe(baseline.installation);
    expect(repaired.runtimeSha256).toBeUndefined();
    expect(repaired.origin).toBe(
      nodePath.join(actor.workspace, '.safeword/hooks/cursor/before-shell-execution.ts'),
    );
    expect(repaired.policyOrigin).toBe(
      nodePath.join(actor.workspace, '.safeword/hooks/lib/done-gate.ts'),
    );
    expect(repaired.policySha256).toBe(denied.policySha256);
    expect(denied.policySha256).not.toBe(baseline.policySha256);
    const records = nativeHookRecords(repaired.raw);
    const observer = nodePath.resolve(
      import.meta.dirname,
      '../fixtures/host-contract/cursor-hook-observer.ts',
    );
    // Completion provenance must refuse a single foreign row in either mode,
    // without also corrupting the correctly bound action or its input.
    for (const delivery of ['project', 'native']) {
      const extension = nodePath.join(actor.runDirectory, 'synthetic-decoder-only-extension');
      const rows = records.map(row => {
        if (delivery === 'project' || row.input.hook_event_name === 'afterShellExecution')
          return row;
        return {
          ...row,
          words: [
            'bun',
            nodePath.join(extension, 'runtime/dispatch.js'),
            `${row.input.hook_event_name}:0`,
          ],
        };
      });
      const context = {
        ...(delivery === 'project'
          ? {
              projectBindings: {
                beforeShellExecution: rows[0]?.words.slice(1) ?? [],
                stop: rows[2]?.words.slice(1) ?? [],
              },
            }
          : { extension }),
        workspace: actor.workspace,
        version: hostReleases.cursorIde.version,
        command: records[0]?.input.command ?? '',
        observer,
      };
      const render = (changed: number, argv?: string[], command?: string) =>
        rows
          .map((row, index) => {
            const args = index === changed && argv ? argv : row.words.slice(1);
            const input = index === changed && command ? { ...row.input, command } : row.input;
            return `Command: bun ${args.map(word => JSON.stringify(word)).join(' ')} (23ms) exit code: 0\n\nINPUT:\n${JSON.stringify(input)}\n\nOUTPUT:\n${row.output || '(empty)'}\n════════════════\n`;
          })
          .join('');
      expect(nativeVerificationObservation(render(-1), context).decision.permission).toBe('allow');
      expect(() => nativeVerificationObservation(render(2, ['/foreign/stop']), context)).toThrow(
        /completed native Stop missing/u,
      );
      expect(() =>
        nativeVerificationObservation(render(1, ['/foreign/observer']), context),
      ).toThrow(/foreign Shell observer/u);
      expect(() =>
        nativeVerificationObservation(render(1, undefined, 'different command'), context),
      ).toThrow(/foreign Shell command/u);
    }
    const retainedPolicy = await retainNativeResourceActor(actor).observeVerification(valid, valid);
    expect(retainedPolicy.protocol).toBe('permission-json');
    assert.ok(retainedPolicy.protocol === 'permission-json');
    expect(retainedPolicy.observation.decision.permission).toBe('allow');
    expect(retainedPolicy.observation.effect).toBe(retainedPolicy.observation.expectedEffect);
    expect(retainedPolicy.observation.installation).toBe(repaired.installation);
    const retainedDenied = await retainNativeResourceActor(actor).observeVerification(scope, valid);
    assert.ok(retainedDenied.protocol === 'permission-json');
    expect(retainedDenied.observation.decision.permission).toBe('deny');
    expect(retainedDenied.observation.decision.user_message).toContain(
      'invalid verification evidence',
    );
    expect(retainedDenied.observation.effect).toBeUndefined();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);
