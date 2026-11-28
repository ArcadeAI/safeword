import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  assertInvocationPopulation,
  invocationResult,
  type InvocationScenarioResult,
  selectedInvocationCases,
} from '../../scripts/check-codex-internal-workflows.js';
import conjunction from '../fixtures/host-contract/codex-conjunction-read-call.json' with { type: 'json' };
import laterDynamic from '../fixtures/host-contract/codex-later-dynamic-call.json' with { type: 'json' };
import captured from '../fixtures/host-contract/codex-literal-root-call.json' with { type: 'json' };
import newline from '../fixtures/host-contract/codex-newline-read-call.json' with { type: 'json' };
import { codexInternalCases } from '../fixtures/host-contract/native-contract-cases.js';
import { preservationEmbedding } from '../fixtures/host-contract/preservation-control.js';
import { initializeWorkflowGit } from '../helpers/codex-workflow-git.js';
import {
  assertNodeTests,
  automaticCatalogue,
  handoffTarget,
  type NativeTurn,
  nativeTurn,
  resourceLoad,
  type Rollout,
} from '../helpers/codex-workflow-observation.js';
import {
  CodexWorkflowRuntimeActor,
  runWorkflowGenerator,
} from '../helpers/codex-workflow-runtime.js';
import { createContractRepoFixture } from '../helpers/contract-repo-fixture.js';

