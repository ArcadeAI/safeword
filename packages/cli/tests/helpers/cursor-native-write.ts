import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { writePortableCoreCatalogue } from '../../src/host-contract/portable-core.js';
import { VERSION } from '../../src/version.js';
import { CursorNativeCatalogueActor } from './cursor-native-catalogue.js';
import {
  type CursorNativeFixtureConfig,
  CursorNativeWindowActor,
  eventually,
} from './cursor-native-window.js';

const cliRoot = nodePath.resolve(import.meta.dirname, '../..');
const fixtures = nodePath.join(cliRoot, 'tests/fixtures/host-contract');
const escapedQuote = String.raw`'\''`;
const quote = (value: string): string => `'${value.replaceAll("'", () => escapedQuote)}'`;

interface Observation {
  event: string;
  source: string;
  version: string;
  tool?: string;
  command?: string;
}

interface NativeAction {
  hook_event_name?: string;
  command?: string;
  tool_input?: { command?: string };
}

function matchesNativeAction(input: NativeAction, shellCommand: string): boolean {
  return (
    ['preToolUse', 'beforeShellExecution'].includes(input.hook_event_name ?? '') &&
    (input.command ?? input.tool_input?.command) === shellCommand
  );
}

export function nativeCandidateDecisions(
  log: string,
  candidate: string,
  shellCommand: string,
): { permission?: string; user_message?: string }[] {
  const rows: { permission?: string; user_message?: string }[] = [];
  const blocks = log.matchAll(
    /Command: ([^\n]+)\n\nINPUT:\n([\s\S]*?)\n\nOUTPUT:\n([\s\S]*?)\n═+\r?\n/gu,
  );
  for (const block of blocks) {
    const header = block[1] ?? '';
    if (!header.includes(candidate) || !/exit code: [02]$/u.test(header)) continue;
    const input = JSON.parse(block[2] ?? '{}') as NativeAction;
    if (!matchesNativeAction(input, shellCommand)) continue;
    const output = block[3]?.trim();
    if (!output || output === '(empty)') continue;
    rows.push(JSON.parse(output) as { permission?: string; user_message?: string });
  }
  return rows;
}

/** Real clean-workspace actions; observers and bootstrap contain no policy. */
export class CursorNativeWriteActor extends CursorNativeWindowActor {
  private disposition: 'allowed' | 'denied' = 'allowed';
  private readonly marker = `WRITE_${randomUUID()}`;
  private target = '';
  private shellCommand = '';
  private candidate = '';
  private version = '';

  constructor(config: CursorNativeFixtureConfig) {
    super(config, 'guard');
  }

