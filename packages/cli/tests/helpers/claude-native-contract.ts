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
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { assertMatchingTree } from './codex-plugin-package.js';
import { observeExactHostVersion } from './host-contract-version.js';

export interface ClaudeNativeFixture {
  readonly root: string;
  readonly binary: string;
  readonly profile: string;
  readonly installedPath: string;
  readonly runtimePath: string;
}

interface HookObservation {
  args: string[];
  input: {
    session_id: string;
    tool_use_id?: string;
    tool_name?: string;
    tool_input?: { file_path?: string };
  };
  stdout: string;
  stderr: string;
  status: number;
}

const execute = promisify(execFile);

/** Observe the installed native plugin; no supplied hook decision or model-tool replacement. */
export class ClaudeNativeContractActor {
  private readonly environment: NodeJS.ProcessEnv;
  readonly directory: string;
  readonly project: string;

  constructor(private readonly fixture: ClaudeNativeFixture) {
    const root = realpathSync(fixture.root);
    assert.ok(root.startsWith(`${realpathSync('/tmp')}/`));
    assert.equal(realpathSync(fixture.profile), nodePath.join(root, 'profile'));
    assert.ok(realpathSync(fixture.installedPath).startsWith(`${root}/profile/plugins/cache/`));
    assert.ok(realpathSync(fixture.runtimePath).startsWith(`${root}/marketplace/`));
    this.directory = mkdtempSync(nodePath.join(root, 'native-contract-'));
    this.project = nodePath.join(this.directory, 'project');
    mkdirSync(nodePath.join(this.project, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(this.project, '.safeword/SAFEWORD.md'), '# Synthetic enrollment\n');
    writeFileSync(
      nodePath.join(this.project, '.safeword/config.json'),
      JSON.stringify({
        autoUpgrade: false,
        selfReport: { capture: false, surface: false, file: false },
      }),
    );
    const bin = nodePath.join(this.directory, 'bin');
    mkdirSync(bin);
    const observer = nodePath.resolve(
      import.meta.dirname,
      '../fixtures/host-contract/native-runtime-observer.mjs',
    );
    writeFileSync(
      nodePath.join(bin, 'bun'),
      `#!/bin/sh\nexec "${process.execPath}" "${observer}" "$@"\n`,
      { mode: 0o755 },
    );
    this.environment = {
      ...process.env,
      CLAUDE_CONFIG_DIR: fixture.profile,
      SAFEWORD_NO_AUTO_UPGRADE: '1',
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      SAFEWORD_OBSERVER_REAL_BUN: realpathSync(
        execFileSync('which', ['bun'], { encoding: 'utf8' }).trim(),
      ),
      SAFEWORD_OBSERVER_RUNTIME: nodePath.join(fixture.runtimePath, 'runtime/dispatch.js'),
      SAFEWORD_OBSERVER_LOG: nodePath.join(this.directory, 'hooks.jsonl'),
    };
    delete this.environment.SAFEWORD_CLI;
    // No repository-level configuration or hooks are inherited by this synthetic project.
    execFileSync('git', ['init', '--quiet', this.project]);
  }

  async prepare(): Promise<void> {
    const version = await execute(this.fixture.binary, ['--version'], { encoding: 'utf8' });
    assert.equal(observeExactHostVersion('2.1.170', version.stdout).state, 'verified');
    assertMatchingTree(
      nodePath.resolve(import.meta.dirname, '../../../../plugin'),
      this.fixture.installedPath,
    );
    assertMatchingTree(this.fixture.installedPath, this.fixture.runtimePath);
    const listed = await execute(this.fixture.binary, ['plugin', 'list', '--json'], {
      env: this.environment,
    });
    const plugins = JSON.parse(listed.stdout) as {
      id: string;
      enabled: boolean;
      installPath: string;
    }[];
    const plugin = plugins.find(row => row.id === 'safeword@safeword');
    assert.ok(
      plugin?.enabled,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native Claude plugin is not enabled',
    );
    assert.equal(realpathSync(plugin.installPath), realpathSync(this.fixture.installedPath));
    console.log(`Claude 2.1.170 native evidence: ${this.directory}`);
  }

  async turn(prompt: string, tools: string, capture: string): Promise<void> {
    const pending = execute(
      this.fixture.binary,
      [
        '-p',
        prompt,
        '--output-format',
        'stream-json',
        '--verbose',
        '--dangerously-skip-permissions',
        '--max-turns',
        '8',
        '--tools',
        tools,
      ],
      { cwd: this.project, env: this.environment, timeout: 240_000, maxBuffer: 8 * 1024 * 1024 },
    );
    pending.child.stdin?.end();
    let result: { stdout: string; stderr: string };
    try {
      result = await pending;
    } catch (error) {
      if (error instanceof Error) {
        const output = error as Error & { stdout?: string; stderr?: string };
        writeFileSync(
          nodePath.join(this.directory, `${capture}-events.jsonl`),
          output.stdout ?? '',
        );
        writeFileSync(
          nodePath.join(this.directory, `${capture}-stderr.log`),
          output.stderr ?? error.message,
        );
      }
      throw error;
    }
    writeFileSync(nodePath.join(this.directory, `${capture}-events.jsonl`), result.stdout);
    writeFileSync(nodePath.join(this.directory, `${capture}-stderr.log`), result.stderr);
    const events = result.stdout
      .trim()
      .split('\n')
      .map(
        line =>
          JSON.parse(line) as {
            type: string;
            subtype?: string;
            is_error?: boolean;
            plugins?: { name: string; path: string }[];
          },
      );
    const loaded = events
      .find(row => row.type === 'system' && row.subtype === 'init')
      ?.plugins?.find(row => row.name === 'safeword');
    assert.ok(loaded, 'HOST_CONTRACT_PROOF_UNAVAILABLE: native session did not load Safeword');
    assert.equal(realpathSync(loaded.path), realpathSync(this.fixture.runtimePath));
    const final = events.at(-1);
    assert.ok(final, 'HOST_CONTRACT_PROOF_UNAVAILABLE: native Claude returned no events');
    assert.equal(
      final?.type,
      'result',
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native turn did not finish',
    );
    assert.equal(
      final.is_error,
      false,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native Claude returned an error',
    );
  }

  observations(): HookObservation[] {
    const path = nodePath.join(this.directory, 'hooks.jsonl');
    assert.ok(
      existsSync(path),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: no native plugin dispatch observed',
    );
    return readFileSync(path, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as HookObservation);
  }

  async proveWrite(disposition: 'allowed' | 'denied'): Promise<void> {
    const ticket = nodePath.join(
      this.project,
      '.project/tickets',
      `${randomUUID().slice(0, 6).toUpperCase()}-native`,
    );
    mkdirSync(ticket, { recursive: true });
    const scope =
      disposition === 'allowed'
        ? 'scope: [Synthetic write]\nout_of_scope: [Other work]\ndone_when: [Sentinel exists]\n'
        : '';
    writeFileSync(
      nodePath.join(ticket, 'ticket.md'),
      `---\ntype: task\nphase: define-behavior\n${scope}---\n# Synthetic task\n`,
    );
    const target = nodePath.join(ticket, 'test-definitions.md');
    const marker = `NATIVE_${randomUUID()}`;
    assert.equal(existsSync(target), false);
    await this.turn(
      `Authorized isolated hook test. Use Write exactly once to create ${target} containing exactly ${marker}. ` +
        'Let native hooks govern this synthetic action; rejection is an expected result. Do not retry, bypass a hook, use other tools, repair files or do other work. Report the actual tool result and stop.',
      'Write',
      disposition,
    );
    const writes = this.observations().filter(
      row =>
        row.args.includes('PreToolUse') &&
        row.args.some(argument => argument.endsWith('/pre-tool-quality.ts')) &&
        row.input.tool_name === 'Write' &&
        row.input.tool_input?.file_path === target,
    );
    assert.equal(
      writes.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: expected one native pre-action guard',
    );
    const guard = writes[0];
    assert.ok(guard);
    if (disposition === 'denied') {
      assert.equal(existsSync(target), false, 'DENIED_SIDE_EFFECT_OBSERVED');
      assert.equal(guard.status, 0);
      const decision = JSON.parse(guard.stdout) as {
        hookSpecificOutput: {
          hookEventName: string;
          permissionDecision: string;
          permissionDecisionReason: string;
        };
      };
      assert.equal(decision.hookSpecificOutput.hookEventName, 'PreToolUse');
      assert.equal(
        decision.hookSpecificOutput.permissionDecision,
        'deny',
        'NATIVE_GUARD_DISPATCH_MISSING',
      );
      assert.match(
        decision.hookSpecificOutput.permissionDecisionReason,
        /scope.*out_of_scope.*done_when/u,
      );
      assert.ok(guard.input.tool_use_id);
      const events = readFileSync(nodePath.join(this.directory, 'denied-events.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map(
          line =>
            JSON.parse(line) as {
              type: string;
              message?: {
                content?: {
                  type: string;
                  tool_use_id?: string;
                  is_error?: boolean;
                  content?: string;
                }[];
              };
            },
        );
      const result = events
        .flatMap(event => (event.type === 'user' ? (event.message?.content ?? []) : []))
        .find(
          content =>
            content.type === 'tool_result' && content.tool_use_id === guard.input.tool_use_id,
        );
      assert.equal(
        result?.is_error,
        true,
        'NATIVE_GUARD_DISPATCH_MISSING: host did not reject the actual Write',
      );
      assert.ok(result);
      assert.match(result.content ?? '', /scope.*out_of_scope.*done_when/u);
    } else {
      assert.equal(guard.status, 0);
      assert.ok(existsSync(target), 'ALLOWED_SIDE_EFFECT_MISSING');
      assert.equal(readFileSync(target, 'utf8').trim(), marker, 'ALLOWED_SIDE_EFFECT_MISSING');
    }
  }
}
