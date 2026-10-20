import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import {
  createCursorCatalogueProbe,
  CURSOR_CATALOGUE_PROBE_DESCRIPTION,
  type CursorCatalogueProbe,
} from './cursor-catalogue-probe.js';
import { command, CursorNativeWindowActor, eventually } from './cursor-native-window.js';
export type { CursorNativeFixtureConfig } from './cursor-native-window.js';

const cliRoot = nodePath.resolve(import.meta.dirname, '../..');
const repoRoot = nodePath.resolve(cliRoot, '../..');
const fixtureSources = nodePath.join(cliRoot, 'tests', 'fixtures', 'host-contract');

/** Real IDE actor for the catalogue scenario only; never package admission evidence. */
export class CursorNativeCatalogueActor extends CursorNativeWindowActor {
  private probe: CursorCatalogueProbe | undefined;
  private lastSnapshot = '';

  private async checkPackagedHelper(): Promise<void> {
    assert.ok(this.probe);
    const check = nodePath.join(this.runDirectory, 'helper-selfcheck');
    mkdirSync(nodePath.join(check, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(check, '.host-contract'));
    cpSync(
      nodePath.join(this.probe.packageRoot, 'templates/SAFEWORD.md'),
      nodePath.join(check, '.safeword/SAFEWORD.md'),
    );
    const output = await command(
      'bun',
      [
        nodePath.join(this.probe.packageRoot, 'runtime/cli.js'),
        'project',
        'runtime',
        'audit-principle-trace',
        '--cwd',
        check,
        '--',
        check,
      ],
      { env: this.environment, cwd: check },
    );
    assert.equal(
      output.trim(),
      this.probe.helperMarker,
      'Packaged helper must work before the IDE trial',
    );
    const record = JSON.parse(
      readFileSync(nodePath.join(check, '.host-contract/native-helper.json'), 'utf8'),
    ) as { marker: string; origin: string };
    assert.equal(record.marker, this.probe.helperMarker);
    assert.equal(
      realpathSync(record.origin),
      realpathSync(
        nodePath.join(this.probe.packageRoot, 'templates/hooks/audit-principle-trace.ts'),
      ),
    );
  }

  private async proveExistingHookControl(): Promise<void> {
    const marker = `BASELINE_${randomUUID()}`;
    const destination = nodePath.join(this.workspace, '.host-contract/allowed.txt');
    await this.freshAgent();
    const prompt = this.payload(
      'allowed-prompt.txt',
      `Isolated compatibility preflight: using only your file editing tool, create .host-contract/allowed.txt containing exactly ${marker} on one line. Do not run commands, install packages, use MCP, commit, or modify other files. Report the result.`,
    );
    await this.action('fill', prompt);
    await this.action('submit', prompt);
    await eventually('existing project-hook allowed control', () => existsSync(destination));
    assert.equal(readFileSync(destination, 'utf8'), `${marker}\n`);
    const trace = nodePath.join(this.workspace, '.host-contract/hooks.jsonl');
    const allowDigest = createHash('sha256').update('{"permission":"allow"}\n').digest('hex');
    await eventually('real pre-edit hook observation', () => {
      if (!existsSync(trace)) return false;
      const rows = readFileSync(trace, 'utf8')
        .trim()
        .split('\n')
        .map(
          line =>
            JSON.parse(line) as {
              event: string;
              exit_code: number;
              stdout_sha256: string;
            },
        );
      return rows.some(
        row =>
          row.event === 'preToolUse' && row.exit_code === 0 && row.stdout_sha256 === allowDigest,
      );
    });
    await eventually('allowed control turn completion', () => {
      const rows = readFileSync(trace, 'utf8')
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as { event: string; exit_code: number });
      return rows.some(row => row.event === 'stop' && row.exit_code === 0);
    });
    appendFileSync(
      nodePath.join(this.runDirectory, 'controls.jsonl'),
      `${JSON.stringify({ control: 'existing-project-hook', marker, passed: true })}\n`,
    );
  }

