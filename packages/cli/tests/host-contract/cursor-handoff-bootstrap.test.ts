import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
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
import {
  captureNativePropagationActor,
  retainNativeResourceActor,
} from '../../scripts/lib/resource-propagation-run.js';
import hostReleases from '../../src/lifecycle/host-releases.json';
import { CursorNativeCatalogueActor } from '../helpers/cursor-native-catalogue.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { createPropagationSource } from '../helpers/propagation-source.js';
// Fake only the external window/model/file-edit transport. All registered guard outputs are real.
it.each([
  ['portable', false],
  ['project-hooks', false],
  ['portable', true],
  ['project-hooks', true],
] as const)(
  'requires read-only preparation before current edit through %s (legacy request=%s)',
  async (delivery, legacy) => {
    const temporary = mkdtempSync(nodePath.join(tmpdir(), 'cursor-bootstrap-'));
    const root = realpathSync(temporary);
    const profile = nodePath.join(root, 'profile');
    mkdirSync(nodePath.join(profile, 'logs'), { recursive: true });
    const log = nodePath.join(profile, 'logs/cursor.hooks.workspaceId-owned.log');
    let conversation = '',
      generation = 0,
      prepared = false;
    class SourceWindow extends CursorNativeCatalogueActor {
      private readonly configurations = new Set<string>();
      private prepareReads(prompt: string) {
        if (prompt.startsWith('Read ')) prepared = readBootstrap(prompt, delivery, legacy);
      }
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
        conversation = `${nodePath.basename(root)}-${++generation}`;
        prepared = false;
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
        this.prepareReads(prompt);
        const match = requestedWrite(prompt, prepared);
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
      const run = runHandoffSettings(
        captureNativePropagationActor(retainNativeResourceActor(actor), delivery, root),
      );
      if (legacy) {
        await expect(run).rejects.toThrow('design Write cardinality');
        expect(existsSync(nodePath.join(actor.workspace, '.host-contract/handoff-edit.txt'))).toBe(
          false,
        );
      } else {
        const result = await run;
        expect(result.exit, 'CURSOR_BOOTSTRAP_READS_REQUIRED').toBe(0);
        expect(result.observations).toHaveLength(7);
        assertHistory(result);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

function readBootstrap(prompt: string, delivery: string, legacy: boolean) {
  const effective = legacy ? 'Report-only setup. Use no tools. Reply only READY and stop.' : prompt;
  if (!effective.startsWith('Read ')) return false;
  const documents = effective
    .matchAll(/"([^"\n]+)"/gu)
    .map(match => match[1] ?? '')
    .toArray();
  expect(documents).toHaveLength(delivery === 'portable' ? 3 : 2);
  const bodies = documents.map(path => readFileSync(path, 'utf8'));
  expect(bodies.some(body => body.includes('standing operating model'))).toBe(true);
  expect(bodies.some(body => body.includes('Testing Guide'))).toBe(true);
  return true;
}
function assertHistory(result: Awaited<ReturnType<typeof runHandoffSettings>>) {
  const before = result.observations[5],
    history = result.observations[6];
  if (!before || !history || !('protocol' in before) || !('protocol' in history))
    throw new Error('Missing Cursor facts');
  const prior = before.stops[0],
    next = history.stops[0];
  expect(prior).toBeDefined();
  expect(next).toBeDefined();
  if (!prior || !next || !before.edit) throw new Error('Missing edit/Stop facts');
  expect(before.edit.after).toBe(before.edit.expected);
  expect(history.edit).toBeUndefined();
  expect(next.input.conversation_id).toBe(prior.input.conversation_id);
  expect(next.input.generation_id).not.toBe(prior.input.generation_id);
  expect(history.fileEffect.after).toBe(history.fileEffect.before);
}
function requestedWrite(prompt: string, prepared: boolean) {
  return (
    prepared &&
    /Use Write exactly once on ("[^"\n]+") with exact complete content ("(?:[^"\\]|\\.)*")\./u.exec(
      prompt,
    )
  );
}
