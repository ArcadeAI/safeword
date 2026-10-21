import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';
import { setTimeout as pollInterval } from 'node:timers/promises';
import { promisify } from 'node:util';

import { observeExactHostVersion } from './host-contract-version.js';

const executeFile = promisify(execFile);
const cliRoot = nodePath.resolve(import.meta.dirname, '../..');
const fixtureSources = nodePath.join(cliRoot, 'tests', 'fixtures', 'host-contract');

export interface CursorNativeFixtureConfig {
  applicationBundle: string;
  profileDirectory: string;
  extensionsDirectory: string;
  runsDirectory: string;
  disabledClaudePlugins?: string[];
}

export async function command(
  executable: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {},
): Promise<string> {
  const result = await executeFile(executable, args, {
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 2 * 1024 * 1024,
    ...options,
  });
  return result.stdout;
}

function transientAccessibilityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Invalid index. (-1719)') ||
    message.includes('Error Domain=Native Agent input is not focused Code=5') ||
    message.includes('Error Domain=Expected one native Agent input Code=4') ||
    message.includes('Expected one isolated Agent input') ||
    message.includes('Could not activate the isolated Cursor process') ||
    message.includes('Could not raise the isolated Cursor window') ||
    (message.includes('Can’t get') && message.includes('(-1728)'))
  );
}

export async function eventually(
  description: string,
  read: () => boolean | Promise<boolean>,
): Promise<void> {
  const deadline = Date.now() + 120_000;
  let lastTransient: unknown;
  while (Date.now() < deadline) {
    try {
      const result = await read();
      if (result) return;
    } catch (error) {
      if (!transientAccessibilityError(error)) throw error;
      lastTransient = error;
    }
    await pollInterval(200);
  }
  throw new Error(`CURSOR_SETUP_UNAVAILABLE: ${description}`, { cause: lastTransient });
}

/** Shared owned-window automation; contains no policy or plugin admission logic. */
export class CursorNativeWindowActor {
  protected pid = 0;
  readonly runDirectory: string;
  readonly workspace: string;
  readonly windowTitle: string;
  readonly workspaceFile: string;

  constructor(
    protected readonly config: CursorNativeFixtureConfig,
    kind = 'catalogue',
  ) {
    mkdirSync(config.runsDirectory, { recursive: true });
    this.runDirectory = mkdtempSync(nodePath.join(config.runsDirectory, `${kind}-`));
    this.workspace = nodePath.join(this.runDirectory, 'workspace');
    this.windowTitle = `SAFEWORD isolated — ${nodePath.basename(this.runDirectory)}`;
    this.workspaceFile = nodePath.join(this.runDirectory, 'host-contract.code-workspace');
  }

  protected get cursorCli(): string {
    return nodePath.join(this.config.applicationBundle, 'Contents/Resources/app/bin/cursor');
  }

