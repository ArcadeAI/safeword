import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
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
import { promisify } from 'node:util';

import { shellQuote } from '../../src/cli-protocol/replay-command.js';
import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import { getStateFilePath } from '../../templates/hooks/lib/quality-state.js';
import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import { parseShellWords } from '../../templates/hooks/lib/shell-segments.js';
import { assertMatchingTree } from './codex-plugin-package.js';
import { CodexScriptedHandoff } from './codex-scripted-handoff.js';
import { messageText, type Rollout } from './codex-workflow-observation.js';
import { observeExactHostVersion } from './host-contract-version.js';
import { catalogueHelperRuntime, observedHelperProgram } from './native-helper-command.js';
import {
  assertArchitectureObservation,
  ObservedPropagationMismatch,
  preparePropagationCompletion,
  type PropagationArchitectureCase,
} from './propagation-policy-case.js';

export interface CodexHandoffCase {
  enabled: boolean;
  currentTool: boolean;
  configuration?: PropagationArchitectureCase['options'];
}

export type CodexVerificationCase = CodexHandoffCase | PropagationArchitectureCase;

interface CodexCompletionObservation {
  installation: string;
  raw: string;
  ticket: string;
  decisions: ReturnType<typeof JSON.parse>[];
  configuration?: { path: string; bytes: string };
  helper?: { marker: string; origin: string; runtime: string };
}

export interface CodexGuardFixture {
  root: string;
  binary: string;
  profile: string;
  project: string;
  installedPath: string;
}
export interface StopObservation {
  args: string[];
  input: {
    session_id: string;
    stop_hook_active: boolean;
    cwd: string;
    transcript_path?: string;
    turn_id?: string;
    last_assistant_message?: string;
  };
  stdout: string;
  status: number;
}
export interface Event {
  type: string;
  thread_id?: string;
  item?: {
    type: string;
    text?: string;
    command?: string;
    aggregated_output?: string;
    exit_code?: number;
  };
}
const execute = promisify(execFile);

/** Match the missing-evidence outcome without requiring a model to quote a filename. */
export function reportsMissingVerification(text: string): boolean {
  text = text
    .replaceAll('`', '')
    .replaceAll(/\b(?:has|have) (not )?been\b/giu, '$1')
    .replaceAll(/\s+/gu, ' ');
  const negatedGap =
    /\b(?:no|not|without)\s+(?:missing|unmet)\s+(?:required\s+)?(?:verify\.md|verification\s+(?:evidence|requirement))\b/iu;
  const nothingMissing =
    /\bno\s+(?:valid\s+)?(?:verify\.md|verification\s+(?:evidence|requirement))\s+(?:(?:is|was)\s+)?(?:missing|unmet|absent)\b/iu;
  if (negatedGap.test(text) || nothingMissing.test(text) || /\bnot\s+unable\s+to\b/iu.test(text))
    return false;
  return (
    /\b(?:unable to|cannot|can't)\s+(?:run|complete|satisfy)\s+(?:the\s+)?(?:verification(?:\s+(?:evidence|requirement))?|verify\.md)\b/iu.test(
      text,
    ) ||
    /\b(?:missing|unmet|no(?: valid)?|without)\s+(?:required\s+)?(?:verify\.md|verification\s+(?:evidence|requirement))\b/iu.test(
      text,
    ) ||
    /\b(?:verify\.md|verification\s+(?:evidence|requirement))\s+(?:(?:is|was|remains)\s+)?(?:missing|unmet|absent|not (?:generated|available|provided|found))\b/iu.test(
      text,
    )
  );
}

/** Classify a missing continuation only after a genuine successful native block. */
export function assertCodexStopSequence(stops: StopObservation[]): void {
  const first = stops[0];
  assert.ok(first, 'HOST_CONTRACT_PROOF_UNAVAILABLE: no trial Stop');
  assert.equal(first.status, 0, 'HOST_CONTRACT_PROOF_UNAVAILABLE: first Stop failed');
  assert.equal(
    first.input.stop_hook_active,
    false,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: capacity consumed',
  );
  const decision = JSON.parse(first.stdout) as { decision?: string; reason?: string };
  assert.equal(
    decision.decision,
    'block',
    'HOST_CONTRACT_PROOF_UNAVAILABLE: first Stop did not block',
  );
  assert.ok(
    decision.reason?.includes('verify.md'),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: unrelated block',
  );
  assert.ok(
    stops.length >= 2,
    'HOST_CONTINUATION_MISSING: successful native block ended without continuation',
  );
  assert.equal(
    stops.length,
    2,
    'CONTINUATION_BOUND_EXCEEDED: more than one automatic continuation',
  );
  const second = stops[1];
  assert.ok(second);
  assert.equal(second.status, 0, 'HOST_CONTRACT_PROOF_UNAVAILABLE: second Stop failed');
  assert.equal(second.input.stop_hook_active, true);
  assert.deepEqual(JSON.parse(second.stdout), {});
}

