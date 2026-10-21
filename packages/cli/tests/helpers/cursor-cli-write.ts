import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

const cliRoot = nodePath.resolve(import.meta.dirname, '../..');
const escapedQuote = String.raw`'\''`;
const quote = (value: string): string => `'${value.replaceAll("'", () => escapedQuote)}'`;
interface ShellResult {
  args: { command: string };
  result: {
    success?: { command: string; exitCode: number };
    rejected?: { command: string; reason: string };
  };
}

/** Real CLI/plugin boundary. Test hooks observe, never decide permission. */
export class CursorCliWriteActor {
  private readonly root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-cursor-cli-write-'));
  private readonly workspace = nodePath.join(this.root, 'workspace');
  private readonly candidate = nodePath.join(this.root, 'candidate');
  private readonly control = nodePath.join(this.root, 'observer');
  private readonly marker = `WRITE_${randomUUID()}`;
  private version = '';
  private disposition: 'allowed' | 'denied' = 'denied';
  private target = '';
  private shellCommand = '';
  private shell?: ShellResult;

  constructor(private readonly executable: string) {}

  prepare(host: string, version: string, runtime: string): void {
    assert.equal(host, 'Cursor');
    assert.equal(runtime, 'CLI');
    assert.ok(
      nodePath.isAbsolute(this.executable),
      'CURSOR_CLI_UNAVAILABLE: absolute binary required',
    );
    const actual = spawnSync(this.executable, ['--version'], { encoding: 'utf8', timeout: 20_000 });
    assert.equal(actual.status, 0, 'CURSOR_CLI_UNAVAILABLE: version probe');
    assert.equal(actual.stdout.trim(), version, 'CURSOR_CLI_UNAVAILABLE: exact version mismatch');
    this.version = version;
    for (const directory of [
      '.cursor',
      '.host-contract',
      '.safeword',
      '.project/tickets/sentinel-write',
    ])
      mkdirSync(nodePath.join(this.workspace, directory), { recursive: true });
    writeFileSync(
      nodePath.join(this.workspace, '.safeword/SAFEWORD.md'),
      'Synthetic project marker.\n',
    );
    writeFileSync(
      nodePath.join(this.workspace, '.safeword/config.json'),
      JSON.stringify({
        autoUpgrade: false,
        selfReport: { capture: false, surface: false, file: false },
      }),
    );
    writeFileSync(
      nodePath.join(this.workspace, '.cursor/cli.json'),
      JSON.stringify({
        permissions: { allow: ['Shell(printf)'], deny: [] },
      }),
    );
    const generator = nodePath.join(cliRoot, 'scripts/generate-cursor-plugin.ts');
    if (existsSync(generator)) {
      const generated = spawnSync('bun', [generator, '--output', this.candidate], {
        encoding: 'utf8',
        timeout: 120_000,
      });
      assert.equal(
        generated.status,
        0,
        `CURSOR_CLI_UNAVAILABLE: production generator: ${generated.stderr}`,
      );
    } else {
      // Loadable missing-product baseline only; no test-owned policy.
      mkdirSync(nodePath.join(this.candidate, '.cursor-plugin'), { recursive: true });
      writeFileSync(
        nodePath.join(this.candidate, '.cursor-plugin/plugin.json'),
        JSON.stringify({
          name: 'safeword-cursor-missing-guard-baseline',
        }),
      );
    }
    mkdirSync(nodePath.join(this.control, '.cursor-plugin'), { recursive: true });
    mkdirSync(nodePath.join(this.control, 'hooks'));
    writeFileSync(
      nodePath.join(this.control, '.cursor-plugin/plugin.json'),
      JSON.stringify({
        name: 'safeword-native-observer',
        hooks: './hooks/hooks.json',
      }),
    );
    const observer = `bun ${quote(nodePath.join(cliRoot, 'tests/fixtures/host-contract/cursor-write-observer.ts'))} native-cli-observer`;
    writeFileSync(
      nodePath.join(this.control, 'hooks/hooks.json'),
      JSON.stringify({
        version: 1,
        hooks: {
          sessionStart: [{ command: observer }],
          preToolUse: [{ command: observer }],
          afterShellExecution: [{ command: observer }],
        },
      }),
    );
    writeFileSync(
      nodePath.join(this.root, 'fixture.json'),
      JSON.stringify({
        host,
        version,
        runtime,
        workspace: this.workspace,
        candidate: this.candidate,
        generatedCandidate: existsSync(generator),
      }),
    );
    assert.equal(existsSync(nodePath.join(this.workspace, '.cursor/hooks.json')), false);
    assert.equal(existsSync(nodePath.join(this.workspace, '.claude')), false);
  }

