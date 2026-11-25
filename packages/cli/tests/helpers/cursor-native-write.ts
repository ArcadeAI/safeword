import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { CursorNativeCatalogueActor } from './cursor-native-catalogue.js';
import { nativeCandidateDecisions } from './cursor-native-observations.js';
import {
  type CursorNativeFixtureConfig,
  CursorNativeWindowActor,
  eventually,
} from './cursor-native-window.js';
import {
  type CanonicalCatalogueInputs,
  createCanonicalCatalogueInputs,
  createNativeCatalogueProbe,
} from './native-catalogue-probe.js';
import { createPropagationSource, generatePropagationPackage } from './propagation-source.js';

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
  conversation?: string;
  generation?: string;
  loop?: number;
  status?: string;
  text?: string;
}

export { nativeCandidateDecisions } from './cursor-native-observations.js';

/** Real clean-workspace actions; observers and bootstrap contain no policy. */
export class CursorNativePluginActor extends CursorNativeWindowActor {
  protected candidate = '';
  protected version = '';

  constructor(
    config: CursorNativeFixtureConfig,
    kind = 'guard',
    private readonly inputs?: CanonicalCatalogueInputs,
  ) {
    super(config, kind);
  }

  protected observations(): Observation[] {
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

  /** Prepare owned package/discovery files only; no host, window or model run. */
  async prepareSources(version: string) {
    this.version = version;
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
    const inputs = this.inputs ?? createCanonicalCatalogueInputs(this.runDirectory);
    const canonical = {
      ...inputs,
      sourcePackage: inputs.sourcePackage ?? createPropagationSource(this.runDirectory, inputs),
    };
    const contentDirectory = nodePath.join(this.runDirectory, 'content');
    mkdirSync(contentDirectory);
    const probe = await createNativeCatalogueProbe(
      contentDirectory,
      undefined,
      'explain',
      canonical,
    );
    const core = probe.packageRoot;
    const candidate = nodePath.join(this.runDirectory, 'candidate');
    this.candidate = candidate;
    await generatePropagationPackage(canonical, candidate, 'cursor');
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
    return { core, candidate, control };
  }

  async prepare(host: string, version: string, runtime: string): Promise<void> {
    this.version = version;
    assert.ok(
      Array.isArray(this.config.disabledClaudePlugins),
      'CURSOR_SETUP_UNAVAILABLE: declare imported plugins to suppress only in the test workspace',
    );
    // Separate legacy fixture proves the existing tool/hook control still works.
    const legacy = new CursorNativeCatalogueActor(this.config);
    await legacy.prepare(host, version, runtime, 'project-hooks');
    await this.prepareHost(host, version, runtime);
    const { core, candidate, control } = await this.prepareSources(version);
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
        generatedCandidate: true,
        version,
      }),
    );
  }
}

/** Real write actions on the shared clean native-plugin fixture. */
export class CursorNativeWriteActor extends CursorNativePluginActor {
  private disposition: 'allowed' | 'denied' = 'allowed';
  private readonly marker = `WRITE_${randomUUID()}`;
  private target = '';
  private shellCommand = '';

  private decisions(): { permission?: string; user_message?: string }[] {
    return nativeCandidateDecisions(this.hookLog(), this.candidate, this.shellCommand);
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
