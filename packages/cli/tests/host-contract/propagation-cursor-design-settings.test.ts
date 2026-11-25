import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { runDesignApprovalSettings } from '../../scripts/lib/propagation-settings.js';
import type {
  DesignSettingObservation,
  RetainedPolicyActor,
} from '../../scripts/lib/resource-propagation.js';
import {
  captureNativePropagationActor,
  retainNativeResourceActor,
} from '../../scripts/lib/resource-propagation-run.js';
import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import combinations from '../fixtures/host-contract/documented-option-composition.json';
import { CursorNativeCatalogueActor } from '../helpers/cursor-native-catalogue.js';
import {
  nativeDesignObservation,
  nativeHookRecords,
} from '../helpers/cursor-native-observations.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { createPropagationSource } from '../helpers/propagation-source.js';

// Source process integration ONLY: vendor window/action transport is replaced.
// The actual installed/generated registered Write guard runs and decides permission.
it.each(['portable', 'project-hooks'])(
  'captures Cursor design settings through %s',
  async delivery => {
    const temporary = mkdtempSync(nodePath.join(tmpdir(), 'cursor-design-'));
    const root = realpathSync(temporary);
    const profile = nodePath.join(root, 'profile');
    mkdirSync(nodePath.join(profile, 'logs'), { recursive: true });
    const log = nodePath.join(profile, 'logs/cursor.hooks.workspaceId-owned.log');
    let turn = 0;
    let fault = '';
    class SourceWindow extends CursorNativeCatalogueActor {
      protected override async prepareHost() {}
      protected override launchWindow() {
        return Promise.reject(new Error('SOURCE_READY'));
      }
      protected override async freshAgent() {}
      protected override action(action: string, payload?: string) {
        if (action === 'fill') return Promise.resolve('');
        expect(action).toBe('submit');
        const prompt = readFileSync(payload ?? '', 'utf8');
        const match =
          /absolute file ("[^\n]+?") with this exact complete content: ("(?:\\.|[^"\\])*")/u.exec(
            prompt,
          );
        assert.ok(match?.[1] && match[2]);
        const file = JSON.parse(match[1]);
        const content = JSON.parse(match[2]);
        const config = nodePath.join(this.workspace, '.safeword/config.json');
        if (fault === 'dropped option') {
          const value = JSON.parse(readFileSync(config, 'utf8'));
          value.designApprovalGate = false;
          writeFileSync(config, JSON.stringify(value));
        }
        const extension = nodePath.join(this.runDirectory, 'extension');
        const manifest = JSON.parse(
          readFileSync(nodePath.join(this.workspace, '.cursor/hooks.json'), 'utf8'),
        );
        const command = (event: string) =>
          delivery === 'portable'
            ? `bun ${JSON.stringify(nodePath.join(extension, 'runtime/dispatch.js'))} ${event}:0`
            : manifest.hooks[event][0].command;
        const input = {
          conversation_id: `conversation-${++turn}`,
          generation_id: `generation-${turn}`,
          session_id: `session-${turn}`,
          tool_use_id: `tool-${turn}`,
          cursor_version: hostReleases.cursorIde.version,
          workspace_roots: [this.workspace],
        };
        const invoke = (event: string, extra: object) => {
          const body = { ...input, hook_event_name: event, ...extra };
          const command_ = command(event);
          const result = spawnSync('sh', ['-c', command_], {
            cwd: this.workspace,
            env: { ...this.environment, CURSOR_PLUGIN_ROOT: extension },
            input: JSON.stringify(body),
            encoding: 'utf8',
          });
          expect(result.status, result.stderr).toBe(0);
          if (!(fault === 'missing dispatch' && event === 'preToolUse'))
            appendFileSync(
              log,
              `Command: ${command_} (23ms) exit code: ${result.status}\n\nINPUT:\n${JSON.stringify(body)}\n\nOUTPUT:\n${result.stdout || '(empty)'}\n════════════════\n`,
            );
          return JSON.parse(result.stdout);
        };
        const decision = invoke('preToolUse', {
          tool_name: 'Write',
          tool_input: { file_path: file, content },
        });
        // Vendor transport substitute executes the actual Write only when the installed guard allows it.
        if (decision.permission === 'allow' || fault === 'bypass') writeFileSync(file, content);
        invoke('stop', { status: 'completed', loop_count: 0 });
        return Promise.resolve('');
      }
    }
    try {
      const inputs = createCanonicalCatalogueInputs(root);
      const actor = new SourceWindow(
        {
          runsDirectory: root,
          applicationBundle: `${root}/unused`,
          profileDirectory: profile,
          extensionsDirectory: `${root}/extensions`,
        },
        { ...inputs, sourcePackage: createPropagationSource(root, inputs) },
      );
      await expect(
        actor.prepare('Cursor', hostReleases.cursorIde.version, 'IDE', delivery),
      ).rejects.toThrow('SOURCE_READY');
      const captured = captureNativePropagationActor(
        retainNativeResourceActor(actor),
        delivery,
        root,
      );
      const grade = await runDesignApprovalSettings(captured);
      expect(grade.exit, grade.failures.join('\n')).toBe(0);
      expect(grade.observations).toHaveLength(6);
      for (const [index, row] of grade.observations.entries()) {
        expect(row.protocol).toBe('permission-json');
        const options = combinations[index];
        assert.ok(options);
        expect(JSON.parse(row.observation.configuration.bytes)).toMatchObject(options);
        expect(row.observation.raw).toContain('preToolUse');
        expect(row.observation.installation).toBe(grade.observations[0]?.observation.installation);
        expect(row.observation.effect).toBe(
          combinations[index]?.designApprovalGate
            ? row.observation.before
            : row.observation.expectedEffect,
        );
      }
      await assertCapturedGraderFaults(grade.observations, retainNativeResourceActor(actor), root);
      for (const value of ['dropped option', 'bypass']) {
        fault = value;
        const bad = await runDesignApprovalSettings(captured);
        expect(bad.exit).toBe(2);
        expect(bad.failures).toContain('PROPAGATION_DESIGN_SETTING:1:MISMATCH');
        expect(readFileSync(nodePath.join(root, 'observations.jsonl'), 'utf8')).toContain('design');
      }
      const first = grade.observations[0];
      assert.ok(first);
      const raw = first.observation.raw;
      const rows = nativeHookRecords(raw);
      const action = rows.find(row => row.input.hook_event_name === 'preToolUse');
      const stop = rows.find(row => row.input.hook_event_name === 'stop');
      assert.ok(action?.input.tool_input?.file_path && action.input.tool_input.content && stop);
      const context = {
        action: action.words.slice(1),
        stop: stop.words.slice(1),
        workspace: actor.workspace,
        version: hostReleases.cursorIde.version,
        file: action.input.tool_input.file_path,
        content: action.input.tool_input.content,
      };
      expect(() => nativeDesignObservation(raw.replace(action.raw, ''), context)).toThrow(
        'design Write cardinality',
      );
      expect(() => nativeDesignObservation(raw, { ...context, workspace: '/foreign' })).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  180_000,
);