  setPolicy(disposition: 'allowed' | 'denied'): void {
    this.disposition = disposition;
    this.target =
      disposition === 'denied'
        ? '.project/tickets/sentinel-write/ticket.md'
        : 'allowed-sentinel.txt';
    this.shellCommand = `printf ${this.marker} > ${this.target}`;
  }

  attempt(): void {
    const args = [
      '--workspace',
      this.workspace,
      '--plugin-dir',
      this.candidate,
      '--plugin-dir',
      this.control,
      '--trust',
      '--print',
      '--output-format',
      'stream-json',
    ];
    if (process.env.SAFEWORD_CURSOR_CLI_MODEL)
      args.push('--model', process.env.SAFEWORD_CURSOR_CLI_MODEL);
    args.push(
      `Run exactly one Shell attempt with this command: ${this.shellCommand}\n` +
        'Do not read files, use other tools, or retry after denial. Existing hooks govern the attempt. Then finish with one sentence.',
    );
    const environment = Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) => !name.startsWith('CLAUDE_') && !name.startsWith('SAFEWORD_'),
      ),
    );
    const result: SpawnSyncReturns<string> = spawnSync(this.executable, args, {
      cwd: this.workspace,
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...environment,
        CURSOR_CONFIG_DIR: nodePath.join(this.root, 'profile'),
        CLAUDE_CONFIG_DIR: nodePath.join(this.root, 'foreign-claude'),
      },
    });
    writeFileSync(nodePath.join(this.root, 'stdout.jsonl'), result.stdout ?? '');
    writeFileSync(nodePath.join(this.root, 'stderr.txt'), result.stderr ?? '');
    console.log(`Cursor CLI evidence: ${this.root}`);
    assert.equal(
      result.status,
      0,
      `CURSOR_CLI_UNAVAILABLE: incomplete process: ${result.status}/${result.signal}`,
    );
    const events = result.stdout
      .trim()
      .split('\n')
      .map(
        line =>
          JSON.parse(line) as {
            type: string;
            subtype?: string;
            tool_call?: { shellToolCall?: ShellResult };
          },
      );
    const calls = events.filter(row => row.type === 'tool_call' && row.subtype === 'completed');
    assert.equal(
      calls.length,
      1,
      'CURSOR_CLI_UNAVAILABLE: expected exactly one actual tool attempt',
    );
    this.shell = calls[0]?.tool_call?.shellToolCall;
    assert.ok(this.shell, 'CURSOR_CLI_UNAVAILABLE: expected actual Shell tool');
    assert.equal(
      this.shell.args.command,
      this.shellCommand,
      'CURSOR_CLI_UNAVAILABLE: command mismatch',
    );
    const observations = readFileSync(
      nodePath.join(this.workspace, '.host-contract/write-observations.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(
        line =>
          JSON.parse(line) as {
            event: string;
            source: string;
            version: string;
            tool?: string;
            command?: string;
          },
      );
    assert.equal(
      observations.filter(
        row =>
          row.event === 'preToolUse' &&
          row.source === 'native-cli-observer' &&
          row.version === this.version &&
          row.tool === 'Shell' &&
          row.command === this.shellCommand,
      ).length,
      1,
      'CURSOR_CLI_UNAVAILABLE: native observer did not see the exact attempt',
    );
  }

  assertOutcome(): void {
    assert.ok(this.shell);
    const target = nodePath.join(this.workspace, this.target);
    if (this.disposition === 'allowed') {
      assert.equal(
        this.shell.result.success?.command,
        this.shellCommand,
        'NATIVE_GUARD_DISPATCH_MISSING: allowed shell command did not execute',
      );
      assert.equal(this.shell.result.success.exitCode, 0);
      assert.equal(readFileSync(target, 'utf8'), this.marker);
      return;
    }
    assert.equal(
      existsSync(target),
      false,
      'NATIVE_GUARD_DISPATCH_MISSING: denied sentinel reached disk',
    );
    assert.equal(
      this.shell.result.rejected?.command,
      this.shellCommand,
      'NATIVE_GUARD_DISPATCH_MISSING: no native rejection of the exact command',
    );
    assert.match(
      this.shell.result.rejected.reason,
      /Shell commands can't change.*ticket/u,
      'NATIVE_GUARD_DISPATCH_MISSING: native rejection did not report the shared policy',
    );
  }
}
