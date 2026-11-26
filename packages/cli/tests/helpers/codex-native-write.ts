import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
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
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';

import { shellQuote } from '../../src/cli-protocol/replay-command.js';
import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import { parseShellWords } from '../../templates/hooks/lib/shell-segments.js';
import type { CodexGuardFixture } from './codex-native-continuation.js';
import { assertMatchingTree } from './codex-plugin-package.js';
import { observeExactHostVersion } from './host-contract-version.js';
import {
  preparePropagationDesignApproval,
  type PropagationArchitectureCase,
} from './propagation-policy-case.js';

interface NativeHook {
  eventName: string;
  sourcePath: string;
  enabled: boolean;
  trustStatus: string;
}
interface HookResponse {
  id?: number;
  error?: unknown;
  result?: { data: { hooks: NativeHook[]; errors: unknown[]; warnings: unknown[] }[] };
}
interface TurnEvent {
  type: string;
  item?: { type: string; command?: string; exit_code?: number };
}

interface DesignCallback {
  args: string[];
  status: number;
  stdout: string;
  stderr: string;
  input: {
    cwd: string;
    session_id: string;
    tool_name: string;
    tool_input?: { command?: string };
  };
}

function assertDesignStartupRead(callback: DesignCallback, handbook: string): void {
  assert.equal(callback.input.tool_name, 'Bash', 'Codex design unexpected startup tool');
  const command = callback.input.tool_input?.command;
  assert.ok(
    command === `sed -n '1,$p' ${shellQuote(handbook)}` ||
      (/^[/\w.-]+$/u.test(handbook) && command === `sed -n '1,$p' ${handbook}`),
    'Codex design unexpected startup command',
  );
}

function designPatchCallback(
  callbacks: DesignCallback[],
  {
    expected,
    project,
    session,
    handbook,
    patch,
  }: {
    expected: string[];
    project: string;
    session: string;
    handbook: string;
    patch: string;
  },
): DesignCallback {
  const rows = callbacks.filter(row => row.args.includes('pre-tool-use'));
  for (const callback of rows) {
    assert.deepEqual(callback.args, expected);
    assert.equal(callback.status, 0, callback.stderr);
    assert.equal(callback.input.cwd, project);
    assert.equal(callback.input.session_id, session);
  }
  if (rows.length === 2) {
    const startup = rows.shift();
    assert.ok(startup);
    assertDesignStartupRead(startup, handbook);
  }
  assert.equal(
    rows.length,
    1,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: Codex design callback cardinality',
  );
  const row = rows[0];
  assert.ok(row);
  assert.equal(row.input.tool_name, 'apply_patch');
  assert.equal(row.input.tool_input?.command, patch);
  return row;
}

const executeFile = promisify(execFile);

function nativeEnvironment(profile: string): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, CODEX_HOME: profile };
  // Vitest redirects helper CLI calls to repository source. A native package
  // baseline must resolve its own bundled runtime instead.
  delete environment.SAFEWORD_CLI;
  return environment;
}