  async prepare(host: string, version: string, runtime: string): Promise<void> {
    await this.prepareHost(host, version, runtime);
    mkdirSync(this.workspace);
    writeFileSync(
      nodePath.join(this.workspace, 'README.md'),
      '# Synthetic host contract project\n',
    );
    const installed = JSON.parse(
      await command(
        'bun',
        [
          nodePath.join(cliRoot, 'src/cli.ts'),
          'install',
          '--agents',
          'cursor',
          '--cwd',
          this.workspace,
          '--offline',
          '--no-input',
          '--no-modify',
          '--json',
        ],
        { cwd: repoRoot, env: this.environment },
      ),
    ) as { ok: boolean; data: { selected_agents: string[] } };
    assert.equal(installed.ok, true);
    assert.deepEqual(installed.data.selected_agents, ['cursor']);
    const probeDirectory = nodePath.join(this.workspace, '.host-contract');
    mkdirSync(probeDirectory);
    const configFile = nodePath.join(this.workspace, '.safeword/config.json');
    const settings = JSON.parse(readFileSync(configFile, 'utf8')) as Record<string, unknown>;
    writeFileSync(
      configFile,
      `${JSON.stringify({
        ...settings,
        autoUpgrade: false,
        selfReport: { capture: false, surface: false, file: false },
      })}\n`,
    );
    for (const name of ['.mcp.json', '.cursor/mcp.json']) {
      writeFileSync(nodePath.join(this.workspace, name), '{"mcpServers":{}}\n');
    }
    this.probe = await createCursorCatalogueProbe(this.runDirectory);
    await this.checkPackagedHelper();
    const controlDirectory = nodePath.join(this.runDirectory, 'discovery-control');
    cpSync(nodePath.join(fixtureSources, 'discovery-control'), controlDirectory, {
      recursive: true,
    });
    const discoveryConfig = nodePath.join(probeDirectory, 'workspace-open-config.json');
    writeFileSync(
      discoveryConfig,
      `${JSON.stringify({
        workspace: this.workspace,
        version,
        pluginPaths: [controlDirectory, this.probe.packageRoot],
      })}\n`,
    );
    const hookFile = nodePath.join(this.workspace, '.cursor/hooks.json');
    const hooks = JSON.parse(readFileSync(hookFile, 'utf8')) as {
      hooks: Record<string, { command: string }[]>;
    };
    // These generated paths contain no shell metacharacters; quote every argument anyway.
    const escapedQuote = String.raw`'\''`;
    const quote = (value: string): string => `'${value.replaceAll("'", () => escapedQuote)}'`;
    for (const [event, entries] of Object.entries(hooks.hooks)) {
      for (const entry of entries) {
        entry.command = `bun ${quote(nodePath.join(fixtureSources, 'cursor-hook-observer.ts'))} ${quote(event)} ${quote(entry.command)}`;
      }
    }
    hooks.hooks.workspaceOpen = [
      {
        command: `bun ${quote(nodePath.join(fixtureSources, 'workspace-open-probe.ts'))} ${quote(discoveryConfig)}`,
      },
    ];
    hooks.hooks.afterShellExecution = [
      {
        command: `bun ${quote(nodePath.join(fixtureSources, 'cursor-hook-observer.ts'))} 'afterShellExecution' ':'`,
      },
    ];
    writeFileSync(hookFile, `${JSON.stringify(hooks)}\n`);
    await this.launchWindow();
    await this.proveExistingHookControl();
    const secondary = nodePath.join(this.runDirectory, 'empty-secondary');
    mkdirSync(secondary);
    const discoveryRecord = nodePath.join(probeDirectory, 'workspace-open.json');
    const expectedPackage = this.probe.packageRoot;
    // Given-only setup: folder changes are real host events. Exact 3.8.23 can
    // request workspaceOpen before hook reload finishes. Never retry the When;
    // leave the legacy hooks active and bound discovery preparation to 3 cycles.
    for (let attempt = 0; attempt < 3 && !existsSync(discoveryRecord); attempt++) {
      const beforeAddition = this.hookConfigurationLoads();
      this.writeWorkspaceFolders([this.workspace, secondary]);
      await eventually('workspace folder addition', async () => {
        const text = await this.snapshot();
        return text.includes('empty-secondary');
      });
      await eventually(
        'hook configuration after folder addition',
        () => this.hookConfigurationLoads() > beforeAddition,
      );
      const beforeRemoval = this.hookConfigurationLoads();
      this.writeWorkspaceFolders([this.workspace]);
      await eventually('workspace folder removal', async () => {
        const text = await this.snapshot();
        return !text.includes('empty-secondary');
      });
      await eventually(
        'hook configuration after folder removal',
        () => this.hookConfigurationLoads() > beforeRemoval,
      );
      appendFileSync(
        nodePath.join(this.runDirectory, 'controls.jsonl'),
        `${JSON.stringify({ control: 'native-discovery-preparation', attempt: attempt + 1, configurationLoads: this.hookConfigurationLoads() })}\n`,
      );
    }
    await eventually('native workspace discovery', () => {
      if (!existsSync(discoveryRecord)) return false;
      const record = JSON.parse(readFileSync(discoveryRecord, 'utf8')) as { pluginPaths: string[] };
      return record.pluginPaths.includes(expectedPackage);
    });
    writeFileSync(
      nodePath.join(this.runDirectory, 'probe.json'),
      `${JSON.stringify(this.probe)}\n`,
    );
  }