/** Shared existing temporary fixture boundary; does not grant native trust. */
export function assertCodexGuardFixture(fixture: CodexGuardFixture): void {
  for (const field of ['root', 'binary', 'profile', 'project', 'installedPath'] as const) {
    assert.ok(nodePath.isAbsolute(fixture[field]));
    fixture[field] = realpathSync(fixture[field]);
  }
  const temporaryRoots = [realpathSync(tmpdir()), realpathSync('/tmp')];
  assert.ok(temporaryRoots.some(root => fixture.root.startsWith(`${root}/`)));
  assert.ok(nodePath.basename(fixture.root).startsWith('codex-guard-'));
  assert.equal(fixture.profile, nodePath.join(fixture.root, 'profile'));
  assert.equal(fixture.project, nodePath.join(fixture.root, 'project'));
  assert.ok(fixture.installedPath.startsWith(`${fixture.profile}/plugins/cache/`));
}

/** One real CLI completion request; all fixture state is set before that request. */
export class CodexNativeContinuationActor {
  private thread = '';
  private trialEvents: Event[] = [];
  private trialOffset = 1;
  private readonly directory: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly ticketId = randomUUID().slice(0, 6).toUpperCase();
  private readonly marker = `FINISH_${randomUUID()}`;
  private handoffTurn = 0;
  private readonly scripted?: CodexScriptedHandoff;

  constructor(
    private readonly fixture: CodexGuardFixture,
    private readonly expectedPackage = nodePath.resolve(import.meta.dirname, '../../codex-plugin'),
    private readonly modelArguments?: () => Promise<string[]>,
    mode?: 'scripted-handoff',
  ) {
    assertCodexGuardFixture(fixture);
    this.directory = mkdtempSync(nodePath.join(fixture.root, 'codex-unfinished-ticket-stop-'));
    const observer = nodePath.resolve(
      import.meta.dirname,
      '../fixtures/host-contract/codex-stop-observer.mjs',
    );
    const shim = nodePath.join(this.directory, 'bin');
    mkdirSync(shim);
    writeFileSync(
      nodePath.join(shim, 'bun'),
      `#!/bin/sh\nexec "${process.execPath}" "${observer}" "$@"\n`,
      { mode: 0o755 },
    );
    this.environment = {
      ...process.env,
      CODEX_HOME: fixture.profile,
      PATH: `${shim}:${process.env.PATH ?? ''}`,
      SAFEWORD_OBSERVER_REAL_BUN: realpathSync(
        execFileSync('which', ['bun'], { encoding: 'utf8' }).trim(),
      ),
      SAFEWORD_OBSERVER_LOG: nodePath.join(this.directory, 'stop-observations.jsonl'),
    };
    delete this.environment.SAFEWORD_CLI;
    if (mode === 'scripted-handoff')
      this.scripted = new CodexScriptedHandoff(fixture, this.environment, this.directory);
  }

  private async scriptedTurn(prompt: string, command: string, answer: string): Promise<Event[]> {
    assert.ok(this.scripted);
    return this.scripted.turn(
      this.modelArguments ? await this.modelArguments() : [],
      prompt,
      command,
      answer,
    );
  }

  private async handoffCommand(prompt: string, command: string): Promise<Event[]> {
    return this.scripted
      ? this.scriptedTurn(prompt, command, 'READY')
      : this.command(
          [
            'exec',
            'resume',
            '--json',
            '-c',
            'approval_policy="never"',
            '-m',
            'gpt-5.6-terra',
            this.thread,
            prompt,
          ],
          `handoff-${++this.handoffTurn}`,
        );
  }

  private get scriptedEvidence() {
    return this.scripted
      ? {
          model_input: 'scripted',
          event_source: 'codex-app-server',
          protocol: nodePath.join(this.directory, 'app-server.jsonl'),
        }
      : {};
  }

