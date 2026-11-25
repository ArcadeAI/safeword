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

import { runArchitectureSettings } from '../../scripts/lib/propagation-settings.js';
import type {
  PolicyObservation,
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
  nativeArchitectureCap,
  nativeArchitectureStops,
} from '../helpers/cursor-native-observations.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { createPropagationSource } from '../helpers/propagation-source.js';

// Source process integration: only the vendor window/turn transport is replaced.
// Every Stop output comes from the real normal installed/generated hook.
it.each(['portable', 'project-hooks'])(
  'captures six real Cursor Stop architecture cases through %s',
  async delivery => {
    const temporary = mkdtempSync(nodePath.join(tmpdir(), 'cursor-architecture-'));
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
      const retained = retainNativeResourceActor(actor);
      const captured = captureNativePropagationActor(retained, delivery, root);
      const result = await runArchitectureSettings(
        captured,
        '**PR Scope:** ✅ Synthetic fixture matches its scope\n',
      );
      expect(result.exit, result.failures.join('\n')).toBe(0);
      expect(result.observations).toHaveLength(6);
      for (const [index, observed] of result.observations.entries()) {
        expect(observed.protocol).toBe('cursor-stop');
        if (observed.protocol !== 'cursor-stop')
          throw new Error('Missing real Cursor Stop projection');
        expect(JSON.parse(observed.observation.configuration.bytes)).toMatchObject(
          combinations[index] ?? {},
        );
        expect(observed.observation.configuration.after).toBe(
          observed.observation.configuration.bytes,
        );
        expect(observed.observation.stops.map(row => row.input.loop_count)).toEqual([0]);
        expectHostCap(observed.observation, Boolean(combinations[index]?.architectureReviewGate));
        expect(readFileSync(observed.observation.rawPath, 'utf8')).toContain(
          observed.observation.stops[0]?.input.conversation_id,
        );
      }
      // Grader-only fault double: alter a returned projection, never the real hook or raw record.
      let row = 0;
      const wrong = captureNativePropagationActor(
        {
          ...retained,
          observeVerification: () => {
            const actual = result.observations[row++];
            if (actual?.protocol !== 'cursor-stop') throw new Error('Missing source observation');
            return Promise.resolve({
              ...actual,
              observation: {
                ...actual.observation,
                stops: actual.observation.stops.map(stop => ({
                  ...stop,
                  followup: stop.followup ? 'unrelated requirement' : undefined,
                })),
              },
            });
          },
        },
        'wrong-outcome-unit',
        root,
      );
      const rejected = await runArchitectureSettings(wrong, 'unused by this unit double');
      expect(rejected.exit).toBe(2);
      expect(rejected.failures).toContain('PROPAGATION_ARCHITECTURE_SETTING:2:OUTCOME_MISMATCH');
      const saved = readFileSync(nodePath.join(root, 'observations.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as { lane: string; observation_artifact: string })
        .filter(entry => entry.lane === 'wrong-outcome-unit')[2];
      expect(
        JSON.parse(readFileSync(saved?.observation_artifact ?? '', 'utf8')).stops[0].followup,
      ).toBe('unrelated requirement');

      await assertCapturedGraderFaults(result.observations, retained, root);

      // A dropped request flag must not mutate the expected fixture/oracle.
      const dropped = captureNativePropagationActor(
        {
          ...retained,
          observeVerification: (a, b, setting) =>
            retained.observeVerification(
              a,
              b,
              setting && {
                ...setting,
                options: { ...setting.options, architectureReviewGate: false },
              },
            ),
        },
        'dropped',
        root,
      );
      const fault = await runArchitectureSettings(
        dropped,
        '**PR Scope:** ✅ Synthetic fixture matches its scope\n',
      );
      expect(fault.exit).toBe(2);
      expect(fault.failures).toContain('PROPAGATION_ARCHITECTURE_SETTING:2:CONFIGURATION_MISMATCH');
      expect(readFileSync(nodePath.join(root, 'observations.jsonl'), 'utf8')).toContain('policy');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  120_000,
);

// Decoder faults use qualified process records, never native conformance receipts.
it('refuses foreign, missing and incomplete configured Stop provenance', () => {
  const args = ['/owned/extension/runtime/dispatch.js', 'stop:0'];
  const context = {
    workspace: '/owned/workspace',
    version: hostReleases.cursorIde.version,
    conversation: 'owned-conversation',
  };
  const input = {
    hook_event_name: 'stop',
    status: 'completed',
    loop_count: 0,
    conversation_id: context.conversation,
    generation_id: 'generation-0',
    cursor_version: context.version,
    workspace_roots: [context.workspace],
  };
  const record = (overrides = {}, command = args, exit = 0) =>
    `Command: bun ${command.join(' ')} (23ms) exit code: ${exit}\n\nINPUT:\n${JSON.stringify({ ...input, ...overrides })}\n\nOUTPUT:\n{}\n════════════════\n`;
  expect(nativeArchitectureStops(record(), args, context)[0]?.input).toEqual(input);
  for (const log of [
    '',
    record({}, ['/owned/extension-sibling/runtime/dispatch.js', 'stop:0']),
    record({}, [args[0] ?? '', 'stop:1']),
    record({}, args, 2),
    record({ status: 'running' }),
    record({ conversation_id: 'foreign' }),
    record({ generation_id: '' }),
    record({ cursor_version: 'unobserved' }),
    record({ workspace_roots: ['/foreign'] }),
    record({ hook_event_name: 'afterAgentResponse' }),
    record() + record(),
  ])
    expect(() => nativeArchitectureStops(log, args, context)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE',
    );
});

// Grader-only doubles: mutate projections, never installed hooks or native records.
async function assertCapturedGraderFaults(
  observations: PolicyObservation[],
  retained: RetainedPolicyActor,
  root: string,
) {
  type Facts = Extract<PolicyObservation, { protocol: 'cursor-stop' }>['observation'];
  const cases: { name: string; index: number; failure: string; alter: (facts: Facts) => Facts }[] =
    [
      {
        name: 'config-after',
        index: 2,
        failure: 'CONFIGURATION_CHANGED',
        alter: facts => ({
          ...facts,
          configuration: { ...facts.configuration, after: `${facts.configuration.after}\n` },
        }),
      },
      {
        name: 'loop1-followup',
        index: 2,
        failure: 'OUTCOME_MISMATCH',
        alter: facts => ({
          ...facts,
          stops: [
            ...facts.stops,
            ...facts.stops.map(row => ({
              ...row,
              input: { ...row.input, loop_count: 1 },
              followup: 'another continuation',
            })),
          ],
        }),
      },
      {
        name: 'wrong-cap',
        index: 2,
        failure: 'OUTCOME_MISMATCH',
        alter: facts => ({
          ...facts,
          cap: facts.cap && { ...facts.cap, skip: { ...facts.cap.skip, limit: 2 } },
        }),
      },
      {
        name: 'incomplete-response',
        index: 2,
        failure: 'OUTCOME_MISMATCH',
        alter: facts => ({
          ...facts,
          cap: facts.cap && {
            ...facts.cap,
            response: { ...facts.cap.response, input: { ...facts.cap.response.input, text: '' } },
          },
        }),
      },
      {
        name: 'extra-loop1',
        index: 2,
        failure: 'OUTCOME_MISMATCH',
        alter: facts => ({ ...facts, stops: [...facts.stops, ...facts.stops] }),
      },
      {
        name: 'missing-loop1',
        index: 2,
        failure: 'OUTCOME_MISMATCH',
        alter: facts => ({ ...facts, cap: undefined }),
      },
      {
        name: 'disabled-followup',
        index: 1,
        failure: 'OUTCOME_MISMATCH',
        alter: facts => ({
          ...facts,
          stops: facts.stops.map(row => ({ ...row, followup: 'another requirement' })),
        }),
      },
    ];
  for (const { name, index, failure, alter } of cases) {
    const actual = observations[index];
    if (actual?.protocol !== 'cursor-stop') throw new Error('Missing source observation');
    const observed = alter(structuredClone(actual.observation));
    const altered = { ...actual, observation: observed };
    let current = 0;
    const unit = captureNativePropagationActor(
      {
        ...retained,
        observeVerification: () => {
          const source = observations[current];
          if (!source) throw new Error('Missing source case');
          return Promise.resolve(current++ === index ? altered : source);
        },
      },
      name,
      root,
    );
    const graded = await runArchitectureSettings(unit, 'unused by grader-only double');
    expect(graded.exit).toBe(2);
    expect(graded.failures).toEqual([`PROPAGATION_ARCHITECTURE_SETTING:${index}:${failure}`]);
    expect(graded.observations[index]).toBe(altered);
    const entry = readFileSync(nodePath.join(root, 'observations.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as { lane: string; observation_artifact: string })
      .filter(record => record.lane === name)[index];
    expect(JSON.parse(readFileSync(entry?.observation_artifact ?? '', 'utf8'))).toEqual(observed);
  }
}

it('binds a host cap to one window, managed callback and completed automatic response', () => {
  // Qualified source records only; no native proof or injected managed second Stop.
  const args = ['/owned/runtime/dispatch.js', 'stop:0'];
  const observer = ['/observer.ts', 'response'];
  const context = {
    workspace: '/owned/workspace',
    version: hostReleases.cursorIde.version,
    conversation: 'owned',
  };
  const binding = {
    path: '/owned/hooks.json',
    bytes: 'retained manifest',
    command: 'bun /owned/runtime/dispatch.js stop:0',
    loopLimit: 1,
  };
  const input = {
    conversation_id: 'owned',
    generation_id: 'initial',
    cursor_version: context.version,
    workspace_roots: [context.workspace],
    hook_event_name: 'stop',
    loop_count: 0,
    status: 'completed',
  };
  const block = (command: string[], fields: object, output: string) =>
    `Command: bun ${command.join(' ')} (23ms) exit code: 0\n\nINPUT:\n${JSON.stringify(fields)}\n\nOUTPUT:\n${output}\n════════════════\n`;
  const initial = `Hook step requested: stop\nExecuting hook 1/1 from claude-plugin config\n${block(args, input, '{"followup_message":"cited evidence required"}')}`;
  const response = block(
    observer,
    {
      ...input,
      generation_id: 'automatic',
      hook_event_name: 'afterAgentResponse',
      text: 'Evidence remains missing.',
    },
    '(empty)',
  );
  const skip =
    'Hook step requested: stop\nExecuting hook 1/1 from claude-plugin config\nHook 1 skipped due to loop limit (loop_count=1, limit=1)\n';
  const log = initial + response + skip;
  const decode = (text: string, limit = 1) =>
    nativeArchitectureCap([{ path: '/owned/window.log', text }], args, observer, context, {
      ...binding,
      loopLimit: limit,
    });
  expect(decode(log).response.input).toMatchObject({
    conversation_id: 'owned',
    generation_id: 'automatic',
    hook_event_name: 'afterAgentResponse',
    text: 'Evidence remains missing.',
  });
  for (const bad of [
    initial + response,
    initial + response + skip.replace('limit=1)', 'limit=2)'),
    initial + response + skip.replace('claude-plugin config', 'foreign config'),
    initial + skip,
    initial + response.replace('Evidence remains missing.', '') + skip,
    initial + response.replace('"owned"', '"foreign"') + skip,
    initial + response.replace('"automatic"', '"initial"') + skip,
    initial + response.replace('/observer.ts response', '/foreign.ts response') + skip,
    log + skip,
  ])
    expect(() => decode(bad)).toThrow();
  expect(() => decode(log, 2)).toThrow('wrong host cap');
  expect(() =>
    nativeArchitectureCap(
      [
        { path: '/first', text: initial },
        { path: '/foreign', text: response + skip },
      ],
      args,
      observer,
      context,
      binding,
    ),
  ).toThrow();
});

function expectHostCap(
  facts: Extract<PolicyObservation, { protocol: 'cursor-stop' }>['observation'],
  enabled: boolean,
) {
  if (!enabled) {
    expect(facts.cap).toBeUndefined();
    return;
  }
  expect(facts.cap?.skip).toMatchObject({ loop: 1, limit: 1 });
  expect(facts.cap?.binding.loopLimit).toBe(1);
  expect(facts.cap?.response.input).toMatchObject({
    hook_event_name: 'afterAgentResponse',
    conversation_id: facts.stops[0]?.input.conversation_id,
  });
  expect(facts.cap?.response.input.text).not.toBe('');
}