  confirmCanonicalProbe(): void {
    assert.ok(this.probe);
    assert.ok(existsSync(nodePath.join(this.probe.packageRoot, 'skills/explain/SKILL.md')));
    assert.equal(
      existsSync(nodePath.join(this.workspace, '.host-contract/native-helper.json')),
      false,
    );
  }

  async invokeWorkflow(): Promise<void> {
    assert.ok(this.probe);
    await this.freshAgent();
    const prompt = this.payload('native-prompt.txt', '/explain');
    await this.action('fill', prompt);
    const label = this.payload(
      'native-label.txt',
      `/explain ${CURSOR_CATALOGUE_PROBE_DESCRIPTION}`,
    );
    await this.action('select-workflow', label);
    await eventually('native workflow selection', async () => {
      const output = await this.action('input');
      const input = output.endsWith('\n') ? output.slice(0, -1) : output;
      return input === '/explain \n' || input === '/explain ';
    });
    writeFileSync(prompt, '/explain ');
    await this.action('submit', prompt);
    const expected = this.probe;
    await eventually('native workflow and helper response', async () => {
      const text = await this.snapshot();
      this.lastSnapshot = text;
      const contentLoaded =
        text.includes(expected.workflowMarker) && text.includes(expected.guideMarker);
      const compactText = text.replaceAll(/\s/gu, '');
      return (
        contentLoaded &&
        (text.includes(expected.helperMarker) ||
          (text.includes('Module not found') &&
            compactText.includes('foreign-codex-profile/') &&
            compactText.includes('runtime/cli.js')))
      );
    });
  }

  assertPackagedResult(): void {
    assert.ok(this.probe);
    assert.ok(this.lastSnapshot.includes(this.probe.workflowMarker));
    assert.ok(this.lastSnapshot.includes(this.probe.guideMarker));
    const observations = readFileSync(
      nodePath.join(this.workspace, '.host-contract/hooks.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(
        line =>
          JSON.parse(line) as {
            native_shell?: {
              helper_command_called: boolean;
              foreign_cache_failure: boolean;
              helper_markers: string[];
            };
          },
      );
    const shells = observations.flatMap(row => (row.native_shell ? [row.native_shell] : []));
    assert.ok(
      shells.some(row => row.helper_command_called),
      'Actual host must observe the helper command',
    );
    const resultFile = nodePath.join(this.workspace, '.host-contract/native-helper.json');
    if (!existsSync(resultFile)) {
      const compactText = this.lastSnapshot.replaceAll(/\s/gu, '');
      assert.ok(
        compactText.includes('foreign-codex-profile/') && compactText.includes('runtime/cli.js'),
        'The intended failure requires an observed foreign-cache call, not an arbitrary helper failure',
      );
      assert.ok(
        shells.some(row => row.helper_command_called && row.foreign_cache_failure),
        'Actual shell output must confirm the foreign-cache module failure',
      );
      assert.fail(
        'NATIVE_HELPER_ORIGIN_MISMATCH: workflow and guide loaded, but the actual helper call targeted a foreign Codex cache instead of its available package runtime',
      );
    }
    const record = JSON.parse(readFileSync(resultFile, 'utf8')) as {
      marker: string;
      origin: string;
    };
    assert.equal(record.marker, this.probe.helperMarker);
    assert.equal(
      realpathSync(record.origin),
      realpathSync(
        nodePath.join(this.probe.packageRoot, 'templates/hooks/audit-principle-trace.ts'),
      ),
    );
    assert.ok(this.lastSnapshot.includes(this.probe.helperMarker));
    assert.ok(
      shells.some(row => row.helper_command_called && row.helper_markers.includes(record.marker)),
      'The actual packaged helper invocation must produce the marker in that same shell result',
    );
  }
}
