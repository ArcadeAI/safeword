import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { getStateFilePath } from '../../templates/hooks/lib/quality-state.js';
import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import { assertMatchingTree } from './codex-plugin-package.js';
import { observeExactHostVersion } from './host-contract-version.js';

export interface CodexGuardFixture {
  root: string;
  binary: string;
  profile: string;
  project: string;
  installedPath: string;
}
export interface StopObservation {
  args: string[];
  input: { session_id: string; stop_hook_active: boolean; cwd: string };
  stdout: string;
  status: number;
}
interface Event {
  type: string;
  thread_id?: string;
  item?: { type: string; text?: string };
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
    /\bno\s+(?:valid\s+)?(?:verify\.md|verification\s+(?:evidence|requirement))\s+(?:is|was)\s+(?:missing|unmet|absent)\b/iu;
  if (negatedGap.test(text) || nothingMissing.test(text)) return false;
  return (
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
  assert.equal(first.status, 0);
  assert.equal(first.input.stop_hook_active, false);
  const decision = JSON.parse(first.stdout) as { decision?: string; reason?: string };
  assert.equal(decision.decision, 'block');
  assert.ok(decision.reason?.includes('verify.md'));
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
  assert.equal(second.status, 0);
  assert.equal(second.input.stop_hook_active, true);
  assert.deepEqual(JSON.parse(second.stdout), {});
}

/** One real CLI completion request; all fixture state is set before that request. */
export class CodexNativeContinuationActor {
  private thread = '';
  private trialEvents: Event[] = [];
  private readonly directory: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly ticketId = randomUUID().slice(0, 6).toUpperCase();
  private readonly marker = `FINISH_${randomUUID()}`;

  constructor(private readonly fixture: CodexGuardFixture) {
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
  }

  private async command(args: string[], name: string): Promise<Event[]> {
    const pending = execute(
      this.fixture.binary,
      ['--enable', 'hooks', '--enable', 'plugins', ...args],
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

  async prepareContinuation(host: string, version: string): Promise<void> {
    assert.equal(host, 'Codex');
    assert.equal(version, '0.160.0');
    const observed = await execute(this.fixture.binary, ['--version'], { encoding: 'utf8' });
    assert.equal(observeExactHostVersion(version, observed.stdout).state, 'verified');
    assertMatchingTree(
      nodePath.resolve(import.meta.dirname, '../../codex-plugin'),
      this.fixture.installedPath,
    );
    assert.equal(existsSync(nodePath.join(this.fixture.project, '.codex')), false);
    console.log(`Codex continuation evidence: ${this.directory}`);
    const events = await this.command(
      [
        'exec',
        '--json',
        '-s',
        'workspace-write',
        '-c',
        'approval_policy="never"',
        '-m',
        'gpt-5.6-terra',
        'This is isolated setup. Reply only READY. Use no tools.',
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

  async attemptCompletion(): Promise<void> {
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
        `Reply only ${this.marker} and end this turn. Use no tools and change no files. If the host automatically supplies a further instruction, report the unmet requirement honestly without changing files.`,
      ],
      'trial',
    );
  }

  assertContinuation(): void {
    const stops = this.observations().slice(1);
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
    assert.equal(this.trialEvents.at(-1)?.type, 'turn.completed');
    assert.equal(existsSync(nodePath.join(this.ticketDirectory, 'verify.md')), false);
    assert.ok(
      readFileSync(nodePath.join(this.ticketDirectory, 'ticket.md'), 'utf8').includes(
        'status: in_progress',
      ),
    );
    assertMatchingTree(
      nodePath.resolve(import.meta.dirname, '../../codex-plugin'),
      this.fixture.installedPath,
    );
  }
}