  private async command(args: string[], name: string): Promise<Event[]> {
    const pending = execute(
      this.fixture.binary,
      [
        ...(this.modelArguments ? await this.modelArguments() : []),
        '--enable',
        'hooks',
        '--enable',
        'plugins',
        ...args,
      ],
      {
        cwd: this.fixture.project,
        env: this.environment,
        timeout: 180_000,
        maxBuffer: 4 * 1024 * 1024,
        encoding: 'utf8',
      },
    );
    pending.child.stdin?.end();
    try {
      const result = await pending;
      this.capture(name, result);
      return result.stdout
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as Event);
    } catch (error) {
      const result = error as { stdout?: string; stderr?: string };
      this.capture(name, { stdout: result.stdout ?? '', stderr: result.stderr ?? String(error) });
      throw error;
    }
  }

  private capture(name: string, result: { stdout: string; stderr: string }): void {
    writeFileSync(nodePath.join(this.directory, `${name}-events.jsonl`), result.stdout);
    writeFileSync(nodePath.join(this.directory, `${name}-stderr.log`), result.stderr);
  }

  private observations(): StopObservation[] {
    const path = this.environment.SAFEWORD_OBSERVER_LOG;
    assert.ok(
      path && existsSync(path),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native Stop did not dispatch',
    );
    return readFileSync(path, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as StopObservation);
  }

  private get ticketDirectory(): string {
    return nodePath.join(this.fixture.project, '.project/tickets', `${this.ticketId}-unfinished`);
  }

  private handoffHelper() {
    const skillFile = nodePath.join(this.fixture.installedPath, 'skills/explain/SKILL.md');
    const skill = readFileSync(skillFile, 'utf8');
    const runtime = catalogueHelperRuntime(
      skill,
      skillFile,
      nodePath.join(this.fixture.installedPath, 'runtime/cli.js'),
    );
    const script = /```bash\n([\s\S]*?)```/u.exec(skill)?.[1];
    assert.ok(script);
    return {
      runtime,
      command: `SAFEWORD_PLUGIN_RUNTIME=${shellQuote(runtime)}; PROJECT_DIR=${shellQuote(this.fixture.project)}; ${script}`,
    };
  }

  private observedHandoffHelper(
    events: Event[],
    currentTool: boolean,
    marker: string,
    runtime: string,
  ) {
    const calls = events.filter(
      row => row.type === 'item.completed' && row.item?.type === 'command_execution',
    );
    const file = nodePath.join(this.fixture.project, '.host-contract/native-helper.json');
    assert.equal(calls.length, currentTool ? 1 : 0, 'NATIVE_HANDOFF_HELPER_MISSING');
    let record: { marker: string; runtime: string; origin: string } | undefined;
    if (currentTool) {
      const call = calls[0]?.item;
      assert.ok(call);
      assert.equal(call.exit_code, 0, 'NATIVE_HANDOFF_HELPER_MISSING');
      const command = call.command ?? '';
      const actualRuntime =
        observedHelperProgram(command) ??
        observedHelperProgram(parseShellWords(command).at(-1) ?? '');
      assert.equal(actualRuntime, runtime, 'NATIVE_HELPER_ORIGIN_MISMATCH');
      assert.ok(call.aggregated_output?.includes(marker), 'NATIVE_HANDOFF_HELPER_MISSING');
      assert.ok(existsSync(file), 'NATIVE_HANDOFF_HELPER_MISSING');
      record = JSON.parse(readFileSync(file, 'utf8'));
      assert.ok(record);
      assert.equal(record.marker, marker, 'NATIVE_HELPER_ORIGIN_MISMATCH');
      assert.equal(realpathSync(record.runtime), runtime, 'NATIVE_HELPER_ORIGIN_MISMATCH');
      assert.equal(
        realpathSync(record.origin),
        nodePath.join(this.fixture.installedPath, 'templates/hooks/audit-principle-trace.ts'),
        'NATIVE_HELPER_ORIGIN_MISMATCH',
      );
    } else assert.equal(existsSync(file), false, 'NATIVE_HANDOFF_HELPER_UNEXPECTED');
    return record;
  }

  private handoffMessages(observations: StopObservation[], events: Event[]) {
    const first = observations[0];
    assert.ok(first?.input.transcript_path);
    const entries = readFileSync(first.input.transcript_path, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as Rollout[number]);
    const starts = entries.filter(
      row => row.type === 'turn_context' && row.payload?.turn_id === first.input.turn_id,
    );
    const unavailable = 'HOST_CONTRACT_PROOF_UNAVAILABLE: handoff terminal provenance missing';
    assert.equal(starts.length, 1, unavailable);
    const start = starts[0];
    assert.ok(start, unavailable);
    const current = entries.slice(entries.indexOf(start));
    const contexts = current.filter(row => row.type === 'turn_context');
    assert.ok(
      contexts.every(row => observations.some(stop => stop.input.turn_id === row.payload?.turn_id)),
      unavailable,
    );
    const messages = current.filter(
      row => row.type === 'response_item' && row.payload?.role === 'assistant',
    );
    this.assertHandoffMessageProvenance(messages, contexts, current);
    const emitted = events.filter(
      row => row.type === 'item.completed' && row.item?.type === 'agent_message',
    );
    assert.deepEqual(
      messages.map(messageText),
      emitted.map(row => row.item?.text),
      'CODEX_HANDOFF_TRANSCRIPT_EVENT_MISMATCH',
    );
    return messages.filter(
      row => row.payload && Reflect.get(row.payload, 'phase') === 'final_answer',
    );
  }

  private assertHandoffResponses(observations: StopObservation[], events: Event[]) {
    const messages = this.handoffMessages(observations, events);
    assert.equal(messages.length, observations.length, 'CODEX_HANDOFF_RESPONSE_COUNT_MISMATCH');
    for (const [index, message] of messages.entries()) {
      assert.equal(
        message.payload?.internal_chat_message_metadata_passthrough?.turn_id,
        observations[index]?.input.turn_id,
        'CODEX_HANDOFF_TERMINAL_TURN_MISMATCH',
      );
      assert.equal(
        messageText(message),
        observations[index]?.input.last_assistant_message,
        'CODEX_HANDOFF_MESSAGE_MISMATCH',
      );
    }
    assert.equal(
      events.filter(row => row.type === 'turn.completed').length,
      1,
      'CODEX_HANDOFF_TURN_COMPLETION_MISSING',
    );
    assert.equal(events.at(-1)?.type, 'turn.completed', 'CODEX_HANDOFF_TURN_COMPLETION_MISSING');
  }

  private assertHandoffMessageProvenance(messages: Rollout, contexts: Rollout, current: Rollout) {
    const unavailable = 'HOST_CONTRACT_PROOF_UNAVAILABLE: handoff terminal provenance missing';
    for (const message of messages) {
      const payload = message.payload;
      assert.ok(payload?.id && payload.type === 'message', unavailable);
      assert.ok(
        ['commentary', 'final_answer'].includes(Reflect.get(payload, 'phase')),
        unavailable,
      );
      const turn = payload.internal_chat_message_metadata_passthrough?.turn_id;
      assert.ok(turn, unavailable);
      const context = contexts.find(row => row.payload?.turn_id === turn);
      assert.ok(context && current.indexOf(context) < current.indexOf(message), unavailable);
    }
  }

  private assertHandoffOutcome(
    observations: StopObservation[],
    events: Event[],
    expectedCorrection: boolean,
  ) {
    const decisions = observations.map(row => JSON.parse(row.stdout));
    assert.equal(
      decisions[0].decision,
      expectedCorrection ? 'block' : undefined,
      'CODEX_HANDOFF_OPTION_OUTCOME_MISMATCH',
    );
    assert.equal(
      observations.length,
      expectedCorrection ? 2 : 1,
      'CODEX_HANDOFF_CONTINUATION_BOUND_MISMATCH',
    );
    if (expectedCorrection) {
      assert.match(
        decisions[0].reason,
        /terminal-handoff\/v1 correction/u,
        'CODEX_HANDOFF_REASON_MISMATCH',
      );
      assert.equal(observations[1]?.input.stop_hook_active, true);
      assert.deepEqual(decisions[1], {});
    } else assert.deepEqual(decisions[0], {});
    this.assertHandoffResponses(observations, events);
    return decisions;
  }

  private assertConfiguredHandoff(
    handoff: CodexHandoffCase,
    observation: { configuration: { path: string; bytes: string }; decisions: unknown[] },
    observations: StopObservation[],
    events: Event[],
  ) {
    if (!handoff.configuration) return;
    assert.equal(
      readFileSync(observation.configuration.path, 'utf8'),
      observation.configuration.bytes,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: settings changed during native turn',
    );
    assert.ok(
      observation.decisions.every(row => row && typeof row === 'object' && !Array.isArray(row)),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: malformed native handoff Stop',
    );
    // Missing terminal provenance is unavailable, not an observed policy mismatch.
    this.assertHandoffResponses(observations, events);
  }

  private async observeHandoff(evidence: string, handoff: CodexHandoffCase, marker: string) {
    assert.ok(this.thread, 'HOST_CONTRACT_PROOF_UNAVAILABLE: native Codex session missing');
    assertMatchingTree(this.expectedPackage, this.fixture.installedPath);
    const { ticket, content } = preparePropagationCompletion(
      this.fixture.project,
      this.thread,
      'codex',
      evidence,
    );
    if (handoff.configuration)
      writeFileSync(
        nodePath.join(ticket, 'ticket.md'),
        content.replace('phase: done', 'phase: implement'),
      );
    const config = nodePath.join(this.fixture.project, '.safeword/config.json');
    const previous = JSON.parse(readFileSync(config, 'utf8'));
    writeFileSync(
      config,
      JSON.stringify({
        ...previous,
        ...handoff.configuration,
        terminalHandoffCorrection: handoff.enabled,
      }),
    );
    const snapshot = { path: config, bytes: readFileSync(config, 'utf8') };
    const helper = this.handoffHelper();
    rmSync(nodePath.join(this.fixture.project, '.host-contract/native-helper.json'), {
      force: true,
    });
    const command = handoff.currentTool ? helper.command : '';
    const prompt = `${handoff.currentTool ? 'Execute the following packaged helper in one shell call, exactly once, in this current turn.' : 'Use no tools in this turn.'} Then reply only READY and end this turn. Do not edit other files or configuration, write helper results yourself or do other work. If the host supplies a correction, report it honestly without further tools.\nHANDOFF_HELPER_COMMAND=${JSON.stringify(command)}`;
    const offset = this.observations().length;
    const events = await this.handoffCommand(prompt, command);
    const observations = this.observations().slice(offset);
    assert.ok(observations.length, 'HOST_CONTRACT_PROOF_UNAVAILABLE: native Codex Stop missing');
    for (const stop of observations) {
      assert.equal(stop.status, 0);
      assert.equal(stop.input.session_id, this.thread);
      assert.equal(realpathSync(stop.input.cwd), this.fixture.project);
      assert.ok(stop.args.includes(nodePath.join(this.fixture.installedPath, 'runtime/cli.js')));
    }
    const first = observations[0];
    assert.ok(first);
    assert.equal(first.input.stop_hook_active, false);
    assert.ok(
      first.input.turn_id && first.input.transcript_path && existsSync(first.input.transcript_path),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: current-turn transcript missing',
    );
    assert.equal(first.input.last_assistant_message, 'READY', 'CODEX_HANDOFF_MESSAGE_MISMATCH');
    const observedHelper = this.observedHandoffHelper(
      events,
      handoff.currentTool,
      marker,
      helper.runtime,
    );
    const observation = {
      installation: JSON.stringify([this.fixture.installedPath, this.fixture.project]),
      decisions: observations.map(row => JSON.parse(row.stdout)),
      configuration: snapshot,
      helper: observedHelper,
      raw: JSON.stringify({
        observations,
        events,
        ...this.scriptedEvidence,
        helper: observedHelper,
        configuration: snapshot,
      }),
    };
    this.assertConfiguredHandoff(handoff, observation, observations, events);
    try {
      observation.decisions = this.assertHandoffOutcome(
        observations,
        events,
        handoff.enabled && handoff.currentTool,
      );
    } catch (error) {
      if (!handoff.configuration) throw error;
      throw new ObservedPropagationMismatch(observation, error);
    }
    assertMatchingTree(this.expectedPackage, this.fixture.installedPath);
    return {
      ...observation,
      ticket: readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8'),
    };
  }

  private assertArchitectureOrigin(observations: StopObservation[]): void {
    for (const stop of observations) {
      assert.ok(
        stop.input.turn_id && stop.input.transcript_path && existsSync(stop.input.transcript_path),
        'HOST_CONTRACT_PROOF_UNAVAILABLE: architecture turn provenance missing',
      );
      const runtime = stop.args.indexOf(
        nodePath.join(this.fixture.installedPath, 'runtime/cli.js'),
      );
      assert.deepEqual(stop.args.slice(runtime + 1), ['hook', 'codex', 'stop', '--plugin-hook']);
    }
  }

  close(): void {
    this.scripted?.close();
  }

  async prepareContinuation(host: string, version: string): Promise<void> {
    assert.equal(host, 'Codex');
    assert.equal(version, hostReleases.codex.version);
    const observed = await execute(this.fixture.binary, ['--version'], { encoding: 'utf8' });
    assert.equal(observeExactHostVersion(version, observed.stdout).state, 'verified');
    assertMatchingTree(this.expectedPackage, this.fixture.installedPath);
    assert.equal(existsSync(nodePath.join(this.fixture.project, '.codex')), false);
    console.log(`Codex continuation evidence: ${this.directory}`);
    const answer = [
      '**CONFIDENT** — The isolated setup turn is ready.',
      '**Decided:** Keep the setup read-only and leave the test ready for its next turn.',
      '**Open:** none.',
      '**Next:** Action: Continue. Object: the native test.',
    ].join('\n\n');
    const prompt = [
      'This is isolated setup. Complete any required startup handbook reads, then take no other actions and change no files. Reply with exactly the plain Markdown below, without a code fence.',
      answer,
    ].join('\n\n');
    const events = this.scripted
      ? await this.scriptedTurn(
          prompt,
          `cat ${shellQuote(nodePath.join(this.fixture.installedPath, 'resources/SAFEWORD.md'))}`,
          answer,
        )
      : await this.command(
          [
            'exec',
            '--json',
            '-s',
            'workspace-write',
            '-c',
            'approval_policy="never"',
            '-m',
            'gpt-5.6-terra',
            prompt,
          ],
          'setup',
        );
    const thread = events.find(row => row.type === 'thread.started')?.thread_id;
    assert.ok(thread);
    this.thread = thread;
    assert.equal(events.at(-1)?.type, 'turn.completed');
    const stops = this.observations();
    assert.equal(
      stops.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: setup continuation already consumed',
    );
    assert.equal(stops[0]?.input.session_id, thread);
    assert.equal(stops[0]?.input.stop_hook_active, false);
    assert.equal(stops[0]?.status, 0);
    assert.deepEqual(JSON.parse(stops[0]?.stdout ?? ''), {});
  }

  setMissingVerification(): void {
    mkdirSync(this.ticketDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(this.ticketDirectory, 'ticket.md'),
      `---\nid: ${this.ticketId}\ntype: task\nphase: done\nstatus: in_progress\n---\n\n# Verify the synthetic work\n`,
    );
    const identity = resolveRunIdentity({ session_id: this.thread }, { runtime: 'codex' });
    writeFileSync(
      getStateFilePath(this.fixture.project, identity),
      JSON.stringify({
        activeTicket: this.ticketId,
        locSinceCommit: 0,
        lastCommitHash: '',
        // eslint-disable-next-line unicorn/no-null -- actual QualityState empty-gate representation
        gate: null,
        recentFailures: [],
        incrementedPatterns: [],
      }),
    );
    assert.equal(existsSync(nodePath.join(this.ticketDirectory, 'verify.md')), false);
  }

  /** Reuse the same genuine native session and installed package across policy revisions. */
  async observeVerification(
    evidence: string,
    setting?: CodexVerificationCase,
    helperMarker?: string,
  ): Promise<CodexCompletionObservation> {
    if (setting && 'enabled' in setting) {
      assert.ok(helperMarker);
      return this.observeHandoff(evidence, setting, helperMarker);
    }
    assert.ok(this.thread, 'HOST_CONTRACT_PROOF_UNAVAILABLE: native Codex session missing');
    assertMatchingTree(this.expectedPackage, this.fixture.installedPath);
    const { ticket } = preparePropagationCompletion(
      this.fixture.project,
      this.thread,
      'codex',
      evidence,
      setting,
    );
    const config = setting
      ? {
          path: nodePath.join(this.fixture.project, '.safeword/config.json'),
          bytes: readFileSync(nodePath.join(this.fixture.project, '.safeword/config.json'), 'utf8'),
        }
      : undefined;
    const offset = this.observations().length;
    const events = await this.command(
      [
        'exec',
        'resume',
        '--json',
        '-c',
        'approval_policy="never"',
        '-m',
        'gpt-5.6-terra',
        this.thread,
        'Reply only READY and end this turn. Use no tools and change no files. If the host supplies a further instruction, report the unmet requirement honestly without changing files.',
      ],
      'verification',
    );
    const observations = this.observations().slice(offset);
    assert.ok(
      observations.length > 0,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native Codex Stop missing',
    );
    for (const stop of observations) {
      assert.equal(stop.input.session_id, this.thread);
      assert.equal(realpathSync(stop.input.cwd), this.fixture.project);
      assert.equal(stop.status, 0);
      assert.ok(stop.args.includes(nodePath.join(this.fixture.installedPath, 'runtime/cli.js')));
    }
    assert.equal(events.at(-1)?.type, 'turn.completed');
    if (setting) this.assertArchitectureOrigin(observations);
    if (config)
      assert.equal(
        readFileSync(config.path, 'utf8'),
        config.bytes,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: settings changed during native turn',
      );
    const observed = {
      installation: JSON.stringify([this.fixture.installedPath, this.fixture.project]),
      decisions: observations.map(row => JSON.parse(row.stdout)),
      ticket: readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8'),
      configuration: config,
      raw: JSON.stringify({
        observations,
        events,
        configuration: config,
        configurationAfter: config && readFileSync(config.path, 'utf8'),
      }),
    };
    if (setting)
      assertArchitectureObservation(
        observed,
        setting.options.architectureReviewGate,
        'CODEX_ARCHITECTURE_OPTION_OUTCOME_MISMATCH',
      );
    return observed;
  }

  async attemptCompletion(): Promise<void> {
    const handbook = shellQuote(nodePath.join(this.fixture.installedPath, 'resources/SAFEWORD.md'));
    this.trialOffset = this.observations().length;
    this.trialEvents = await this.command(
      [
        'exec',
        'resume',
        '--json',
        '-c',
        'approval_policy="never"',
        '-m',
        'gpt-5.6-terra',
        this.thread,
        [
          'This isolated test observes the installed completion guard. It does not ask you to perform verification.',
          `Before your first reply, if startup asks you to read the handbook, run exactly cat ${handbook} once before replying. Reply only ${this.marker}.`,
          'If the host supplies an automatic follow-up, report the actual unmet requirement directly from its feedback in one reply. Do not post a progress message, reread the handbook, open a skill, run verification, or use any tool after the first reply. Change no files.',
        ].join('\n'),
      ],
      'trial',
    );
  }

  async observeRetainedContinuation() {
    this.setMissingVerification();
    await this.attemptCompletion();
    return {
      installation: JSON.stringify([this.fixture.installedPath, this.fixture.project]),
      raw: JSON.stringify({
        stops: this.observations().slice(this.trialOffset),
        events: this.trialEvents,
      }),
    };
  }

  assertContinuation(): void {
    const stops = this.observations().slice(this.trialOffset);
    for (const stop of stops) {
      assert.equal(stop.input.session_id, this.thread);
      assert.equal(realpathSync(stop.input.cwd), this.fixture.project);
      assert.equal(stop.status, 0);
      assert.ok(stop.args.includes(nodePath.join(this.fixture.installedPath, 'runtime/cli.js')));
    }
    assertCodexStopSequence(stops);
    const messages = this.trialEvents.filter(
      row => row.type === 'item.completed' && row.item?.type === 'agent_message',
    );
    assert.equal(
      messages.length,
      2,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: ambiguous assistant response count',
    );
    const [firstMessage, secondMessage] = messages;
    assert.ok(firstMessage?.item?.text);
    assert.ok(secondMessage?.item?.text);
    assert.ok(firstMessage.item.text.includes(this.marker));
    assert.ok(reportsMissingVerification(secondMessage.item.text));
    assert.equal(this.trialEvents[0]?.type, 'thread.started');
    assert.equal(this.trialEvents[0].thread_id, this.thread);
    assert.equal(
      this.trialEvents.filter(event => event.type === 'turn.completed').length,
      1,
      'CONTINUATION_BOUND_EXCEEDED: expected one completed native turn',
    );
    assert.equal(this.trialEvents.at(-1)?.type, 'turn.completed');
    assert.equal(existsSync(nodePath.join(this.ticketDirectory, 'verify.md')), false);
    assert.ok(
      readFileSync(nodePath.join(this.ticketDirectory, 'ticket.md'), 'utf8').includes(
        'status: in_progress',
      ),
    );
    assertMatchingTree(this.expectedPackage, this.fixture.installedPath);
  }
}
