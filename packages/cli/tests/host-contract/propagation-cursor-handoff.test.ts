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

import { runHandoffSettings } from '../../scripts/lib/propagation-settings.js';
import type {
  CursorHandoffObservation,
  RetainedPolicyActor,
} from '../../scripts/lib/resource-propagation.js';
import {
  captureNativePropagationActor,
  retainNativeResourceActor,
} from '../../scripts/lib/resource-propagation-run.js';
import hostReleases from '../../src/lifecycle/host-releases.json';
import combinations from '../fixtures/host-contract/documented-option-composition.json';
import { CursorNativeCatalogueActor } from '../helpers/cursor-native-catalogue.js';
import { nativeHandoffEdit, nativeHookRecords } from '../helpers/cursor-native-observations.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { createPropagationSource } from '../helpers/propagation-source.js';
// Source integration only: the window/turn/file-edit edge is substituted; registered guards are real.
it.each([
  ['portable', false],
  ['project-hooks', false],
  ['portable', true],
  ['project-hooks', true],
] as const)(
  'captures generated handoff/history through %s (presence-only regression=%s)',
  async (delivery, regressed) => {
    const temporary = mkdtempSync(nodePath.join(tmpdir(), 'cursor-handoff-'));
    const root = realpathSync(temporary);
    const profile = nodePath.join(root, 'profile');
    mkdirSync(nodePath.join(profile, 'logs'), { recursive: true });
    const log = nodePath.join(profile, 'logs/cursor.hooks.workspaceId-owned.log');
    let conversation = '',
      generation = 0;
    class SourceWindow extends CursorNativeCatalogueActor {
      private readonly configurations = new Set<string>();
      protected override async prepareHost() {}
      protected override launchWindow() {
        return Promise.reject(new Error('SOURCE_READY'));
      }
      protected override hookConfigurationLoads() {
        this.configurations.add(
          readFileSync(nodePath.join(this.workspace, '.cursor/hooks.json'), 'utf8'),
        );
        return this.configurations.size;
      }
      protected override freshAgent() {
        conversation = `conversation-${++generation}`;
        return Promise.resolve();
      }
      protected override action(action: string, payload?: string) {
        if (action === 'close') return Promise.resolve('');
        if (action === 'fill') {
          expect(readFileSync(payload ?? '', 'utf8')).not.toContain('\n');
          return Promise.resolve('');
        }
        expect(action).toBe('submit');
        const extension = nodePath.join(this.runDirectory, 'extension');
        const binding =
          delivery === 'portable'
            ? `bun ${JSON.stringify(nodePath.join(extension, 'runtime/dispatch.js'))} stop:0`
            : JSON.parse(readFileSync(nodePath.join(this.workspace, '.cursor/hooks.json'), 'utf8'))
                .hooks.stop[0].command;
        const manifest = JSON.parse(
          readFileSync(nodePath.join(this.workspace, '.cursor/hooks.json'), 'utf8'),
        );
        const observer = (event: string): string =>
          manifest.hooks[event].find((row: { command: string }) =>
            row.command.includes('architecture-response-observer'),
          ).command;
        let file = '',
          content = '';
        const installed = (event: string) =>
          delivery === 'portable'
            ? `bun ${JSON.stringify(nodePath.join(extension, 'runtime/dispatch.js'))} ${event}:0`
            : manifest.hooks[event][0].command;
        const invoke = (
          event: string,
          loop: number,
          command: string,
          turn: string,
          text?: string,
        ) => {
          const input = {
            hook_event_name: event,
            conversation_id: conversation,
            generation_id: turn,
            cursor_version: hostReleases.cursorIde.version,
            workspace_roots: [this.workspace],
            status: event === 'stop' ? 'completed' : undefined,
            loop_count: event === 'stop' ? loop : undefined,
            text,
            transcript_path: nodePath.join(this.runDirectory, 'transcript.jsonl'),
            file_path: file || undefined,
            tool_name: event === 'preToolUse' ? 'Write' : undefined,
            tool_input: event === 'preToolUse' ? { file_path: file, content } : undefined,
            tool_use_id: 'write-1',
            session_id: conversation,
          };
          const result = spawnSync('sh', ['-c', command], {
            cwd: this.workspace,
            env: { ...this.environment, CURSOR_PLUGIN_ROOT: extension },
            input: JSON.stringify(input),
            encoding: 'utf8',
          });
          expect(result.status, result.stderr).toBe(0);
          appendFileSync(
            log,
            `Command: ${command} (23ms) exit code: ${result.status}\n\nINPUT:\n${JSON.stringify(input)}\n\nOUTPUT:\n${result.stdout || '(empty)'}\n════════════════\n`,
          );
          return result.stdout;
        };
        const first = `generation-${++generation}`;
        const prompt = readFileSync(payload ?? '', 'utf8');
        const match =
          /Use Write exactly once on ("[^"\n]+") with exact complete content ("(?:[^"\\]|\\.)*")\./u.exec(
            prompt,
          );
        const transcript = nodePath.join(this.runDirectory, 'transcript.jsonl');
        appendFileSync(
          transcript,
          `${JSON.stringify({
            role: 'assistant',
            message: { content: [{ type: 'text', text: 'READY' }] },
          })}\n`,
        );
        if (match) {
          file = JSON.parse(match[1] ?? '');
          content = JSON.parse(match[2] ?? '');
          invoke('preToolUse', 0, installed('preToolUse'), first);
          writeFileSync(file, content);
          invoke('afterFileEdit', 0, installed('afterFileEdit'), first);
        }

        invoke('afterAgentResponse', 0, observer('afterAgentResponse'), first, 'READY');
        appendFileSync(
          log,
          'Hook step requested: stop\nExecuting hook 1/1 from claude-plugin config\n',
        );
        const output = JSON.parse(invoke('stop', 0, binding, first));
        if (output.followup_message) {
          const next = `generation-${++generation}`;
          invoke(
            'afterAgentResponse',
            1,
            observer('afterAgentResponse'),
            next,
            'The requested evidence remains missing.',
          );
          appendFileSync(
            log,
            'Hook step requested: stop\nExecuting hook 1/1 from claude-plugin config\nHook 1 skipped due to loop limit (loop_count=1, limit=1)\n',
          );
        }
        return Promise.resolve('');
      }
    }

    try {
      const inputs = createCanonicalCatalogueInputs(root);
      if (regressed) {
        // Counterfactual source fixture only: normal generation bundles the presence-only regression.
        const stop = nodePath.join(inputs.canonicalRoot, 'hooks/cursor/stop.ts');
        const text = readFileSync(stop, 'utf8');
        expect(text).toContain('hasCurrentCursorEdit(input)');
        writeFileSync(stop, text.replace('hasCurrentCursorEdit(input)', 'hasSessionEdit'));
      }
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
      const retained = retainNativeResourceActor(actor);
      const result = await runHandoffSettings(
        captureNativePropagationActor(retained, delivery, root),
      );
      const observed = result.observations as CursorHandoffObservation[];
      expect(result.caseIndices).toEqual([0, 1, 2, 4, 5, 3, 6]);
      if (regressed) {
        expect(result.exit).toBe(2);
        expect(result.failures).toEqual(['PROPAGATION_HANDOFF_SETTING:6:MISMATCH']);
        const history = observed[6];
        assert.ok(history);
        expect(firstStop(history).followup).toContain('terminal-handoff/v1 correction');
      } else {
        expect(result.exit, result.failures.join('\n')).toBe(0);
        expect(observed).toHaveLength(7);
        // Reindex only the saved fixture array for independent grader fault controls.
        const byFixture = result.caseIndices.map(
          (index, position) => [index, observed[position]] as const,
        );
        const originalOrder = byFixture.toSorted((a, b) => a[0] - b[0]).map(row => row[1]);
        assert.ok(originalOrder.every(Boolean));
        assertSettings(observed, result.caseIndices);
        await assertFaults(originalOrder as CursorHandoffObservation[], retained, root);
        assertDecoder(observed[1]?.raw ?? '', actor.workspace);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);
type Fault = {
  name: string;
  index: number;
  exit: 2 | 3;
  change(row: CursorHandoffObservation): void;
};
const faults: Fault[] = [
  {
    name: 'missing config path',
    index: 1,
    exit: 3,
    change: r => {
      r.configuration.path = '';
    },
  },
  {
    name: 'missing edit raw',
    index: 1,
    exit: 3,
    change: r => {
      edit(r).callback.raw = '';
    },
  },
  {
    name: 'wrong file effect',
    index: 6,
    exit: 2,
    change: r => {
      r.fileEffect.after += 'foreign';
    },
  },
  {
    name: 'wrong installed cap',
    index: 1,
    exit: 2,
    change: r => {
      cap(r).binding.loopLimit = 2;
    },
  },
  {
    name: 'missing skip',
    index: 1,
    exit: 2,
    change: r => {
      cap(r).skip.raw = '';
    },
  },
  {
    name: 'response failure',
    index: 1,
    exit: 2,
    change: r => {
      cap(r).response.exit = 1;
    },
  },
  {
    name: 'response foreign version',
    index: 1,
    exit: 2,
    change: r => {
      cap(r).response.input.cursor_version = 'foreign';
    },
  },
  {
    name: 'response foreign workspace',
    index: 1,
    exit: 2,
    change: r => {
      cap(r).response.input.workspace_roots = ['foreign'];
    },
  },

  {
    name: 'changed config',
    index: 0,
    exit: 2,
    change: r => {
      r.configuration.after += ' ';
    },
  },
  {
    name: 'dropped option',
    index: 1,
    exit: 2,
    change: r => {
      r.configuration.bytes = JSON.stringify({
        ...combinations[1],
        terminalHandoffCorrection: false,
      });
      r.configuration.after = r.configuration.bytes;
    },
  },
  {
    name: 'missing raw',
    index: 1,
    exit: 3,
    change: r => {
      r.raw = '';
    },
  },
  {
    name: 'missing identity',
    index: 1,
    exit: 3,
    change: r => {
      r.installation = '';
    },
  },
  {
    name: 'replacement',
    index: 1,
    exit: 2,
    change: r => {
      r.installation = 'foreign';
    },
  },
  {
    name: 'missing stop',
    index: 1,
    exit: 3,
    change: r => {
      r.stops = [];
    },
  },
  {
    name: 'extra stop',
    index: 1,
    exit: 2,
    change: r => {
      r.stops.push(structuredClone(firstStop(r)));
    },
  },
  {
    name: 'wrong loop',
    index: 1,
    exit: 2,
    change: r => {
      firstStop(r).input.loop_count = 1;
    },
  },
  {
    name: 'missing correction',
    index: 1,
    exit: 2,
    change: r => {
      firstStop(r).followup = undefined;
    },
  },
  {
    name: 'wrong reason',
    index: 1,
    exit: 2,
    change: r => {
      firstStop(r).followup = 'unrelated instruction';
    },
  },
  {
    name: 'disabled correction',
    index: 0,
    exit: 2,
    change: r => {
      firstStop(r).followup = 'terminal-handoff/v1 correction';
    },
  },
  {
    name: 'missing cap',
    index: 1,
    exit: 3,
    change: r => {
      r.cap = undefined;
    },
  },
  {
    name: 'wrong limit',
    index: 1,
    exit: 2,
    change: r => {
      cap(r).skip.limit = 2;
    },
  },
  {
    name: 'foreign response',
    index: 1,
    exit: 2,
    change: r => {
      cap(r).response.input.conversation_id = 'foreign';
    },
  },
  {
    name: 'same generation response',
    index: 1,
    exit: 2,
    change: r => {
      cap(r).response.input.generation_id = firstStop(r).input.generation_id;
    },
  },
  {
    name: 'empty response',
    index: 1,
    exit: 2,
    change: r => {
      cap(r).response.input.text = '';
    },
  },
  {
    name: 'missing edit',
    index: 1,
    exit: 3,
    change: r => {
      r.edit = undefined;
    },
  },
  {
    name: 'foreign edit',
    index: 1,
    exit: 3,
    change: r => {
      edit(r).callback.input.conversation_id = 'foreign';
    },
  },
  {
    name: 'stale edit',
    index: 1,
    exit: 3,
    change: r => {
      edit(r).callback.input.generation_id = 'stale';
    },
  },
  {
    name: 'wrong effect',
    index: 1,
    exit: 2,
    change: r => {
      edit(r).after = edit(r).before;
    },
  },
  {
    name: 'history foreign',
    index: 6,
    exit: 3,
    change: r => {
      firstStop(r).input.conversation_id = 'foreign';
    },
  },
  {
    name: 'history stale',
    index: 6,
    exit: 3,
    change: r => {
      firstStop(r).input.generation_id = '';
    },
  },
];

function firstStop(row: CursorHandoffObservation) {
  const stop = row.stops[0];
  assert.ok(stop);
  return stop;
}
function cap(row: CursorHandoffObservation) {
  assert.ok(row.cap);
  return row.cap;
}
function edit(row: CursorHandoffObservation) {
  assert.ok(row.edit);
  return row.edit;
}

function assertSettings(observed: CursorHandoffObservation[], indices: number[]) {
  const initial = observed[0],
    prior = observed[5],
    history = observed[6];
  assert.ok(initial && prior && history);
  for (const [index, row] of observed.entries())
    assertSetting(row, indices[index] ?? -1, initial.installation);
  expect(firstStop(history).input.conversation_id).toBe(firstStop(prior).input.conversation_id);
  expect(firstStop(history).input.generation_id).not.toBe(firstStop(prior).input.generation_id);
}

async function assertFaults(
  observed: CursorHandoffObservation[],
  retained: RetainedPolicyActor,
  root: string,
) {
  // Captured grader-only faults: never change native output, the expected fixture, or another case.
  for (const fault of faults) {
    let altered: CursorHandoffObservation | undefined;
    const run = await runHandoffSettings(
      captureNativePropagationActor(
        {
          ...retained,
          observeHandoff: setting => {
            const fixtureIndex = setting.currentTool
              ? combinations.findIndex(
                  options => JSON.stringify(options) === JSON.stringify(setting.options),
                )
              : 6;
            const row = structuredClone(observed[fixtureIndex]);
            if (!row) throw new Error('missing fixture');
            if (fixtureIndex === fault.index) {
              fault.change(row);
              altered = row;
            }
            return Promise.resolve(row);
          },
        },
        fault.name,
        root,
      ),
    );
    expect(run.exit, fault.name).toBe(fault.exit);
    expect(run.failures).toEqual([
      `PROPAGATION_HANDOFF_SETTING:${fault.index}:${fault.exit === 3 ? 'UNOBSERVED' : 'MISMATCH'}`,
    ]);
    const ledger = readFileSync(nodePath.join(root, 'observations.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line))
      .filter(row => row.lane === fault.name);
    const position = run.caseIndices.indexOf(fault.index);
    const saved = readFileSync(ledger[position].observation_artifact, 'utf8');
    expect(JSON.parse(saved)).toEqual(altered);
  }
}

function assertDecoder(raw: string, workspace: string) {
  const records = nativeHookRecords(raw);
  const request = records.find(row => row.input.hook_event_name === 'preToolUse');
  const callback = records.find(row => row.input.hook_event_name === 'afterFileEdit');
  const stop = records.find(row => row.input.hook_event_name === 'stop');
  assert.ok(request && callback && stop);
  const context = {
    action: request.words.slice(1),
    edit: callback.words.slice(1),
    stop: stop.words.slice(1),
    workspace,
    version: hostReleases.cursorIde.version,
    file: request.input.tool_input?.file_path ?? '',
    content: request.input.tool_input?.content ?? '',
  };
  expect(nativeHandoffEdit(raw, context).callback.raw).toBe(callback.raw);
  for (const change of [
    { conversation_id: 'foreign' },
    { generation_id: 'foreign' },
    { file_path: 'foreign' },
    { cursor_version: 'foreign' },
    { workspace_roots: ['foreign'] },
    { hook_event_name: 'foreign' },
  ]) {
    const altered = callback.raw.replace(JSON.stringify(callback.input), () =>
      JSON.stringify({ ...callback.input, ...change }),
    );
    expect(() =>
      nativeHandoffEdit(
        raw.replace(callback.raw, () => altered),
        context,
      ),
    ).toThrow();
  }
  expect(() =>
    nativeHandoffEdit(raw, { ...context, edit: ['foreign', ...context.edit.slice(1)] }),
  ).toThrow();
}

function assertSetting(row: CursorHandoffObservation, index: number, installation: string) {
  expect(JSON.parse(row.configuration.bytes)).toMatchObject(
    combinations[index] ?? combinations[1] ?? {},
  );
  expect(row.configuration.after).toBe(row.configuration.bytes);
  expect(row.stops.map(s => s.input.loop_count)).toEqual([0]);
  expect(Boolean(row.edit)).toBe(index < 6);
  expect(Boolean(row.cap)).toBe(index === 1 || index === 3);
  expect(row.installation).toBe(installation);
}
