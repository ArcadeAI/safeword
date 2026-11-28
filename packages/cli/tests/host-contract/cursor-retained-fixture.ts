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
import path from 'node:path';

import { expect } from 'vitest';

import hostReleases from '../../src/lifecycle/host-releases.json';
import options from '../fixtures/host-contract/documented-option-composition.json';
import architecture from '../fixtures/host-contract/propagation-architecture-case.json';
import { CursorNativeCatalogueActor } from '../helpers/cursor-native-catalogue.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { createPropagationSource } from '../helpers/propagation-source.js';

/** Replace only the IDE transport; execute each actual installed hook. */
export async function prepareCursorRetainedFixture(delivery: 'portable' | 'project-hooks') {
  const temporary = mkdtempSync(path.join(tmpdir(), 'cursor-retained-'));
  const root = realpathSync(temporary);
  const profile = path.join(root, 'profile');
  mkdirSync(path.join(profile, 'logs'), { recursive: true });
  const log = path.join(profile, 'logs/cursor.hooks.workspaceId-owned.log');
  let conversation = '';
  let generation = 0;
  class SourceWindow extends CursorNativeCatalogueActor {
    private readonly configurations = new Set<string>();
    protected override async prepareHost() {}
    protected override launchWindow() {
      return Promise.reject(new Error('SOURCE_READY'));
    }
    protected override hookConfigurationLoads() {
      this.configurations.add(
        readFileSync(path.join(this.workspace, '.cursor/hooks.json'), 'utf8'),
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
      const extension = path.join(this.runDirectory, 'extension');
      const manifest = JSON.parse(
        readFileSync(path.join(this.workspace, '.cursor/hooks.json'), 'utf8'),
      );
      const binding =
        delivery === 'portable'
          ? `bun ${JSON.stringify(path.join(extension, 'runtime/dispatch.js'))} stop:0`
          : manifest.hooks.stop[0].command;
      const observer = manifest.hooks.afterAgentResponse.find((row: { command: string }) =>
        row.command.includes('architecture-response-observer'),
      ).command;
      const invoke = (event: string, command: string, turn: string, text?: string) => {
        const input = {
          hook_event_name: event,
          conversation_id: conversation,
          generation_id: turn,
          cursor_version: hostReleases.cursorIde.version,
          workspace_roots: [this.workspace],
          status: event === 'stop' ? 'completed' : undefined,
          loop_count: event === 'stop' ? 0 : undefined,
          text,
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
      const turn = `generation-${++generation}`;
      invoke('afterAgentResponse', observer, turn, 'READY');
      appendFileSync(
        log,
        'Hook step requested: stop\nExecuting hook 1/1 from claude-plugin config\n',
      );
      const output = JSON.parse(invoke('stop', binding, turn));
      if (output.followup_message) {
        invoke(
          'afterAgentResponse',
          observer,
          `generation-${++generation}`,
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
  try {
    await expect(
      actor.prepare('Cursor', hostReleases.cursorIde.version, 'IDE', delivery),
    ).rejects.toThrow('SOURCE_READY');
    const enabled = options[2];
    if (!enabled) throw new Error('documented option fixture missing');
    const prior = await actor.observeArchitecture(
      '**PR Scope:** ✅ Synthetic fixture matches its scope\n',
      {
        ...architecture,
        options: enabled,
      },
    );
    return {
      actor,
      prior,
      root,
      close: () => {
        rmSync(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}