  protected get environment(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      CODEX_HOME: nodePath.join(this.runDirectory, 'foreign-codex-profile'),
      CLAUDE_CONFIG_DIR: nodePath.join(this.runDirectory, 'foreign-claude-profile'),
      OPENCODE_CONFIG_DIR: nodePath.join(this.runDirectory, 'foreign-opencode-profile'),
      SAFEWORD_CLI: nodePath.join(cliRoot, 'src', 'cli.ts'),
    };
  }

  protected async action(action: string, payload?: string): Promise<string> {
    const invoke = () =>
      command(nodePath.join(this.runDirectory, 'cursor-ide-native'), [
        String(this.pid),
        this.windowTitle,
        action,
        ...(payload ? [payload] : []),
      ]);
    // A dispatched action must never be repeated because a later UI read failed.
    // Only idempotent focus and read operations may retry transient AX readiness.
    if (!['activate', 'input', 'focused-input', 'snapshot', 'fill'].includes(action))
      return invoke();
    let output = '';
    await eventually(`stable native Accessibility controls for ${action}`, async () => {
      try {
        output = await invoke();
        return true;
      } catch (error) {
        // Draft replacement is idempotent and never submits. A foreground
        // change may interrupt its bounded key sequence; refill only that
        // owned window, retaining all PID/window/focus checks on every key.
        if (action === 'fill' && String(error).includes('Isolated Cursor lost foreground'))
          return false;
        throw error;
      }
    });
    return output;
  }

  protected payload(name: string, content: string): string {
    const destination = nodePath.join(this.runDirectory, name);
    writeFileSync(destination, content);
    return destination;
  }

  protected async snapshot(): Promise<string> {
    await this.action('activate');
    const text = await this.action('snapshot');
    writeFileSync(nodePath.join(this.runDirectory, 'last-ui.txt'), text);
    return text;
  }

  protected writeWorkspaceFolders(folders: string[]): void {
    writeFileSync(
      this.workspaceFile,
      `${JSON.stringify({ folders: folders.map(path => ({ path })), settings: { 'window.title': this.windowTitle } })}\n`,
    );
  }

  protected hookConfigurationLoads(): number {
    const pending = [nodePath.join(this.config.profileDirectory, 'logs')];
    while (pending.length > 0) {
      const directory = pending.pop();
      if (directory === undefined) break;
      const entries = readdirSync(directory, { withFileTypes: true });
      for (const entry of entries) {
        const path = nodePath.join(directory, entry.name);
        if (entry.isDirectory()) pending.push(path);
        else if (entry.name.startsWith('cursor.hooks.workspaceId-')) {
          const log = readFileSync(path, 'utf8');
          if (log.includes(this.workspace)) {
            return (log.match(/Loaded \d+ project hook\(s\)/gu) ?? []).length;
          }
        }
      }
    }
    return 0;
  }

  protected async findProcess(): Promise<number> {
    const processOutput = await command('ps', ['-axo', 'pid=,args=']);
    const rows = processOutput.split('\n');
    const executable = `${realpathSync(this.config.applicationBundle)}/Contents/MacOS/Cursor `;
    const matches = rows.flatMap(row => {
      const parsed = /^(\d+)[\t ]([\s\S]*)$/u.exec(row.trim());
      if (parsed === null) return [];
      const argumentsText = parsed[2]?.trimStart();
      if (!argumentsText?.startsWith(executable)) return [];
      return argumentsText.includes(`--user-data-dir ${this.config.profileDirectory} `)
        ? [Number(parsed[1])]
        : [];
    });
    if (matches.length > 1) return 0;
    const [pid] = matches;
    if (pid === undefined) throw new Error('CURSOR_SETUP_UNAVAILABLE: isolated process not found');
    return pid;
  }

  protected async freshAgent(): Promise<void> {
    await this.action('activate');
    await eventually('native New Agent control readiness', async () => {
      const text = await this.action('snapshot');
      return text.includes('New Agent (⌘N) [⌥] Replace Agent') || text.includes('New Agent (⇧⌘L)');
    });
    await this.action('new-agent');
    // Cursor can restore a draft in a new editor. The fill primitive replaces
    // and verifies it before submission; emptiness is not a readiness signal.
    await eventually('new Agent input control', async () => {
      await this.action('input');
      return true;
    });
  }

  protected async prepareHost(host: string, version: string, runtime: string): Promise<void> {
    if (process.platform !== 'darwin') throw new Error('CURSOR_SETUP_UNAVAILABLE: macOS required');
    const targets = JSON.parse(
      readFileSync(nodePath.join(fixtureSources, 'targets.json'), 'utf8'),
    ) as {
      targets: {
        agent: string;
        version: string;
        runtimes: string[];
        delivery_variants?: string[];
      }[];
    };
    const target = targets.targets.find(
      row =>
        row.agent === 'cursor' &&
        row.runtimes.includes('IDE') &&
        row.delivery_variants?.includes('native'),
    );
    assert.equal(host, 'Cursor');
    assert.equal(runtime, 'IDE');
    assert.equal(version, target?.version);
    const versionOutput = await command(this.cursorCli, ['--version']);
    const versionLines = versionOutput.trim().split(/\r?\n/u);
    assert.deepEqual(observeExactHostVersion(version, versionLines[0] ?? ''), {
      state: 'verified',
      version,
    });
    assert.equal(versionLines.length, 3, 'Expected Cursor version, build and architecture');
    assert.match(versionLines[1] ?? '', /^[a-f0-9]{40}$/u);
    assert.equal(versionLines[2], process.arch);
    await command('codesign', ['--verify', '--deep', '--strict', this.config.applicationBundle]);
    await command(
      'xcrun',
      [
        'swiftc',
        nodePath.join(fixtureSources, 'cursor-ide-native.swift'),
        '-o',
        nodePath.join(this.runDirectory, 'cursor-ide-native'),
      ],
      { timeout: 120_000 },
    );
  }

  protected async launchWindow(): Promise<void> {
    if (this.config.disabledClaudePlugins) {
      const directory = nodePath.join(this.workspace, '.claude');
      mkdirSync(directory, { recursive: true });
      const enabledPlugins = Object.fromEntries(
        this.config.disabledClaudePlugins.map(name => [name, false]),
      );
      writeFileSync(
        nodePath.join(directory, 'settings.local.json'),
        JSON.stringify({
          enabledPlugins,
        }),
      );
    }
    this.writeWorkspaceFolders([this.workspace]);
    await command(
      this.cursorCli,
      [
        '--user-data-dir',
        this.config.profileDirectory,
        '--extensions-dir',
        this.config.extensionsDirectory,
        '--locale',
        'en-US',
        '--new-window',
        this.workspaceFile,
      ],
      { env: this.environment },
    );
    await eventually('single exact editor process after launcher exit', async () => {
      this.pid = await this.findProcess();
      return this.pid > 0;
    });
    await eventually('named editor launch', async () => {
      try {
        await this.action('activate');
        return true;
      } catch (error) {
        if (error instanceof Error && error.message.includes('window is unavailable')) return false;
        throw error;
      }
    });
    await eventually('Agent controls', async () => {
      const text = await this.snapshot();
      if (text.includes('AI features require you to be logged in')) {
        throw new Error('CURSOR_SETUP_UNAVAILABLE: sign in to the isolated profile');
      }
      return text.includes('Show Terminal') || text.includes('Plan, Build,');
    });
  }
}