const repo = path.resolve(import.meta.dirname, '../../../..');
const roots: string[] = [];
const temporary = () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-runtime-controls-'));
  const root = realpathSync(directory);
  roots.push(root);
  return root;
};
function seedNodeInputs(project: string) {
  writeFileSync(path.join(project, 'package.json'), '{"type":"module"}');
  writeFileSync(
    path.join(project, 'clamp.js'),
    'export function clamp(v,min,max){return Math.min(max,Math.max(min,v));}',
  );
  CodexWorkflowRuntimeActor.prototype.seedReviewTests.call({
    project,
  } as unknown as CodexWorkflowRuntimeActor);
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('native workflow harness protocol controls (not native evidence)', () => {
  it.each(['', '5.8\ncd\nif\n', '5.9\nforeign-builtin\n', '5.9\n', 'failed'])(
    'rejects unavailable shell language before dispatch: %j',
    probe => {
      const project = temporary(),
        artifacts = temporary();
      seedNodeInputs(project);
      initializeWorkflowGit(project, artifacts, ['package.json', 'clamp.js']);
      let dispatched = false;
      const unit = {
        project,
        artifacts,
        profile: '/owned/profile',
        installed: '/owned/installed',
        sequence: 0,
        markers: {},
        coreMarker: 'UNIT_CORE',
        fixture: { binary: '/unit-native' },
        command(program: string, args: string[], _label: string, cwd: string) {
          if (program === '/bin/zsh') {
            expect(args[0]).toBe('-lc');
            expect(args[1]).toContain('zmodload zsh/parameter');
            expect(cwd).toBe(project);
            if (probe === 'failed')
              throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: shell language process');
            return probe;
          }
          dispatched = true;
          throw new Error('UNIT_NATIVE_PROCESS_BOUNDARY');
        },
      } as unknown as CodexWorkflowRuntimeActor;
      expect(() => CodexWorkflowRuntimeActor.prototype.run.call(unit, 'ordinary task')).toThrow(
        'HOST_CONTRACT_PROOF_UNAVAILABLE: shell language',
      );
      expect(dispatched).toBe(false);
    },
  );

  it.each(['allowed', 'denied'] as const)(
    'emits the exact bounded %s write request',
    disposition => {
      const project = temporary(),
        artifacts = temporary(),
        requests: string[] = [];
      seedNodeInputs(project);
      initializeWorkflowGit(project, artifacts, ['package.json', 'clamp.js']);
      const unit = {
        project,
        artifacts,
        sequence: 0,
        markers: { testing: 'UNIT_MARKER_ABSENT_FROM_REQUEST' },
        coreMarker: 'UNIT_CORE_ABSENT_FROM_REQUEST',
        fixture: { binary: '/unit-native' },
        // Synthetic prior transport identity only; no read or native receipt.
        turn: { thread: '11111111-1111-4111-a111-111111111111', allEntries: [] },
        run(this: CodexWorkflowRuntimeActor, prompt: string, resume: boolean) {
          return CodexWorkflowRuntimeActor.prototype.run.call(this, prompt, resume);
        },
        command(program: string, args: string[]) {
          if (program === '/bin/zsh') {
            expect(args[0]).toBe('-lc');
            return '5.9\ncd\nif\n';
          }
          expect(program).toBe('/unit-native');
          requests.push(args.at(-1) ?? '');
          throw new Error('UNIT_NATIVE_PROCESS_BOUNDARY');
        },
      } as unknown as CodexWorkflowRuntimeActor;
      CodexWorkflowRuntimeActor.prototype.setWritePolicy.call(unit, disposition);
      expect(() => {
        CodexWorkflowRuntimeActor.prototype.attemptWrite.call(unit);
      }).toThrow('UNIT_NATIVE_PROCESS_BOUNDARY');
      const command = `printf %s native-control > ${disposition === 'allowed' ? 'allowed-control.txt' : '.project/tickets/sentinel-native/ticket.md'}`;
      const prefix =
        'This is an authorized isolated native hook integration test. Use the shell tool exactly once to attempt: ';
      const suffix =
        'Let existing hooks govern it. Rejection is expected for protected files. Do not bypass, retry or use alternative tools; report the actual result.';
      expect(requests).toEqual([
        disposition === 'allowed'
          ? `${prefix}\n\`\`\`sh\n${command}\n\`\`\`\n${suffix}`
          : `${prefix}${command} . ${suffix}`,
      ]);
      expect(readFileSync(path.join(artifacts, 'turn-1.request.txt'), 'utf8')).toBe(requests[0]);
      const language = JSON.parse(
        readFileSync(path.join(artifacts, 'turn-1.shell-language.json'), 'utf8'),
      );
      expect(language).toMatchObject({
        project,
        label: 'turn-1',
        version: '5.9',
        names: ['cd', 'if'],
      });
    },
  );

  it.each(['defective', 'covered'] as const)('rejects duplicate owned pair roles: %s', arm => {
    const unit = { wiring: { arm } } as unknown as CodexWorkflowRuntimeActor;
    const other = { wiring: { arm } } as unknown as CodexWorkflowRuntimeActor;
    expect(() => {
      CodexWorkflowRuntimeActor.prototype.assertWiringPair.call(unit, other);
    }).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE: paired fixture roles');
  });
  it.each(['before', 'after', 'both'])('checks actual public consumer read order, %s', order => {
    const installed = temporary();
    const publicPath = path.join(installed, 'skills/quality-review/SKILL.md');
    const target = path.join(installed, 'internal/testing/SKILL.md');
    mkdirSync(path.dirname(publicPath), { recursive: true });
    mkdirSync(path.dirname(target), { recursive: true });
    const body = '<!-- TESTING_CONTROL -->\nCurrent complete testing procedure.\n';
    const publicBody =
      '<!-- REVIEW_CONTROL -->\nSee `../../internal/testing/SKILL.md` → Wiring Tests.\n';
    writeFileSync(target, body);
    writeFileSync(publicPath, publicBody);
    const skill = {
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ text: `<skill>\n<path>${publicPath}</path>\n${publicBody}</skill>` }],
      },
    };
    const command = `sed -n '1,620p' '${target}'`;
    const read = [
      {
        type: 'response_item',
        payload: {
          type: 'function_call',
          call_id: 'read',
          arguments: JSON.stringify({ cmd: command }),
        },
      },
      {
        type: 'response_item',
        payload: { type: 'function_call_output', call_id: 'read', output: body },
      },
    ];
    const laterCommand = `sed -n '1,621p' '${target}'`;
    const laterRead = read.map(entry => ({
      ...entry,
      payload: {
        ...entry.payload,
        call_id: 'later',
        ...(entry.payload.type === 'function_call' && {
          arguments: JSON.stringify({ cmd: laterCommand }),
        }),
      },
    }));
    const unit = {
      installed,
      markers: { review: 'REVIEW_CONTROL', testing: 'TESTING_CONTROL' },
      turn: {
        entries:
          order === 'after'
            ? [skill, ...read]
            : [...read, skill, ...(order === 'both' ? laterRead : [])],
        events: [
          {
            type: 'item.completed',
            item: {
              type: 'command_execution',
              exit_code: 0,
              command: `/bin/zsh -lc '${command.replaceAll("'", "'\"'\"'")}'`,
              aggregated_output: body,
            },
          },
          ...(order === 'both'
            ? [
                {
                  type: 'item.completed',
                  item: {
                    type: 'command_execution',
                    exit_code: 0,
                    command: `/bin/zsh -lc '${laterCommand.replaceAll("'", "'\"'\"'")}'`,
                    aggregated_output: body,
                  },
                },
              ]
            : []),
        ],
      },
      save() {},
    } as unknown as CodexWorkflowRuntimeActor;
    const check = () => {
      CodexWorkflowRuntimeActor.prototype.assertPublic.call(unit, 'quality-review');
    };
    if (order === 'before') {
      expect(check).toThrow('INTERNAL_WORKFLOW_UNMET');
    } else {
      expect(check).not.toThrow();
    }
  });
  it.each(['complete', 'partial', 'stale', 'foreign', 'none', 'marker-only'])(
    'selects earliest complete public evidence, earlier native context=%s',
    context => {
      // NONRECEIPT: real generated resources and real public-order caller; host boundary only.
      const installed = temporary();
      for (const relative of ['skills/quality-review/SKILL.md', 'internal/testing/SKILL.md']) {
        const target = path.join(installed, relative);
        mkdirSync(path.dirname(target), { recursive: true });
        cpSync(path.join(repo, 'packages/cli/codex-plugin', relative), target);
      }
      const publicPath = path.join(installed, 'skills/quality-review/SKILL.md');
      const target = path.join(installed, 'internal/testing/SKILL.md');
      const body = readFileSync(publicPath, 'utf8');
      const altered: Record<string, string> = {
        partial: body.slice(0, Math.floor(body.length / 2)),
        stale: body.replace('Deep review', 'Stale review'),
        'marker-only': 'name: quality-review',
        none: '',
      };
      const injected = altered[context] ?? body;
      const command = `cat '${publicPath}' && cat '${target}'`;
      const output = body + readFileSync(target, 'utf8');
      const turn: Pick<NativeTurn, 'entries' | 'events'> = {
        entries: [
          {
            type: 'response_item',
            payload: {
              type: 'message',
              role: 'user',
              content: [
                {
                  text: `<skill><path>${context === 'foreign' ? '/foreign/SKILL.md' : publicPath}</path>${injected}</skill>`,
                },
              ],
            },
          },
          {
            type: 'response_item',
            payload: {
              type: 'function_call',
              call_id: 'combined',
              arguments: JSON.stringify({ cmd: command }),
            },
          },
          {
            type: 'response_item',
            payload: { type: 'function_call_output', call_id: 'combined', output },
          },
        ],
        events: [
          {
            type: 'item.completed',
            item: {
              type: 'command_execution',
              exit_code: 0,
              command: `/bin/zsh -lc ${JSON.stringify(command)}`,
              aggregated_output: output,
            },
          },
        ],
      };
      const load = resourceLoad(turn, publicPath, 'name: quality-review', true);
      expect(load.completeBody).toBe(true);
      expect.soft(load.entryIndex).toBe(context === 'complete' ? 0 : 2);
      const unit = {
        installed,
        turn,
        markers: { review: 'name: quality-review', testing: 'name: testing' },
        save() {},
      } as unknown as CodexWorkflowRuntimeActor;
      const check = () => {
        CodexWorkflowRuntimeActor.prototype.assertPublic.call(unit, 'quality-review');
      };
      if (context === 'complete') {
        expect(check).not.toThrow();
        expect(
          resourceLoad({ ...turn, afterEntryIndex: 0 }, publicPath, 'name: quality-review', true)
            .entryIndex,
        ).toBe(2);
      } else expect(check).toThrow('INTERNAL_WORKFLOW_UNMET');
    },
  );
  it('asks public review to follow its existing reference without private hints', () => {
    const requests: string[] = [];
    const project = temporary();
    seedNodeInputs(project);
    const unit = {
      project,
      artifacts: temporary(),
      run(request: string) {
        requests.push(request);
      },
    } as unknown as CodexWorkflowRuntimeActor;
    CodexWorkflowRuntimeActor.prototype.invokePublic.call(unit, 'quality-review');
    CodexWorkflowRuntimeActor.prototype.invokePublic.call(unit, 'explain');
    CodexWorkflowRuntimeActor.prototype.testOrdinary.call(unit);
    CodexWorkflowRuntimeActor.prototype.resumeTesting.call(unit);
    expect(requests[0]).toMatch(/^\$safeword:quality-review /u);
    expect(requests[0]).toBe(
      '$safeword:quality-review Review clamp.js and clamp.test.js for behavior and wiring coverage. Follow its existing Optional examples reference for Wiring Tests. Make no source changes; run the normal review procedure and report actual findings. If you change directories before reviewing, use cd … && … so review stops if that fails.',
    );
    expect(requests[0]).toContain(
      'If you change directories before reviewing, use cd … && … so review stops if that fails.',
    );
    for (const request of requests)
      expect(request).not.toMatch(/safeword:testing|internal\/|SKILL\.md|RESOURCE_|testing-guide/u);
    expect(requests[1]).toBe(
      '$safeword:explain Explain the current work and the next concrete action. Make no changes.',
    );
    expect(requests.slice(2)).toEqual([
      'Please write focused tests for the existing clamp function using the built-in Node test runner, run them, and report the results.',
      'Please extend the focused tests for clamp to cover values inside the range, at and outside the bounds, and invalid bounds. Run the built-in Node tests and report the results.',
    ]);
  });
  it('bounds explicit reads to initial restart setup and preserves ordinary action requests', () => {
    const project = temporary();
    seedNodeInputs(project);
    const artifacts = temporary();
    const installed = path.join(temporary(), 'installed package');
    const calls: { request: string; resume: boolean }[] = [];
    const saved: Record<string, unknown> = {};
    // Unit transport substitute: no native read events or native success receipts.
    const unit = {
      project,
      artifacts,
      installed,
      seedReviewTests() {
        CodexWorkflowRuntimeActor.prototype.seedReviewTests.call(unit);
      },
      run(request: string, resume = false) {
        if (resume) {
          const baselineBytes = readFileSync(
            path.join(artifacts, 'node-baseline/clamp.test.js'),
            'utf8',
          );
          expect(baselineBytes).toBe(readFileSync(path.join(project, 'clamp.test.js'), 'utf8'));
          expect(baselineBytes).toContain('// actual A output');
        }
        calls.push({ request, resume });
        if (calls.length === 1)
          writeFileSync(
            path.join(project, 'clamp.test.js'),
            `${readFileSync(path.join(project, 'clamp.test.js'), 'utf8')}\n// actual A output\n`,
          );
      },
      save(label: string, value: unknown) {
        saved[label] = value;
      },
    } as unknown as CodexWorkflowRuntimeActor;
    CodexWorkflowRuntimeActor.prototype.establishRestartThread.call(unit);
    CodexWorkflowRuntimeActor.prototype.resumeTesting.call(unit);
    CodexWorkflowRuntimeActor.prototype.testOrdinary.call(unit);
    expect(calls).toHaveLength(3);
    expect(calls[0]?.request).toContain('For this initial setup turn only');
    for (const relative of ['internal/testing/SKILL.md', 'templates/guides/testing-guide.md'])
      expect(calls[0]?.request).toContain(`cat ${JSON.stringify(path.join(installed, relative))}`);
    expect(calls[0]?.request).toContain('node --test clamp.test.js');
    expect(calls[0]).toEqual({
      request: `For this initial setup turn only, use three separate native shell tool invocations: run cat ${JSON.stringify(path.join(installed, 'internal/testing/SKILL.md'))} and cat ${JSON.stringify(path.join(installed, 'templates/guides/testing-guide.md'))}, then run \`node --test clamp.test.js\`. Emit each whole unmodified result separately, without bundling or re-encoding.`,
      resume: false,
    });
    expect(calls[1]).toEqual({
      request:
        'Please extend the focused tests for clamp to cover values inside the range, at and outside the bounds, and invalid bounds. Run the built-in Node tests and report the results.',
      resume: true,
    });
    for (const action of calls.slice(1))
      expect(action.request).not.toMatch(
        /internal\/|SKILL\.md|testing-guide|RESOURCE_|initial setup/u,
      );
    expect(saved['restart-setup']).toMatchObject({ method: 'explicit-initial-A-reads' });
    expect(saved['restart-setup']).toMatchObject({
      causalLimit:
        'Prior explicit A paths and the setup output-format instruction remain in history and may shape B output. The resumed assertion proves current essential startup delivery, not a resumed procedure read, startup discovery alone or two consecutive ordinary turns.',
    });
    // The reused fixture is ordinary executable Node data, not a fake test-result control.
    writeFileSync(path.join(project, 'package.json'), '{"type":"module"}');
    writeFileSync(
      path.join(project, 'clamp.js'),
      'export const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));',
    );
    const node = spawnSync(process.execPath, ['--test', 'clamp.test.js'], {
      cwd: project,
      encoding: 'utf8',
    });
    expect(node.status, node.stderr).toBe(0);
    expect(node.stdout).toMatch(/tests 1/u);
  });
  it.each([newline, conjunction, laterDynamic])(
    'loads captured $call_id through actual resourceLoad',
    fixture => {
      const target = path.join(temporary(), 'installed-resource.md');
      mkdirSync(path.dirname(target), { recursive: true });
      const marker = 'NEWLINE_CALLER_UNIT_MARKER';
      writeFileSync(target, `Unit guide ${marker}`);
      const entries: Rollout = [
        {
          type: 'response_item',
          payload: {
            type: 'custom_tool_call',
            call_id: 'unit-guide',
            input: fixture.input.replaceAll(fixture.target, () => target),
          },
        },
        {
          type: 'response_item',
          payload: {
            type: 'custom_tool_call_output',
            call_id: 'unit-guide',
            output: readFileSync(target, 'utf8'),
          },
        },
      ];
      expect(resourceLoad(entries, target, marker)).toMatchObject({
        method: 'correlated-tool-read',
        callIds: ['unit-guide'],
      });
    },
  );
  it('uses the captured literal-root read through the actual runtime resourceLoad caller', () => {
    const installed = path.join(temporary(), 'package');
    const target = path.join(installed, 'internal/testing/SKILL.md');
    mkdirSync(path.dirname(target), { recursive: true });
    const marker = 'CALLER_ORACLE_UNIT_MARKER';
    writeFileSync(target, `Unit resource ${marker}`);
    const originalRoot = captured.target.slice(0, -'/internal/testing/SKILL.md'.length);
    const entries: Rollout = [
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          call_id: 'unit-read',
          input: captured.input.replaceAll(originalRoot, () => installed),
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'unit-read',
          output: readFileSync(target, 'utf8'),
        },
      },
    ];
    expect(resourceLoad(entries, target, marker)).toMatchObject({
      method: 'correlated-tool-read',
      callIds: ['unit-read'],
    });
    const call = entries[0]?.payload;
    if (!call) throw new Error('Missing unit call');
    for (const command of [
      'SKILL_ROOT=/wrong; cat "$SKILL_ROOT/internal/testing/SKILL.md"',
      `SKILL_ROOT=${installed}; SKILL_ROOT=/wrong; cat "$SKILL_ROOT/internal/testing/SKILL.md"`,
      'cat "$SKILL_ROOT/internal/testing/SKILL.md"',
      'SKILL_ROOT=$(pwd); cat "$SKILL_ROOT/internal/testing/SKILL.md"',
    ]) {
      call.input = `await tools.exec_command(${JSON.stringify({ cmd: command })})`;
      expect(() => resourceLoad(entries, target, marker)).toThrow('INTERNAL_WORKFLOW_UNMET');
    }
  });
  it('normally generates a clean source package before rejecting an actual removed resource', () => {
    const source = realpathSync(createContractRepoFixture());
    roots.push(path.dirname(source));
    const profile = path.join(temporary(), 'unused-generator-profile');
    const generated = runWorkflowGenerator(source, profile, false);
    expect(generated.status, generated.output).toBe(0);
    const clean = runWorkflowGenerator(source, profile, true);
    expect(clean.status, clean.output).toBe(0);
    rmSync(path.join(source, 'packages/cli/codex-plugin/internal/testing/SKILL.md'));
    const missing = runWorkflowGenerator(source, profile, true);
    expect(missing.status).not.toBe(0);
    expect(missing.output).toContain('internal/testing/SKILL.md');
  }, 90_000);
  it('selects feature-owned IDs and rejects omitted or filtered full-group populations', () => {
    const expected = codexInternalCases();
    expect(selectedInvocationCases(['--require-targets']).expected).toEqual(expected);
    for (const row of expected)
      expect(selectedInvocationCases(['--case', row.id, '--require-targets']).expected).toEqual([
        row,
      ]);
    expect(() => selectedInvocationCases(['--case', 'unknown', '--require-targets'])).toThrow(
      'unknown feature case ID',
    );
    const results: InvocationScenarioResult[] = expected.map(row => ({
      name: row.scenario,
      line: row.line,
      steps: [
        ...Array.from({ length: row.stepCount }, () => ({ result: { status: 'passed' } })),
        {
          hidden: true,
          keyword: 'After',
          result: { status: 'passed' },
          embeddings: preservationEmbedding(row.scenario),
        },
      ],
    }));
    expect(() => {
      assertInvocationPopulation(results, expected);
    }).not.toThrow();
    expect(invocationResult(results, 0)).toBe(0);
    const unrelatedAfter = results.map(row => ({
      ...row,
      steps: row.steps.map(step => (step.hidden ? { ...step, embeddings: [] } : step)),
    }));
    expect(invocationResult(unrelatedAfter, 0)).toBe(3);
    expect(() => {
      assertInvocationPopulation(results.slice(1), expected);
    }).toThrow('incomplete case population');
    expect(() => {
      assertInvocationPopulation(results.slice(0, 1), expected);
    }).toThrow();
    const first = results[0];
    expect(first).toBeDefined();
    if (!first) throw new Error('Missing control');
    for (const status of ['undefined', 'skipped', 'pending']) {
      first.steps[0] = { result: { status } };
      expect(invocationResult(results, 0)).toBe(3);
    }
    first.steps[0] = {
      result: { status: 'failed', error_message: 'HOST_CONTRACT_PROOF_UNAVAILABLE: sandbox' },
    };
    expect(invocationResult(results, 1)).toBe(3);
    first.steps = [
      {
        result: {
          status: 'failed',
          error_message: 'INTERNAL_WORKFLOW_UNMET: completed valid task omitted resource',
        },
      },
      {
        hidden: true,
        keyword: 'After',
        result: { status: 'passed' },
        embeddings: preservationEmbedding(first.name),
      },
    ];
    expect(invocationResult(results, 1)).toBe(2);
    first.steps[1] = { hidden: true, keyword: 'After', result: { status: 'failed' } };
    expect(invocationResult(results, 1)).toBe(3);
  });

  it('accepts a full exact public SDK skill body separately from an internal read', () => {
    const target = path.join(temporary(), 'SKILL.md');
    const marker = 'PRIVATE_BODY_CONTROL';
    const body = `<!-- ${marker} -->\n# Procedure\nBody text.\n`;
    writeFileSync(target, body);
    const context: Rollout = [
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ text: `<skill>\n<path>${target}</path>\n${body}</skill>` }],
        },
      },
    ];
    expect(resourceLoad(context, target, marker, true).method).toBe('native-skill-context');
    writeFileSync(target, `${body}\nMore canonical procedure.\n`);
    expect(resourceLoad(context, target, marker, true)).toMatchObject({
      method: 'native-skill-context',
      completeBody: false,
    });
    writeFileSync(target, body);
    expect(() => resourceLoad(context, target, marker)).toThrow('INTERNAL_WORKFLOW_UNMET');
    const prose: Rollout = [
      {
        type: 'response_item',
        payload: { type: 'message', role: 'assistant', content: [{ text: `${target}\n${body}` }] },
      },
    ];
    expect(() => resourceLoad(prose, target, marker, true)).toThrow('INTERNAL_WORKFLOW_UNMET');
    writeFileSync(target, `${body}${marker}`);
    expect(() => resourceLoad(context, target, marker, true)).toThrow('marker is not unique');
  });

  it('resolves the actual SDK alias representation for automatic catalogue exclusion', () => {
    expect(
      automaticCatalogue(
        '- `r2` = `/owned/plugin/skills`\n- safeword:bdd: Behavior (file: r2/bdd/SKILL.md)\n- other: Other (file: /other/SKILL.md)',
      ),
    ).toEqual([
      { name: 'bdd', path: '/owned/plugin/skills/bdd/SKILL.md' },
      { name: 'other', path: '/other/SKILL.md' },
    ]);
  });

  it('rejects a bare or wrongly anchored public handoff even when the internal body exists', () => {
    const root = temporary();
    const publicPath = path.join(root, 'skills/quality-review/SKILL.md');
    const internal = path.join(root, 'internal/testing/SKILL.md');
    mkdirSync(path.dirname(publicPath), { recursive: true });
    mkdirSync(path.dirname(internal), { recursive: true });
    writeFileSync(internal, 'Actual body.');
    for (const reference of ['testing/SKILL.md', '../internal/testing/SKILL.md']) {
      writeFileSync(publicPath, `See \`${reference}\` → Wiring Tests.`);
      expect(() => handoffTarget(publicPath, internal)).toThrow('projected Wiring gate');
    }
    writeFileSync(publicPath, 'See `../../internal/testing/SKILL.md` → Wiring Tests.');
    expect(handoffTarget(publicPath, internal)).toEqual({
      relative: '../../internal/testing/SKILL.md',
      resolved: internal,
    });
  });

  it('isolates the current resumed segment and preserves actual observed model identity', () => {
    const root = temporary();
    const thread = '00000000-0000-4000-8000-000000000001';
    mkdirSync(path.join(root, 'sessions'));
    const entries = [
      { type: 'response_item', payload: { type: 'message', content: [{ text: 'OLD_MARKER' }] } },
      { type: 'turn_context', payload: { model: 'observed-model' } },
    ];
    writeFileSync(
      path.join(root, 'sessions', `rollout-${thread}.jsonl`),
      entries.map(entry => JSON.stringify(entry)).join('\n'),
    );
    const stdout = `${JSON.stringify({ type: 'thread.started', thread_id: thread })}\n{"type":"turn.completed"}\n`;
    const turn = nativeTurn(root, stdout, 1, thread);
    expect(turn.entries).toEqual([entries[1]]);
    expect(turn.models).toEqual(['observed-model']);
    expect(() => nativeTurn(root, stdout, 1, '00000000-0000-4000-8000-000000000002')).toThrow(
      'different thread',
    );
    expect(() => nativeTurn(root, stdout.replace('turn.completed', 'turn.failed'))).toThrow(
      'incomplete native turn',
    );
  });

  it.each(['#', '\u{2139}'])(
    'requires a successful nonempty real Node summary in %s output format',
    prefix => {
      const turn = {
        events: [
          {
            type: 'item.completed',
            item: {
              type: 'command_execution',
              command: 'npm test',
              exit_code: 0,
              aggregated_output: `${prefix} tests 5\n${prefix} pass 5\n${prefix} fail 0`,
            },
          },
        ],
      } as NativeTurn;
      expect(() => {
        assertNodeTests(turn);
      }).not.toThrow();
      const item = turn.events[0]?.item;
      if (!item) throw new Error('Missing execution control');
      item.aggregated_output = `${prefix} tests 0\n${prefix} pass 0\n${prefix} fail 0`;
      expect(() => {
        assertNodeTests(turn);
      }).toThrow('INTERNAL_WORKFLOW_UNMET');
    },
  );

  it('binds all feature scenarios through real Cucumber without running native setup', () => {
    const root = temporary();
    const report = path.join(root, 'cucumber.json');
    const child = spawnSync(
      path.join(repo, 'scripts/dev'),
      [
        'node',
        '--import',
        'tsx',
        'node_modules/@cucumber/cucumber/bin/cucumber.js',
        '--config',
        'packages/cli/tests/fixtures/host-contract/cucumber.native-codex-internal-workflows.mjs',
        '--dry-run',
        '--format',
        `json:${report}`,
      ],
      {
        cwd: repo,
        encoding: 'utf8',
        timeout: 30_000,
        env: { ...process.env, SAFEWORD_CODEX_INTERNAL_CASE: '' },
      },
    );
    expect(child.error, child.stderr).toBeUndefined();
    expect(child.status, child.stderr).toBe(0);
    const cases = (
      JSON.parse(readFileSync(report, 'utf8')) as { elements: InvocationScenarioResult[] }[]
    ).flatMap(feature => feature.elements);
    assertInvocationPopulation(cases, codexInternalCases());
    expect(
      cases
        .flatMap(row => row.steps.filter(step => !step.hidden))
        .every(step => step.result.status === 'skipped'),
    ).toBe(true);
    expect(invocationResult(cases, 0)).toBe(3); // Binding availability is never runtime proof.
  }, 40_000);

  it('traverses the real generated closure in a foreign child and rejects a missing resource', () => {
    const root = temporary();
    const bundle = path.join(root, 'bundle');
    cpSync(path.join(repo, 'packages/cli/codex-plugin'), bundle, { recursive: true });
    const run = () =>
      spawnSync(
        path.join(repo, 'scripts/dev'),
        [
          'node',
          path.join(repo, 'packages/cli/tests/fixtures/host-contract/codex-workflow-closure.mjs'),
          bundle,
          path.join(repo, 'packages/cli/templates'),
        ],
        { cwd: root, encoding: 'utf8', timeout: 30_000 },
      );
    const clean = run();
    expect(clean.status, clean.stderr).toBe(0);
    const value = JSON.parse(clean.stdout) as {
      cwd: string;
      templates: unknown[];
      resources: unknown[];
      links: { from: string; relative: string }[];
    };
    expect(value.cwd).toBe(root);
    expect(value.templates.length).toBeGreaterThan(0);
    expect(value.resources.length).toBeGreaterThan(0);
    expect(value.links).toContainEqual(
      expect.objectContaining({
        from: 'skills/bdd/references/PLAN_EXECUTION.md',
        relative: 'skills/bdd/references/execution-plan-template.md',
      }),
    );
    const review = path.join(bundle, 'skills/quality-review/SKILL.md');
    const original = readFileSync(review, 'utf8');
    writeFileSync(
      review,
      original.replaceAll('../../internal/testing/SKILL.md', 'testing/SKILL.md'),
    );
    const brokenReference = run();
    expect(brokenReference.status).not.toBe(0);
    expect(brokenReference.stderr).toContain('testing/SKILL.md');
    writeFileSync(review, original);
    rmSync(path.join(bundle, 'internal/testing/SKILL.md'));
    const missing = run();
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain('internal/testing/SKILL.md');
  });
});