  private observations(): Observation[] {
    const file = nodePath.join(this.workspace, '.host-contract/write-observations.jsonl');
    if (!existsSync(file)) return [];
    const text = readFileSync(file, 'utf8');
    // Only complete appended records are observable; do not parse a partial tail.
    return text
      .slice(0, text.lastIndexOf('\n') + 1)
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as Observation);
  }

  private hookLog(): string {
    const pending = [nodePath.join(this.config.profileDirectory, 'logs')];
    const logs: string[] = [];
    while (pending.length > 0) {
      const directory = pending.pop();
      if (!directory || !existsSync(directory)) continue;
      const entries = readdirSync(directory, { withFileTypes: true });
      for (const entry of entries) {
        const path = nodePath.join(directory, entry.name);
        if (entry.isDirectory()) pending.push(path);
        else if (entry.name.startsWith('cursor.hooks.workspaceId-')) {
          const text = readFileSync(path, 'utf8');
          if (text.includes(this.workspace)) logs.push(text);
        }
      }
    }
    return logs.join('\n');
  }

  private decisions(): { permission?: string; user_message?: string }[] {
    return nativeCandidateDecisions(this.hookLog(), this.candidate, this.shellCommand);
  }

  async prepare(host: string, version: string, runtime: string): Promise<void> {
    this.version = version;
    assert.ok(
      Array.isArray(this.config.disabledClaudePlugins),
      'CURSOR_SETUP_UNAVAILABLE: declare imported plugins to suppress only in the test workspace',
    );
    // Separate legacy fixture proves the existing tool/hook control still works.
    const legacy = new CursorNativeCatalogueActor(this.config);
    await legacy.prepare(host, version, runtime);
    await this.prepareHost(host, version, runtime);
    mkdirSync(this.workspace);
    for (const directory of [
      '.cursor',
      '.host-contract',
      '.safeword',
      '.project/tickets/sentinel-write',
    ]) {
      mkdirSync(nodePath.join(this.workspace, directory), { recursive: true });
    }
    writeFileSync(nodePath.join(this.workspace, 'README.md'), '# Synthetic native guard project\n');
    writeFileSync(
      nodePath.join(this.workspace, '.safeword/SAFEWORD.md'),
      'Synthetic Safeword project marker.\n',
    );
    writeFileSync(
      nodePath.join(this.workspace, '.safeword/config.json'),
      JSON.stringify({
        autoUpgrade: false,
        selfReport: { capture: false, surface: false, file: false },
      }),
    );
    const core = nodePath.join(this.runDirectory, 'core');
    writePortableCoreCatalogue(nodePath.join(cliRoot, 'templates'), core, VERSION);
    cpSync(nodePath.join(cliRoot, 'codex-plugin/runtime'), nodePath.join(core, 'runtime'), {
      recursive: true,
    });
    const candidate = nodePath.join(this.runDirectory, 'candidate');
    this.candidate = candidate;
    const generated = nodePath.join(cliRoot, 'cursor-plugin');
    if (existsSync(generated)) cpSync(generated, candidate, { recursive: true });
    else {
      // Baseline container establishes a startable missing-guard RED. It cannot
      // decide permission or stand in for a generated production extension.
      mkdirSync(nodePath.join(candidate, '.cursor-plugin'), { recursive: true });
      writeFileSync(
        nodePath.join(candidate, '.cursor-plugin/plugin.json'),
        JSON.stringify({
          name: 'safeword-native-guard-candidate',
          version: VERSION,
        }),
      );
    }
    const observer = `bun ${quote(nodePath.join(fixtures, 'cursor-write-observer.ts'))}`;
    const control = nodePath.join(this.runDirectory, 'native-control');
    mkdirSync(nodePath.join(control, '.cursor-plugin'), { recursive: true });
    mkdirSync(nodePath.join(control, 'hooks'));
    writeFileSync(
      nodePath.join(control, '.cursor-plugin/plugin.json'),
      JSON.stringify({
        name: 'host-contract-native-hook-control',
        hooks: './hooks/hooks.json',
      }),
    );
    writeFileSync(
      nodePath.join(control, 'hooks/hooks.json'),
      JSON.stringify({
        version: 1,
        hooks: {
          workspaceOpen: [{ command: `${observer} native-control` }],
          preToolUse: [{ command: `${observer} native-control` }],
        },
      }),
    );
    const discovery = nodePath.join(this.workspace, '.host-contract/workspace-open-config.json');
    writeFileSync(
      discovery,
      JSON.stringify({
        workspace: this.workspace,
        version,
        pluginPaths: [core, candidate, control],
      }),
    );
    const discoveryScript = quote(nodePath.join(fixtures, 'workspace-open-probe.ts'));
    writeFileSync(
      nodePath.join(this.workspace, '.cursor/hooks.json'),
      JSON.stringify({
        version: 1,
        hooks: {
          workspaceOpen: [
            {
              command: `bun ${discoveryScript} ${quote(discovery)}`,
            },
          ],
          preToolUse: [{ command: observer }],
          afterShellExecution: [{ command: observer }],
          stop: [{ command: observer }],
        },
      }),
    );
    assert.equal(existsSync(nodePath.join(this.workspace, '.claude')), false);
    assert.equal(existsSync(nodePath.join(this.workspace, '.cursor/commands')), false);
    assert.equal(existsSync(nodePath.join(this.workspace, '.cursor/rules')), false);
    await this.launchWindow();
    const secondary = nodePath.join(this.runDirectory, 'empty-secondary');
    mkdirSync(secondary);
    const record = nodePath.join(this.workspace, '.host-contract/workspace-open.json');
    for (let attempt = 0; attempt < 3 && !existsSync(record); attempt++) {
      const count = this.hookConfigurationLoads();
      this.writeWorkspaceFolders([this.workspace, secondary]);
      await eventually('native folder addition', () => this.hookConfigurationLoads() > count);
      const added = this.hookConfigurationLoads();
      this.writeWorkspaceFolders([this.workspace]);
      await eventually('native folder removal', () => this.hookConfigurationLoads() > added);
    }
    await eventually('native bootstrap invocation', () => existsSync(record));
    await eventually('host native-control registration', () =>
      this.hookLog().includes(`workspaceOpen: registered plugin path "${control}"`),
    );
    const loaded = this.hookConfigurationLoads();
    this.writeWorkspaceFolders([this.workspace, secondary]);
    await eventually(
      'native control folder addition',
      () => this.hookConfigurationLoads() > loaded,
    );
    const added = this.hookConfigurationLoads();
    this.writeWorkspaceFolders([this.workspace]);
    await eventually('native control folder removal', () => this.hookConfigurationLoads() > added);
    await eventually('native plugin lifecycle dispatch control', () =>
      this.observations().some(
        row =>
          row.source === 'native-control' &&
          row.event === 'workspaceOpen' &&
          row.version === version,
      ),
    );
    const log = this.hookLog();
    assert.equal(
      log.includes('Claude Code hooks disabled'),
      false,
      'CURSOR_SETUP_UNAVAILABLE: import switch also disables native plugin hooks',
    );
    assert.equal(
      log.includes('/.claude/plugins/'),
      false,
      'CURSOR_SETUP_UNAVAILABLE: competing imported plugin hook remains active',
    );
    assert.ok(
      log.includes('No user hooks configuration found'),
      'CURSOR_SETUP_UNAVAILABLE: competing user hooks',
    );
    assert.ok(
      log.includes('No enterprise hooks configuration found'),
      'CURSOR_SETUP_UNAVAILABLE: competing enterprise hooks',
    );
    writeFileSync(
      nodePath.join(this.runDirectory, 'fixture.json'),
      JSON.stringify({
        workspace: this.workspace,
        candidate,
        core,
        control,
        legacyControl: legacy.runDirectory,
        generatedCandidate: existsSync(generated),
        version,
      }),
    );
  }

  setPolicy(disposition: 'allowed' | 'denied'): void {
    this.disposition = disposition;
    const relative =
      disposition === 'denied'
        ? '.project/tickets/sentinel-write/ticket.md'
        : 'allowed-sentinel.txt';
    this.target = nodePath.join(this.workspace, relative);
    this.shellCommand = `printf %s ${this.marker} > ${relative}`;
    assert.equal(existsSync(this.target), false);
  }

  async attempt(): Promise<void> {
    await this.freshAgent();
    const prompt = this.payload(
      'write-prompt.txt',
      `Authorized isolated native hook test. Use your Shell tool exactly once to attempt: ${this.shellCommand} . ` +
        `Let existing native hooks govern this synthetic write; rejection is an expected test outcome. ` +
        `Do not bypass a hook, retry, use another tool, invoke workflows, read files, or do other work. Report the actual result and stop.`,
    );
    await this.action('fill', prompt);
    await this.action('submit', prompt);
    await eventually('actual native tool attempt and completion', async () => {
      const rows = this.observations();
      const text = await this.snapshot();
      writeFileSync(nodePath.join(this.runDirectory, 'write-ui.txt'), text);
      return (
        (this.decisions().length > 0 ||
          rows.some(
            row =>
              row.event === 'preToolUse' &&
              row.tool === 'Shell' &&
              row.command?.includes(this.shellCommand),
          )) &&
        rows.some(row => row.event === 'stop')
      );
    });
    const rows = this.observations();
    assert.ok(
      rows.some(
        row =>
          row.source === 'native-control' &&
          row.event === 'preToolUse' &&
          row.version === this.version &&
          row.command?.includes(this.shellCommand),
      ),
      'CURSOR_SETUP_UNAVAILABLE: native plugin hook control did not load',
    );
    const log = this.hookLog();
    writeFileSync(nodePath.join(this.runDirectory, 'native-hooks.log'), log);
    assert.equal(log.includes('/.claude/plugins/'), false);
  }

  assertOutcome(): void {
    if (this.disposition === 'allowed') {
      assert.ok(
        this.decisions().some(row => row.permission === 'allow'),
        'NATIVE_GUARD_DISPATCH_MISSING: candidate did not allow the exact native action',
      );
      assert.equal(readFileSync(this.target, 'utf8'), this.marker);
      return;
    }
    assert.equal(
      existsSync(this.target),
      false,
      'NATIVE_GUARD_DISPATCH_MISSING: denied sentinel reached disk',
    );
    assert.ok(
      this.decisions().some(
        row =>
          row.permission === 'deny' &&
          row.user_message?.includes(
            "Safeword can't check what a shell command writes to a ticket file",
          ),
      ),
      'NATIVE_GUARD_DISPATCH_MISSING: native shared policy denial was not observed',
    );
  }
}