// Grader-only doubles: alter one projection, never guard outputs or vendor actions.
async function assertCapturedGraderFaults(
  observations: DesignSettingObservation[],
  retained: RetainedPolicyActor,
  root: string,
) {
  type Facts = Extract<DesignSettingObservation, { protocol: 'permission-json' }>['observation'];
  const cases: { name: string; index: number; alter: (facts: Facts) => Facts }[] = [
    {
      name: 'config-after',
      index: 1,
      alter: o => ({
        ...o,
        configuration: { ...o.configuration, after: `${o.configuration.after}\n` },
      }),
    },
    {
      name: 'unrelated-reason',
      index: 1,
      alter: o => ({
        ...o,
        decision: {
          ...o.decision,
          user_message: 'unrelated pre-action restriction',
          agent_message: 'unrelated pre-action restriction',
        },
      }),
    },
    {
      name: 'enabled-allow',
      index: 1,
      alter: o => ({ ...o, decision: { ...o.decision, permission: 'allow' } }),
    },
    {
      name: 'disabled-deny',
      index: 0,
      alter: o => ({ ...o, decision: { ...o.decision, permission: 'deny' } }),
    },
    { name: 'disabled-no-effect', index: 0, alter: o => ({ ...o, effect: o.before }) },
  ];
  const oracle = JSON.stringify(combinations);
  const originals = JSON.stringify(observations);
  for (const { name, index, alter } of cases) {
    const actual = observations[index];
    assert.ok(actual?.protocol === 'permission-json');
    const changed = alter(structuredClone(actual.observation));
    const altered = { ...actual, observation: changed };
    let current = 0;
    const captured = captureNativePropagationActor(
      {
        ...retained,
        observeDesignApproval: () => {
          const source = observations[current];
          assert.ok(source);
          return Promise.resolve(current++ === index ? altered : source);
        },
      },
      name,
      root,
    );
    const grade = await runDesignApprovalSettings(captured);
    expect(grade.exit).toBe(2);
    expect(grade.failures).toEqual([`PROPAGATION_DESIGN_SETTING:${index}:MISMATCH`]);
    expect(grade.observations[index]).toBe(altered);
    const entry = readFileSync(nodePath.join(root, 'observations.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as { lane: string; observation_artifact: string })
      .filter(row => row.lane === name)[index];
    assert.ok(entry);
    expect(JSON.parse(readFileSync(entry.observation_artifact, 'utf8'))).toEqual(changed);
    expect(JSON.stringify(combinations)).toBe(oracle);
    expect(JSON.stringify(observations)).toBe(originals);
  }
}
