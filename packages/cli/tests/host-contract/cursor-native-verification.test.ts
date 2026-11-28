import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
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
import { nativeCandidateDecisions } from '../helpers/cursor-native-write.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import {
  createPropagationSource,
  requirePropagationVerificationMarker,
} from '../helpers/propagation-source.js';

it('rejects a sibling native candidate path after a complete matching action', () => {
  const log = [
    'Command: bun "/tmp/candidate-foreign/runtime/dispatch.js" beforeShellExecution:0 (23ms) exit code: 0',
    '',
    'INPUT:',
    JSON.stringify({ hook_event_name: 'beforeShellExecution', command: 'gh pr create' }),
    '',
    'OUTPUT:',
    '{"permission":"allow"}',
    '════════════════',
    '',
  ].join('\n');
  expect(nativeCandidateDecisions(log, '/tmp/candidate', 'gh pr create')).toEqual([]);
});

function block(args: string[], input: Record<string, unknown>, output: string) {
  return `Command: bun ${args.map(word => JSON.stringify(word)).join(' ')} (23ms) exit code: 0\n\nINPUT:\n${JSON.stringify(input)}\n\nOUTPUT:\n${output || '(empty)'}\n════════════════\n`;
}

it('collects real generated native guard decisions and effects at the substituted host boundary', async () => {
  const temporary = mkdtempSync(nodePath.join(tmpdir(), 'ide-verification-'));
  const root = realpathSync(temporary);
  const profile = nodePath.join(root, 'profile');
  const logs = nodePath.join(profile, 'logs');
  mkdirSync(logs, { recursive: true });
  const logFile = nodePath.join(logs, 'cursor.hooks.workspaceId-owned.log');
  const version = hostReleases.cursorIde.version;
  let prompt = '',
    turn = 0;
  // Qualified vendor process substitution: actual generated callbacks and
  // local Shell execute; only the vendor/window transport records are synthetic.
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
      const extension = nodePath.join(this.runDirectory, 'extension');
      const dispatch = nodePath.join(extension, 'runtime/dispatch.js');
      const observer = nodePath.resolve(
        import.meta.dirname,
        '../fixtures/host-contract/cursor-hook-observer.ts',
      );
      const input = {
        conversation_id: `conversation-${++turn}`,
        session_id: `session-${turn}`,
        generation_id: `generation-${turn}`,
        tool_use_id: `tool-${turn}`,
        cursor_version: version,
        workspace_roots: [realpathSync(this.workspace)],
        command,
      };
      const invoke = (args: string[], event: string, extra = {}) => {
        const nativeInput = { ...input, ...extra, hook_event_name: event };
        const result = spawnSync('bun', args, {
          cwd: this.workspace,
          env: { ...this.environment, CURSOR_PLUGIN_ROOT: extension },
          input: JSON.stringify(nativeInput),
          encoding: 'utf8',
        });
        expect(result.status, result.stderr).toBe(0);
        appendFileSync(logFile, block(args, nativeInput, result.stdout));
        return result.stdout;
      };
      const decision = JSON.parse(
        invoke([dispatch, 'beforeShellExecution:0'], 'beforeShellExecution'),
      );
      if (decision.permission === 'allow') {
        const shell = spawnSync('sh', ['-c', command ?? ''], {
          cwd: this.workspace,
          encoding: 'utf8',
        });
        expect(shell.status, shell.stderr).toBe(0);
        invoke([observer, 'afterShellExecution', ':'], 'afterShellExecution');
      }
      invoke([dispatch, 'stop:0'], 'stop', { status: 'completed' });
      return Promise.resolve('');
    }
  }
  try {
    const inputs = createCanonicalCatalogueInputs(root);
    const canonical = { ...inputs, sourcePackage: createPropagationSource(root, inputs) };
    const actor = new SourceWindow(
      {
        runsDirectory: root,
        applicationBundle: nodePath.join(root, 'unexecuted-app'),
        profileDirectory: profile,
        extensionsDirectory: nodePath.join(root, 'extensions'),
      },
      canonical,
    );
    await expect(actor.prepare('Cursor', version, 'IDE', 'portable')).rejects.toThrow(
      'SOURCE_READY',
    );
    const scope = '**PR Scope:** ✅ Synthetic fixture matches its scope\n';
    const baseline = await actor.observeVerification(scope, scope);
    expect(baseline.decision.permission).toBe('allow');
    expect(baseline.effect).toBe(baseline.expectedEffect);
    requirePropagationVerificationMarker(inputs, 'VERIFICATION_cc-aa');
    await expect(actor.refreshResources(canonical)).rejects.toThrow('SOURCE_READY');
    const valid = `${scope}\nVERIFICATION_cc-aa\n`;
    const denied = await actor.observeVerification(scope, valid);
    expect(denied.decision.permission).toBe('deny');
    expect(denied.decision.user_message).toContain('invalid verification evidence');
    expect(denied.effect).toBeUndefined();
    const repaired = await actor.observeVerification(valid, valid);
    expect(repaired.decision.permission).toBe('allow');
    expect(repaired.effect).toBe(repaired.expectedEffect);
    expect(repaired.installation).toBe(baseline.installation);
    expect(repaired.runtimeSha256).toBe(denied.runtimeSha256);
    expect(denied.runtimeSha256).not.toBe(baseline.runtimeSha256);
    const context = {
      extension: nodePath.join(actor.runDirectory, 'extension'),
      workspace: actor.workspace,
      version,
      command: nativeHookRecords(repaired.raw)[0]?.input.command ?? '',
      observer: nodePath.resolve(
        import.meta.dirname,
        '../fixtures/host-contract/cursor-hook-observer.ts',
      ),
    };
    const records = nativeHookRecords(repaired.raw);
    expect(nativeCandidateDecisions(repaired.raw, context.extension, context.command)).toEqual([
      { permission: 'allow' },
    ]);
    const changedInput = (index: number, change: Record<string, unknown>) =>
      records
        .map((row, position) =>
          position === index
            ? block(row.words.slice(1), { ...row.input, ...change }, row.output)
            : row.raw,
        )
        .join('\n');
    for (const index of [0, 1, 2]) {
      expect(() =>
        nativeVerificationObservation(
          changedInput(index, { workspace_roots: [`${actor.workspace}-foreign`] }),
          context,
        ),
      ).toThrow(/foreign workspace/u);
      expect(() =>
        nativeVerificationObservation(
          changedInput(index, { cursor_version: 'foreign-version' }),
          context,
        ),
      ).toThrow(/foreign native version/u);
    }
    for (const id of ['conversation_id', 'generation_id', 'tool_use_id', 'session_id'])
      expect(() => nativeVerificationObservation(changedInput(0, { [id]: '' }), context)).toThrow(
        /native identity missing/u,
      );
    for (const id of ['conversation_id', 'generation_id', 'session_id'])
      expect(() =>
        nativeVerificationObservation(changedInput(1, { [id]: 'foreign-id' }), context),
      ).toThrow(/native Shell completion missing/u);
    expect(() =>
      nativeVerificationObservation(changedInput(1, { tool_use_id: 'foreign' }), context),
    ).toThrow(/foreign native tool/u);
    expect(() =>
      nativeVerificationObservation(changedInput(2, { generation_id: 'foreign' }), context),
    ).toThrow(/completed native Stop missing/u);
    expect(() =>
      nativeVerificationObservation(
        repaired.raw.replaceAll(context.extension, () => `${context.extension}-foreign`),
        context,
      ),
    ).toThrow(/ambiguous native action/u);
    expect(() =>
      nativeVerificationObservation(repaired.raw.replace('exit code: 0', 'exit code: 1'), context),
    ).toThrow(/native callback failed/u);
    expect(() =>
      nativeVerificationObservation(repaired.raw + (records[0]?.raw ?? ''), context),
    ).toThrow(/ambiguous native action/u);
    expect(() =>
      nativeVerificationObservation(repaired.raw, { ...context, command: 'wrong action' }),
    ).toThrow(/native command mismatch/u);
    expect(() =>
      nativeVerificationObservation(repaired.raw.replaceAll('"allow"', '"deny"'), context),
    ).toThrow(/native denial reason missing/u);
    expect(() =>
      nativeVerificationObservation(
        records
          .filter(row => row.input.hook_event_name !== 'afterShellExecution')
          .map(row => row.raw)
          .join('\n'),
        context,
      ),
    ).toThrow(/native Shell completion missing/u);
    expect(() =>
      nativeVerificationObservation(
        records
          .slice(0, 1)
          .map(row => row.raw)
          .join(''),
        context,
      ),
    ).toThrow(/completed native Stop missing/u);
    // Wrong but observed policy/effect remains a fact for the caller's grader.
    const wrong = repaired.raw.replaceAll('"allow"', '"deny","user_message":"wrong reason"');
    expect(nativeVerificationObservation(wrong, context).decision.user_message).toBe(
      'wrong reason',
    );
    expect(readFileSync(repaired.rawPath, 'utf8')).toContain(repaired.raw.split('\n', 1)[0]);
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