/** Shared real native-write actor; no fixture supplies policy decisions. */
export class CodexNativeWriteActor {
  private artifacts = '';
  private disposition: 'allowed' | 'denied' = 'allowed';
  private readonly marker = `safeword-${randomUUID()}`;
  private relativePath = '';
  private result?: { stdout: string; stderr: string };
  constructor(
    private readonly fixture: CodexGuardFixture,
    private readonly modelArguments?: () => Promise<string[]>,
  ) {}
  private async command(
    args: string[],
    capture?: string,
    environment = nativeEnvironment(this.fixture.profile),
  ): Promise<{ stdout: string; stderr: string }> {
    const fixture = this.fixture;
    assert.ok(fixture);
    const pending = executeFile(fixture.binary, args, {
      cwd: fixture.project,
      env: environment,
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    pending.child.stdin?.end();
    try {
      const result = await pending;
      if (capture) this.captureOutput(capture, result);
      return result;
    } catch (error) {
      if (capture && error instanceof Error) {
        const output = error as Error & { stdout?: string; stderr?: string };
        this.captureOutput(capture, {
          stdout: output.stdout ?? '',
          stderr: output.stderr ?? error.message,
        });
      }
      throw error;
    }
  }

  private captureOutput(name: string, output: { stdout: string; stderr: string }): void {
    writeFileSync(nodePath.join(this.artifacts, `${name}-events.jsonl`), output.stdout);
    writeFileSync(nodePath.join(this.artifacts, `${name}-stderr.log`), output.stderr);
  }

  /** Observe native discovery without granting trust or supplying a hook. */
  private async trustedHooks(): Promise<void> {
    const fixture = this.fixture;
    assert.ok(fixture);
    const child = spawn(
      fixture.binary,
      ['--enable', 'hooks', '--enable', 'plugins', 'app-server', '--stdio'],
      {
        cwd: fixture.project,
        env: nativeEnvironment(fixture.profile),
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    let stderr = '';
    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });
    const timer = setTimeout(() => child.kill(), 30_000);
    try {
      child.stdin.write(
        `${JSON.stringify({
          id: 1,
          method: 'initialize',
          params: {
            clientInfo: { name: 'safeword_guard_probe', version: '0.0.1' },
            capabilities: { experimentalApi: true },
          },
        })}\n`,
      );
      const lines = createInterface({ input: child.stdout });
      for await (const line of lines) {
        const response = JSON.parse(line) as HookResponse;
        assert.equal(
          response.error,
          undefined,
          'HOST_CONTRACT_PROOF_UNAVAILABLE: discovery failed',
        );
        if (response.id === 1) {
          child.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`);
          child.stdin.write(
            `${JSON.stringify({
              id: 2,
              method: 'hooks/list',
              params: {
                cwds: [fixture.project],
              },
            })}\n`,
          );
        }
        if (response.id !== 2) continue;
        assert.equal(response.result?.data.length, 1);
        const entry = response.result?.data[0];
        assert.ok(entry);
        assert.deepEqual(entry.errors, []);
        assert.deepEqual(entry.warnings, []);
        assert.deepEqual(
          entry.hooks.map(hook => hook.eventName).toSorted((a, b) => a.localeCompare(b)),
          ['preToolUse', 'postToolUse', 'sessionStart', 'userPromptSubmit', 'stop'].toSorted(
            (a, b) => a.localeCompare(b),
          ),
        );
        for (const hook of entry.hooks) {
          assert.equal(
            realpathSync(hook.sourcePath),
            nodePath.join(fixture.installedPath, 'hooks.json'),
          );
          assert.ok(
            hook.enabled && hook.trustStatus === 'trusted',
            'HOST_CONTRACT_PROOF_UNAVAILABLE: exact test-profile hooks require native trust',
          );
        }
        writeFileSync(
          nodePath.join(this.artifacts, 'hooks.json'),
          JSON.stringify(response, undefined, 2),
        );
        return;
      }
      throw new Error(`HOST_CONTRACT_PROOF_UNAVAILABLE: discovery ended without hooks: ${stderr}`);
    } finally {
      clearTimeout(timer);
      child.stdin.end();
      child.kill();
    }
  }

  async prepare(host: string, version: string, runtime: string): Promise<void> {
    assert.equal(host, 'Codex');
    assert.equal(version, hostReleases.codex.version);
    assert.equal(runtime, 'CLI');
    const fixture = this.fixture;
    for (const field of ['root', 'binary', 'profile', 'project', 'installedPath'] as const) {
      assert.ok(nodePath.isAbsolute(fixture[field]));
      fixture[field] = realpathSync(fixture[field]);
    }
    const temporaryRoots = [realpathSync(tmpdir()), realpathSync('/tmp')];
    const ownedTemporaryRoot = temporaryRoots.some(root =>
      fixture.root.startsWith(`${root}${nodePath.sep}`),
    );
    assert.ok(ownedTemporaryRoot);
    const rootName = nodePath.basename(fixture.root);
    assert.ok(rootName.startsWith('codex-guard-'));
    assert.equal(fixture.profile, nodePath.join(fixture.root, 'profile'));
    assert.equal(fixture.project, nodePath.join(fixture.root, 'project'));
    assert.ok(fixture.installedPath.startsWith(`${fixture.profile}/plugins/cache/`));
    assert.equal(existsSync(nodePath.join(fixture.project, '.codex')), false);
    assert.equal(existsSync(nodePath.join(fixture.installedPath, 'plugin.json')), false);
    assertMatchingTree(
      nodePath.resolve(import.meta.dirname, '../../codex-plugin'),
      fixture.installedPath,
    );
    const observedVersion = await this.command(['--version']);
    assert.deepEqual(observeExactHostVersion(hostReleases.codex.version, observedVersion.stdout), {
      state: 'verified',
      version: hostReleases.codex.version,
    });
    this.artifacts = mkdtempSync(nodePath.join(fixture.root, 'guard-run-'));
    console.log(`Native guard artifacts: ${this.artifacts}`);
    await this.trustedHooks();
  }
  setPolicy(disposition: 'allowed' | 'denied'): void {
    this.disposition = disposition;
    this.relativePath =
      disposition === 'allowed'
        ? `allowed-${randomUUID()}.txt`
        : `.project/tickets/sentinel-${randomUUID()}/ticket.md`;
  }
  /** Native apply_patch request to the registered pre-action owner, never a Stop result. */
  async observeDesignApproval(
    options: PropagationArchitectureCase['options'],
    expectedPackage: string,
  ) {
    const fixture = this.fixture;
    assertMatchingTree(expectedPackage, fixture.installedPath);
    const directory = mkdtempSync(nodePath.join(fixture.root, 'design-write-'));
    this.artifacts = directory;
    const shim = nodePath.join(directory, 'bin');
    mkdirSync(shim);
    const observer = nodePath.resolve(
      import.meta.dirname,
      '../fixtures/host-contract/native-runtime-observer.mjs',
    );
    writeFileSync(
      nodePath.join(shim, 'bun'),
      `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(observer)} "$@"\n`,
      { mode: 0o755 },
    );
    const runtime = nodePath.join(fixture.installedPath, 'runtime/cli.js');
    const log = nodePath.join(directory, 'callbacks.jsonl');
    const bun = await executeFile('which', ['bun']);
    const environment = {
      ...nativeEnvironment(fixture.profile),
      PATH: `${shim}:${process.env.PATH ?? ''}`,
      SAFEWORD_OBSERVER_REAL_BUN: realpathSync(bun.stdout.trim()),
      SAFEWORD_OBSERVER_RUNTIME: runtime,
      SAFEWORD_OBSERVER_LOG: log,
    };
    const prepared = preparePropagationDesignApproval(fixture.project, options.designApprovalGate);
    const path = nodePath.join(fixture.project, '.safeword/config.json');
    const previous = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...previous, ...options }));
    const bytes = readFileSync(path, 'utf8');
    const patch = [
      '*** Begin Patch',
      `*** Update File: ${prepared.file}`,
      '@@',
      '-phase: plan-implementation',
      '+phase: plan-execution',
      '*** End Patch',
    ].join('\n');
    const handbook = nodePath.join(fixture.installedPath, 'resources/SAFEWORD.md');
    const handbookCommand = `sed -n '1,$p' ${shellQuote(handbook)}`;
    const result = await this.command(
      [
        ...(this.modelArguments ? await this.modelArguments() : []),
        '--enable',
        'hooks',
        '--enable',
        'plugins',
        'exec',
        '--json',
        '-s',
        'workspace-write',
        '-c',
        'approval_policy="never"',
        '-m',
        'gpt-5.6-terra',
        `Authorized isolated planning-transition test. Use apply_patch exactly once with the exact patch below. Let installed hooks decide; rejection is expected. If startup requires reading the handbook, run exactly ${handbookCommand} once before the patch. Do not retry, use any other tools, edit other files/configuration or bypass hooks. Report the actual result and stop.\nCODEX_DESIGN_PATCH=${JSON.stringify(patch)}`,
      ],
      'design',
      environment,
    );
    const callbacks = existsSync(log)
      ? readFileSync(log, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line))
      : [];
    const config = { path, bytes, after: readFileSync(path, 'utf8') };
    const effect = readFileSync(prepared.file, 'utf8');
    const raw = JSON.stringify({ callbacks, ...result, configuration: config, effect });
    const rawPath = nodePath.join(directory, 'observation.json');
    writeFileSync(rawPath, raw); // Preserve genuine output/effect before provenance checks or grading.
    const events = result.stdout
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    assert.equal(
      events.at(-1)?.type,
      'turn.completed',
      'HOST_CONTRACT_PROOF_UNAVAILABLE: Codex design turn incomplete',
    );
    const session = events.find(row => row.type === 'thread.started')?.thread_id;
    assert.ok(typeof session === 'string' && session.length > 0);
    const manifest = JSON.parse(
      readFileSync(nodePath.join(fixture.installedPath, 'hooks.json'), 'utf8'),
    );
    const binding = manifest.hooks.PreToolUse[0].hooks[0].command as string;
    const expected = parseShellWords(
      binding.replaceAll('${PLUGIN_ROOT}', () => fixture.installedPath),
    ).slice(1);
    const row = designPatchCallback(callbacks, {
      expected,
      project: fixture.project,
      session,
      handbook,
      patch,
    });
    return {
      installation: JSON.stringify([fixture.installedPath, fixture.project]),
      raw,
      rawPath,
      configuration: config,
      decision: row.stdout.trim() ? JSON.parse(row.stdout) : {},
      callback: row,
      session,
      before: prepared.before,
      expectedEffect: prepared.after,
      effect,
    };
  }
  async attempt(): Promise<void> {
    const disposition = this.disposition;
    const fixture = this.fixture;
    assert.ok(fixture);
    const marker = this.marker;
    const relativePath = this.relativePath;
    const target = nodePath.join(fixture.project, relativePath);
    mkdirSync(nodePath.dirname(target), { recursive: true });
    assert.equal(existsSync(target), false);
    const shellCommand = `printf %s ${marker} > ${relativePath}`;
    this.result = await this.command(
      [
        '--enable',
        'hooks',
        '--enable',
        'plugins',
        'exec',
        '--json',
        '-s',
        'workspace-write',
        '-c',
        'approval_policy="never"',
        '-m',
        'gpt-5.6-terra',
        `This is an authorized isolated native hook integration test in this disposable project. ` +
          `Use the shell tool exactly once to attempt: ${shellCommand} . ` +
          `Let existing native hooks govern this synthetic write; rejection is an expected test result. ` +
          `Do not bypass a hook, retry, read files, invoke skills, use alternative tools, or do other work. ` +
          `Report the actual tool result and stop.`,
      ],
      disposition,
    );
    writeFileSync(
      nodePath.join(this.artifacts, `${disposition}-case.json`),
      JSON.stringify(
        {
          caseId: `codex-${hostReleases.codex.version}-${disposition}-write`,
          relativePath,
          marker,
          shellCommand,
        },
        undefined,
        2,
      ),
    );
  }
  assertOutcome(): void {
    const fixture = this.fixture;
    const disposition = this.disposition;
    const marker = this.marker;
    const relativePath = this.relativePath;
    const target = nodePath.join(fixture.project, relativePath);
    const shellCommand = `printf %s ${marker} > ${relativePath}`;
    const result = this.result;
    assert.ok(result);
    const events = result.stdout
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as TurnEvent);
    assert.equal(events.at(-1)?.type, 'turn.completed');
    if (disposition === 'allowed') {
      const executions = events.filter(
        event => event.type === 'item.completed' && event.item?.type === 'command_execution',
      );
      assert.equal(executions.length, 1);
      assert.ok(executions[0]?.item?.command?.includes(shellCommand));
      assert.equal(executions[0]?.item?.exit_code, 0);
      assert.equal(readFileSync(target, 'utf8'), marker);
    } else {
      assert.equal(
        existsSync(target),
        false,
        'NATIVE_GUARD_DISPATCH_MISSING: denied write reached disk',
      );
      assert.ok(
        result.stderr.includes(`Command: ${shellCommand}`),
        'HOST_CONTRACT_PROOF_UNAVAILABLE: no native denied tool attempt observed',
      );
      assert.equal(result.stderr.match(/Command blocked by PreToolUse hook:/gu)?.length, 1);
      assert.ok(result.stderr.includes(`Shell commands can't change ${relativePath}`));
      assert.ok(
        result.stderr.includes("Safeword can't check what a shell command writes to a ticket file"),
      );
    }
  }
}
