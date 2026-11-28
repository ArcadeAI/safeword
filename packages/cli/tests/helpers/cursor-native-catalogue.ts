import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { reconcileGeneratedTree } from '../../scripts/generated-tree-differences.js';
import { cursorPluginBindings, cursorPluginHookCommand } from '../../src/cursor-plugin/bindings.js';
import { renderCursorCommandWrapper } from '../../src/cursor-wrappers.js';
import { readCanonicalCommandWrappers } from '../../src/host-contract/catalogue.js';
import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import {
  nativeArchitectureCap,
  nativeArchitectureStops,
  nativeCommandWords,
  nativeDesignObservation,
  nativeHandoffEdit,
  nativeHookCommand,
  nativeHookRecords,
  nativeVerificationObservation,
} from './cursor-native-observations.js';
import {
  command,
  type CursorNativeFixtureConfig,
  CursorNativeWindowActor,
  eventually,
} from './cursor-native-window.js';
import {
  createCursorProjectSource,
  refreshCursorProjectCatalogue,
} from './cursor-project-catalogue.js';
import {
  type CanonicalCatalogueInputs,
  createCanonicalCatalogueInputs,
  createNativeCatalogueProbe,
  NATIVE_CATALOGUE_PROBE_DESCRIPTION,
  type NativeCatalogueProbe,
  observedCatalogueMarkers,
  refreshNativeCatalogueProbe,
} from './native-catalogue-probe.js';
import {
  preparePropagationCompletion,
  preparePropagationDesignApproval,
  preparePropagationReadiness,
  type PropagationArchitectureCase,
} from './propagation-policy-case.js';
import {
  createPropagationSource,
  generatePropagationPackage,
  installedPropagationPaths,
  propagationVerificationOwner,
  synchronizePropagationSource,
} from './propagation-source.js';
export type { CursorNativeFixtureConfig } from './cursor-native-window.js';

const cliRoot = nodePath.resolve(import.meta.dirname, '../..');
const fixtureSources = nodePath.join(cliRoot, 'tests', 'fixtures', 'host-contract');

/** Real IDE actor for the catalogue scenario only; never package admission evidence. */
export class CursorNativeCatalogueActor extends CursorNativeWindowActor {
  private probe: NativeCatalogueProbe | undefined;
  private lastSnapshot = '';
  private projectDelivery = false;
  private portableDelivery = false;
  private projectSource = '';
  private canonical?: CanonicalCatalogueInputs;
  private readonly observedHookCommands = new Map<string, string>();
  private handoffConversation = '';

  constructor(
    config: CursorNativeFixtureConfig,
    private readonly inputs?: CanonicalCatalogueInputs,
  ) {
    super(config);
  }

  private hasNativeFollowup(row: ReturnType<typeof nativeHookRecords>[number] | undefined) {
    return !!row && !!JSON.parse(row.output).followup_message;
  }

  private recordNativeLog(path: string, start: Map<string, number>) {
    const sources = this.hookLogSources();
    writeFileSync(path, sources.map(row => row.text).join('\n'));
    return sources.map(row => ({ path: row.path, text: row.text.slice(start.get(row.path) ?? 0) }));
  }

  private handoffFileEffect(path: string) {
    return existsSync(path) ? readFileSync(path, 'utf8') : '';
  }

  private handoffConfiguration(path: string): Record<string, unknown> {
    return JSON.parse(readFileSync(path, 'utf8'));
  }

  private handoffBootstrapDocuments() {
    assert.ok(this.probe);
    const root = nodePath.join(this.probe.packageRoot, this.projectDelivery ? '' : 'templates');
    const documents = [
      ...new Set([
        nodePath.join(this.workspace, '.safeword/SAFEWORD.md'),
        nodePath.join(root, 'SAFEWORD.md'),
        nodePath.join(root, 'guides/testing-guide.md'),
      ]),
    ];
    for (const document of documents)
      assert.ok(
        existsSync(document),
        'HOST_CONTRACT_PROOF_UNAVAILABLE: bootstrap document missing',
      );
    return documents;
  }

  private handoffBootstrapObservation(
    rows: ReturnType<typeof nativeHookRecords>,
    args: string[],
    observer: string[],
    documents: string[],
  ) {
    const setup = rows.filter(row => nativeHookCommand(row, args));
    assert.equal(setup.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: bootstrap Stop cardinality');
    const conversation = setup[0]?.input.conversation_id ?? '';
    const raw = rows.map(row => row.raw).join('\n');
    const context = {
      conversation,
      workspace: realpathSync(this.workspace),
      version: hostReleases.cursorIde.version,
    };
    const stops = nativeArchitectureStops(raw, args, context);
    assert.ok(
      stops[0]?.input.loop_count === 0 && !stops[0].followup,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: bootstrap correction consumed',
    );
    const response = rows.filter(row => nativeHookCommand(row, observer));
    assert.equal(
      response.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: bootstrap response cardinality',
    );
    assert.ok(
      response[0]?.exit === 0 && response[0].input.text?.trim() === 'READY',
      'HOST_CONTRACT_PROOF_UNAVAILABLE: bootstrap completion missing',
    );
    assert.equal(response[0].input.hook_event_name, 'afterAgentResponse');
    assert.equal(response[0].input.cursor_version, context.version);
    assert.deepEqual(response[0].input.workspace_roots, [context.workspace]);
    assert.equal(response[0].input.conversation_id, conversation);
    assert.equal(response[0].input.generation_id, stops[0]?.input.generation_id);
    assert.ok(
      rows.every(row => row.input.hook_event_name !== 'afterFileEdit'),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: bootstrap edited files',
    );
    return { conversation, documents, stops, response: response[0], raw };
  }

  private helperOrigin(): string {
    assert.ok(this.probe);
    return this.projectDelivery
      ? nodePath.join(this.workspace, '.safeword/hooks/audit-principle-trace.ts')
      : nodePath.join(this.probe.packageRoot, 'templates/hooks/audit-principle-trace.ts');
  }

  private async checkPackagedHelper(): Promise<void> {
    assert.ok(this.probe);
    const check = nodePath.join(this.runDirectory, 'helper-selfcheck');
    mkdirSync(nodePath.join(check, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(check, '.host-contract'));
    cpSync(
      nodePath.join(
        this.probe.packageRoot,
        this.projectDelivery ? 'SAFEWORD.md' : 'templates/SAFEWORD.md',
      ),
      nodePath.join(check, '.safeword/SAFEWORD.md'),
    );
    const output = await command(
      'bun',
      this.projectDelivery
        ? [this.helperOrigin(), check]
        : [
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
    assert.equal(realpathSync(record.origin), realpathSync(this.helperOrigin()));
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

  private instrumentHooks(probeDirectory: string): void {
    const hookFile = nodePath.join(this.workspace, '.cursor/hooks.json');
    const hooks = JSON.parse(readFileSync(hookFile, 'utf8')) as {
      hooks: Record<string, { command: string }[]>;
    };
    // These generated paths contain no shell metacharacters; quote every argument anyway.
    const escapedQuote = String.raw`'\''`;
    const quote = (value: string): string => `'${value.replaceAll("'", () => escapedQuote)}'`;
    for (const [event, entries] of Object.entries(hooks.hooks)) {
      for (const entry of entries) {
        const observer = `bun ${quote(nodePath.join(fixtureSources, 'cursor-hook-observer.ts'))} `;
        if (!entry.command.startsWith(observer)) {
          const original = entry.command;
          entry.command = `${observer}${quote(event)} ${quote(original)}`;
          this.observedHookCommands.set(entry.command, original);
        }
      }
    }
    if (!this.projectDelivery)
      hooks.hooks.workspaceOpen = [
        {
          command: `bun ${quote(nodePath.join(fixtureSources, 'workspace-open-probe.ts'))} ${quote(nodePath.join(probeDirectory, 'workspace-open-config.json'))}`,
        },
      ];
    hooks.hooks.afterShellExecution = [
      {
        command: `bun ${quote(nodePath.join(fixtureSources, 'cursor-hook-observer.ts'))} 'afterShellExecution' ':'`,
      },
    ];
    writeFileSync(hookFile, `${JSON.stringify(hooks)}\n`);
  }

  private restoreObservedHookCommands(): void {
    const hookFile = nodePath.join(this.workspace, '.cursor/hooks.json');
    const hooks = JSON.parse(readFileSync(hookFile, 'utf8')) as {
      hooks: Record<string, { command: string }[]>;
    };
    for (const entries of Object.values(hooks.hooks))
      for (const entry of entries)
        entry.command = this.observedHookCommands.get(entry.command) ?? entry.command;
    // Restore only this actor's unchanged wrappers, never a whole manifest.
    // Public upgrade must see original commands to recognize its own entries.
    writeFileSync(hookFile, `${JSON.stringify(hooks)}\n`);
    this.observedHookCommands.clear();
  }

  private async confirmNativeDiscovery(): Promise<void> {
    if (this.projectDelivery) return;
    assert.ok(this.probe);
    const secondary = nodePath.join(this.runDirectory, 'empty-secondary');
    mkdirSync(secondary, { recursive: true });
    const discoveryRecord = nodePath.join(this.workspace, '.host-contract/workspace-open.json');
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
      const record = JSON.parse(readFileSync(discoveryRecord, 'utf8')) as {
        pluginPaths: string[];
      };
      const coreLoaded = record.pluginPaths.includes(expectedPackage);
      if (coreLoaded && this.portableDelivery)
        assert.ok(
          record.pluginPaths.includes(nodePath.join(this.runDirectory, 'extension')),
          'HOST_CONTRACT_PROOF_UNAVAILABLE: native extension missing from workspace discovery',
        );
      return coreLoaded;
    });
  }

  private async prepareProject(portable: boolean): Promise<void> {
    assert.ok(this.canonical);
    if (portable) {
      for (const name of ['.cursor', '.safeword']) mkdirSync(nodePath.join(this.workspace, name));
      writeFileSync(nodePath.join(this.workspace, '.safeword/config.json'), '{}');
      writeFileSync(
        nodePath.join(this.workspace, '.safeword/SAFEWORD.md'),
        'Owned portable trial.\n',
      );
      writeFileSync(
        nodePath.join(this.workspace, '.cursor/hooks.json'),
        '{"version":1,"hooks":{}}',
      );
    } else
      await refreshCursorProjectCatalogue(
        this.projectSource,
        this.workspace,
        'install',
        this.environment,
      );
    if (portable) {
      await generatePropagationPackage(
        this.canonical,
        nodePath.join(this.runDirectory, 'extension'),
        'cursor',
      );
      for (const name of ['.cursor/commands', '.cursor/rules'])
        assert.equal(existsSync(nodePath.join(this.workspace, name)), false);
    }
  }

  private async proveDeliveryControl(portable: boolean): Promise<void> {
    if (!portable) await this.proveExistingHookControl();
  }

  private projectVerificationBinding(
    event: 'beforeShellExecution' | 'preToolUse' | 'stop' | 'afterFileEdit',
  ) {
    const declared = cursorPluginBindings().filter(row => row.event === event);
    assert.equal(
      declared.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: project policy binding ambiguous',
    );
    const binding = declared[0];
    assert.ok(binding);
    const manifest = JSON.parse(
      readFileSync(nodePath.join(this.workspace, '.cursor/hooks.json'), 'utf8'),
    ) as {
      hooks: Record<string, { command: string }[]>;
    };
    const owned = (manifest.hooks[event] ?? []).filter(
      row => this.observedHookCommands.get(row.command) === binding.configuration.command,
    );
    assert.equal(
      owned.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: installed observed project binding missing',
    );
    return {
      args: [
        nodePath.join(fixtureSources, 'cursor-hook-observer.ts'),
        event,
        binding.configuration.command,
      ],
      program: realpathSync(nodePath.join(this.workspace, '.safeword/hooks', binding.path)),
    };
  }

  private verificationTransport() {
    const extension = nodePath.join(this.runDirectory, 'extension');
    if (!this.projectDelivery)
      return {
        packageRoot: extension,
        binding: { extension },
        origin: undefined,
        actionArguments: [
          nodePath.join(extension, 'runtime/dispatch.js'),
          'beforeShellExecution:0',
        ],
        stopArguments: [nodePath.join(extension, 'runtime/dispatch.js'), 'stop:0'],
      };
    const action = this.projectVerificationBinding('beforeShellExecution');
    const stop = this.projectVerificationBinding('stop');
    return {
      packageRoot: nodePath.join(this.workspace, '.safeword'),
      binding: { projectBindings: { beforeShellExecution: action.args, stop: stop.args } },
      origin: action.program,
      actionArguments: action.args,
      stopArguments: stop.args,
    };
  }

  private verificationFingerprint() {
    if (this.projectDelivery) {
      const policyOrigin = nodePath.join(this.workspace, '.safeword', propagationVerificationOwner);
      return {
        policyOrigin,
        policySha256: createHash('sha256').update(readFileSync(policyOrigin)).digest('hex'),
        runtimeSha256: undefined,
      };
    }
    return {
      runtimeSha256: createHash('sha256')
        .update(readFileSync(nodePath.join(this.runDirectory, 'extension/runtime/cli.js')))
        .digest('hex'),
    };
  }

  private architectureBinding() {
    const path = this.projectDelivery
      ? nodePath.join(this.workspace, '.cursor/hooks.json')
      : nodePath.join(this.runDirectory, 'extension/hooks/hooks.json');
    const bytes = readFileSync(path, 'utf8');
    const manifest = JSON.parse(bytes) as {
      hooks: { stop: { command: string; loop_limit?: number }[] };
    };
    const original = cursorPluginBindings().find(row => row.event === 'stop')?.configuration
      .command;
    const rows = manifest.hooks.stop.filter(row =>
      this.projectDelivery
        ? this.observedHookCommands.get(row.command) === original
        : row.command === cursorPluginHookCommand('stop:0'),
    );
    assert.equal(rows.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: installed Stop missing');
    const row = rows[0];
    assert.ok(row?.loop_limit === 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: installed cap must remain1');
    return { path, bytes, command: row.command, loopLimit: row.loop_limit };
  }

  private async architectureResponseObserver() {
    const path = nodePath.join(this.workspace, '.cursor/hooks.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as {
      hooks: Record<string, { command: string }[]>;
    };
    const invocation = `bun '${nodePath.join(fixtureSources, 'cursor-write-observer.ts')}' architecture-response-observer`;
    const entries = (manifest.hooks.afterAgentResponse ??= []);
    let row = entries.find(
      entry => (this.observedHookCommands.get(entry.command) ?? entry.command) === invocation,
    );
    if (!row) {
      const before = this.hookConfigurationLoads();
      row = { command: invocation };
      entries.push(row);
      writeFileSync(path, JSON.stringify(manifest));
      await eventually(
        'architecture response observer loaded',
        () => this.hookConfigurationLoads() > before,
      );
    }
    return nativeCommandWords(row.command).slice(1);
  }

  protected override get environment(): NodeJS.ProcessEnv {
    const environment = super.environment;
    if (this.portableDelivery) {
      delete environment.SAFEWORD_CLI;
      delete environment.SAFEWORD_PLUGIN_CLI;
    } else if (this.projectSource) {
      const cli = nodePath.join(this.projectSource, 'src/cli.ts');
      environment.SAFEWORD_CLI = cli;
      environment.SAFEWORD_PLUGIN_CLI = cli;
    }
    return environment;
  }

  async prepare(host: string, version: string, runtime: string, delivery?: string): Promise<void> {
    this.portableDelivery = delivery === 'portable';
    const portable = this.portableDelivery;
    await this.prepareHost(host, version, runtime, portable ? 'native' : delivery);
    mkdirSync(this.workspace);
    writeFileSync(
      nodePath.join(this.workspace, 'README.md'),
      '# Synthetic host contract project\n',
    );
    this.projectDelivery = delivery === 'project-hooks';
    const inputs = this.inputs ?? createCanonicalCatalogueInputs(this.runDirectory);
    this.projectSource =
      inputs.sourcePackage ??
      (this.projectDelivery
        ? createCursorProjectSource(this.runDirectory, inputs)
        : createPropagationSource(this.runDirectory, inputs));
    this.canonical = { ...inputs, sourcePackage: this.projectSource };
    synchronizePropagationSource(this.canonical);
    await this.prepareProject(portable);
    if (this.projectDelivery)
      this.probe = { packageRoot: nodePath.join(this.workspace, '.safeword'), ...this.canonical };
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
    if (!this.projectDelivery)
      this.probe = await createNativeCatalogueProbe(
        this.runDirectory,
        undefined,
        'explain',
        this.canonical,
      );
    await this.checkPackagedHelper();
    assert.ok(this.probe);
    if (!this.projectDelivery) {
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
          pluginPaths: [
            controlDirectory,
            this.probe.packageRoot,
            ...(portable ? [nodePath.join(this.runDirectory, 'extension')] : []),
          ],
        })}\n`,
      );
    }
    this.instrumentHooks(probeDirectory);
    await this.launchWindow();
    await this.proveDeliveryControl(portable);
    await this.confirmNativeDiscovery();
    writeFileSync(
      nodePath.join(this.runDirectory, 'probe.json'),
      `${JSON.stringify(this.probe)}\n`,
    );
  }

  confirmCanonicalProbe(): void {
    assert.ok(this.probe);
    assert.ok(existsSync(nodePath.join(this.probe.packageRoot, 'skills/explain/SKILL.md')));
    if (this.projectDelivery)
      assert.equal(
        existsSync(nodePath.join(this.workspace, '.host-contract/workspace-open-config.json')),
        false,
      );
    assert.equal(
      existsSync(nodePath.join(this.workspace, '.host-contract/native-helper.json')),
      false,
    );
  }

  async invokeWorkflow(): Promise<void> {
    rmSync(nodePath.join(this.workspace, '.host-contract/native-helper.json'), { force: true });
    this.confirmCanonicalProbe();
    assert.ok(this.probe);
    await this.freshAgent();
    const prompt = this.payload('native-prompt.txt', '/explain');
    await this.action('fill', prompt);
    let description = NATIVE_CATALOGUE_PROBE_DESCRIPTION;
    if (this.projectDelivery) {
      const wrapper = readCanonicalCommandWrappers(
        nodePath.join(this.projectSource, 'templates'),
      ).find(row => row.name === 'explain');
      assert.ok(wrapper, 'CURSOR_PROJECT_COMMAND_UNAVAILABLE');
      const installed = readFileSync(
        nodePath.join(this.workspace, '.cursor/commands/explain.md'),
        'utf8',
      );
      assert.equal(
        installed,
        renderCursorCommandWrapper({ wrapper }),
        'CURSOR_PROJECT_COMMAND_ORIGIN_MISMATCH',
      );
      // The pinned project command menu displays the rendered body, not YAML description.
      description = installed.slice(installed.indexOf('\n---\n') + 5).trim();
      assert.ok(description, 'CURSOR_PROJECT_COMMAND_UNAVAILABLE');
    }
    const label = this.payload('native-label.txt', `/explain ${description}`);
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

  /** Configured completion only; retain genuine Cursor followup messages, not Stop block labels. */
  async observeArchitecture(evidence: string, architecture: PropagationArchitectureCase) {
    assert.ok(
      (this.portableDelivery || this.projectDelivery) && this.probe,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: clean native or project-hooks IDE required',
    );
    const transport = this.verificationTransport();
    const rawPath = nodePath.join(this.runDirectory, `architecture-${randomUUID()}.log`);
    const observer = await this.architectureResponseObserver();
    let start = new Map(this.hookLogSources().map(row => [row.path, row.text.length]));
    let slices: { path: string; text: string }[] = [];
    const read = () => {
      slices = this.recordNativeLog(rawPath, start);
      return nativeHookRecords(slices.map(row => row.text).join('\n'));
    };
    const prompt = this.payload(
      'architecture-prompt.txt',
      'This is a report-only lifecycle diagnostic. Reply only READY. Use no tools and change no files. ' +
        'If an automatic instruction appears, summarize its unmet requirement in one short sentence and end immediately. ' +
        'Do not invoke a workflow, inspect the project, use tools, or create evidence in that follow-up. Leave the synthetic work unfinished.',
    );
    const complete = async () => {
      await this.action('fill', prompt);
      await this.action('submit', prompt);
      await eventually('actual completed Cursor Stop', () =>
        read().some(
          row =>
            nativeHookCommand(row, transport.stopArguments) && row.input.status === 'completed',
        ),
      );
    };
    await this.freshAgent();
    await complete();
    const setup = read().filter(row => nativeHookCommand(row, transport.stopArguments));
    assert.equal(setup.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: ambiguous setup Stop');
    const conversation = setup[0]?.input.conversation_id ?? '';
    const context = {
      conversation,
      workspace: realpathSync(this.workspace),
      version: hostReleases.cursorIde.version,
    };
    const setupStops = nativeArchitectureStops(
      setup.map(row => row.raw).join('\n'),
      transport.stopArguments,
      context,
    );
    assert.ok(
      setupStops[0]?.input.loop_count === 0 && !setupStops[0].followup,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: setup correction consumed',
    );
    const fixture = preparePropagationCompletion(
      this.workspace,
      conversation,
      'cursor',
      evidence,
      architecture,
    );
    const path = nodePath.join(this.workspace, '.safeword/config.json');
    const bytes = readFileSync(path, 'utf8');
    const binding = this.architectureBinding();
    start = new Map(this.hookLogSources().map(row => [row.path, row.text.length]));
    await complete();
    const first = read().find(row => nativeHookCommand(row, transport.stopArguments));
    let cap;
    if (this.hasNativeFollowup(first)) {
      await eventually('actual capped automatic Cursor completion', () => {
        const rows = read();
        return (
          slices.some(row => row.text.includes('skipped due to loop limit')) &&
          rows.some(
            row =>
              nativeHookCommand(row, observer) &&
              row.input.generation_id !== first?.input.generation_id,
          )
        );
      });
      read();
      cap = nativeArchitectureCap(slices, transport.stopArguments, observer, context, binding);
    }
    const rows = read();
    const raw = slices.map(row => row.text).join('\n');
    const stops = nativeArchitectureStops(raw, transport.stopArguments, context);
    assert.equal(
      readFileSync(binding.path, 'utf8'),
      binding.bytes,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: installed cap changed',
    );
    assert.ok(
      rows.every(
        row =>
          !['preToolUse', 'beforeShellExecution', 'afterShellExecution', 'afterFileEdit'].includes(
            row.input.hook_event_name ?? '',
          ),
      ),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: unexpected tool activity',
    );
    return {
      stops,
      cap,
      raw,
      rawPath,
      configuration: { path, bytes, after: readFileSync(path, 'utf8') },
      ticket: readFileSync(nodePath.join(fixture.ticket, 'ticket.md'), 'utf8'),
      installation: this.observedInstallation(),
      origin: this.projectDelivery
        ? this.projectVerificationBinding('stop').program
        : transport.stopArguments[0],
      ...this.verificationFingerprint(),
    };
  }

  /** Actual edit eligibility and one native followup; no synthetic managed Stop1. */
  async observeHandoff(setting: {
    options: PropagationArchitectureCase['options'];
    currentTool: boolean;
  }) {
    assert.ok(
      (this.portableDelivery || this.projectDelivery) && this.probe,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: clean native or project-hooks IDE required',
    );
    const transport = this.verificationTransport();
    const observer = await this.architectureResponseObserver();
    const rawPath = nodePath.join(this.runDirectory, `handoff-${randomUUID()}.log`);
    let start = new Map(this.hookLogSources().map(row => [row.path, row.text.length]));
    let slices: { path: string; text: string }[] = [];
    const read = () => {
      slices = this.recordNativeLog(rawPath, start);
      return nativeHookRecords(slices.map(row => row.text).join('\n'));
    };
    const complete = async (text: string) => {
      const prompt = this.payload('handoff-prompt.txt', text);
      await this.action('fill', prompt);
      await this.action('submit', prompt);
      await eventually('completed original Cursor handoff Stop', () =>
        read().some(
          row =>
            nativeHookCommand(row, transport.stopArguments) && row.input.status === 'completed',
        ),
      );
    };
    let bootstrap;
    if (setting.currentTool) {
      await this.freshAgent();
      const documents = this.handoffBootstrapDocuments();
      await complete(
        [
          `Read ${documents.map(document => JSON.stringify(document)).join(' and ')} completely before the isolated test action.`,
          'Use read-only tools for this session preparation and follow the applicable instructions.',
          'Do not edit files or configuration, execute Shell, invoke helpers or start the test action yet.',
          'When the required preparation is complete, reply only READY and stop.',
        ].join(' '),
      );
      bootstrap = this.handoffBootstrapObservation(
        read(),
        transport.stopArguments,
        observer,
        documents,
      );
      this.handoffConversation = bootstrap.conversation;
    }
    const context = {
      workspace: realpathSync(this.workspace),
      version: hostReleases.cursorIde.version,
      conversation: this.handoffConversation,
    };
    assert.ok(context.conversation, 'HOST_CONTRACT_PROOF_UNAVAILABLE: edit history absent');
    const given = preparePropagationCompletion(this.workspace, context.conversation, 'cursor', '');
    writeFileSync(
      nodePath.join(given.ticket, 'ticket.md'),
      given.content.replace('phase: done', 'phase: implement'),
    );
    const path = nodePath.join(this.workspace, '.safeword/config.json');
    writeFileSync(path, JSON.stringify({ ...this.handoffConfiguration(path), ...setting.options }));
    const bytes = readFileSync(path, 'utf8');
    const binding = this.architectureBinding();
    const file = nodePath.join(this.workspace, '.host-contract/handoff-edit.txt');
    const before = this.handoffFileEffect(file);
    const expected = `Observed isolated edit ${randomUUID()}\n`;
    start = new Map(this.hookLogSources().map(row => [row.path, row.text.length]));
    await complete(
      [
        'Authorized isolated terminal input test.',
        setting.currentTool
          ? `Use Write exactly once on ${JSON.stringify(file)} with exact complete content ${JSON.stringify(expected)}.`
          : 'Use no tools and change no files in this new turn.',
        'Then make the INITIAL answer exactly READY without Markdown or other text; this is deliberately malformed test input for the installed guard.',
        'If an automatic instruction appears, summarize its unmet requirement in one sentence and stop without tools. Do not edit other files or configuration.',
      ].join(' '),
    );
    const first = read().find(row => nativeHookCommand(row, transport.stopArguments));
    let cap;
    if (this.hasNativeFollowup(first)) {
      await eventually('capped Cursor handoff automatic reply', () => {
        const rows = read();
        return (
          slices.some(row => row.text.includes('skipped due to loop limit')) &&
          rows.some(
            row =>
              nativeHookCommand(row, observer) &&
              row.input.generation_id !== first?.input.generation_id,
          )
        );
      });
      cap = nativeArchitectureCap(slices, transport.stopArguments, observer, context, binding);
    }
    read();
    const raw = slices.map(row => row.text).join('\n');
    const stops = nativeArchitectureStops(raw, transport.stopArguments, context);
    const extension = nodePath.join(this.runDirectory, 'extension/runtime/dispatch.js');
    const args = (event: 'preToolUse' | 'afterFileEdit') =>
      this.projectDelivery
        ? this.projectVerificationBinding(event).args
        : [extension, `${event}:0`];
    const edits = nativeHookRecords(raw).filter(
      row => row.input.hook_event_name === 'afterFileEdit',
    );
    const edit = setting.currentTool
      ? {
          ...nativeHandoffEdit(raw, {
            action: args('preToolUse'),
            edit: args('afterFileEdit'),
            stop: transport.stopArguments,
            ...context,
            file,
            content: expected,
          }),
          before,
          after: this.handoffFileEffect(file),
          expected,
        }
      : undefined;
    assert.ok(
      setting.currentTool || edits.length === 0,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: unexpected history-turn edit',
    );
    assert.equal(readFileSync(binding.path, 'utf8'), binding.bytes);
    return {
      protocol: 'cursor-stop' as const,
      bootstrap,
      stops,
      cap,
      edit,
      fileEffect: { path: file, before, after: this.handoffFileEffect(file) },
      raw,
      rawPath,
      configuration: { path, bytes, after: readFileSync(path, 'utf8') },
      installation: this.observedInstallation(),
      origin: transport.stopArguments,
      ...this.verificationFingerprint(),
    };
  }

  /** Actual installed pre-action facts; expected policy outcomes belong to the grader. */
  async observeVerification(evidence: string, validSetupEvidence: string) {
    assert.ok(
      (this.portableDelivery || this.projectDelivery) && this.probe,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: clean native or project-hooks IDE required',
    );
    const transport = this.verificationTransport();
    const fixture = await preparePropagationReadiness(
      this.workspace,
      transport.packageRoot,
      evidence,
      validSetupEvidence,
      this.runDirectory,
    );
    rmSync(fixture.effect, { force: true });
    const rawPath = nodePath.join(this.runDirectory, `verification-${randomUUID()}.log`);
    const initial = this.hookLog();
    writeFileSync(rawPath, initial);
    const seen = new Set(nativeHookRecords(initial).map(row => row.raw));
    const read = () => {
      const raw = this.hookLog();
      writeFileSync(rawPath, raw); // Preserve even malformed/incomplete observations before grading.
      return nativeHookRecords(raw).filter(row => !seen.has(row.raw));
    };
    const prompt = this.payload(
      'verification-prompt.txt',
      [
        'New authorized isolated case. The absolute executable is a local test double and cannot publish a real pull request.',
        'Use Shell exactly once to run the exact command between these delimiters:',
        `START COMMAND \`${fixture.command}\` END COMMAND`,
        'Let installed hooks decide; rejection is expected. Do not retry, bypass hooks, use other tools, read files or do other work. Report the actual result and stop.',
      ].join(' '),
    );
    await this.action('fill', prompt);
    await this.action('submit', prompt);
    await eventually('actual native verification action and completed Stop', () => {
      const rows = read();
      const action = rows.find(row => nativeHookCommand(row, transport.actionArguments));
      return Boolean(
        action &&
        rows.some(
          row =>
            nativeHookCommand(row, transport.stopArguments) &&
            row.input.status === 'completed' &&
            row.input.conversation_id === action.input.conversation_id &&
            row.input.generation_id === action.input.generation_id,
        ),
      );
    });
    const raw = read()
      .map(row => row.raw)
      .join('\n');
    const observed = nativeVerificationObservation(raw, {
      ...transport.binding,
      workspace: realpathSync(this.workspace),
      version: hostReleases.cursorIde.version,
      command: fixture.command,
      observer: nodePath.join(fixtureSources, 'cursor-hook-observer.ts'),
    });
    return {
      ...observed,
      origin: transport.origin ?? observed.origin,
      transportOrigin: observed.origin,
      installation: this.observedInstallation(),
      raw,
      rawPath,
      ...this.verificationFingerprint(),
      effect: existsSync(fixture.effect) ? readFileSync(fixture.effect, 'utf8') : undefined,
      expectedEffect: fixture.marker,
    };
  }

  /** Configured native Write path; the installed shared guard decides the transition. */
  async observeDesignApproval(options: PropagationArchitectureCase['options']) {
    assert.ok(
      (this.portableDelivery || this.projectDelivery) && this.probe,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: clean native or project-hooks IDE required',
    );
    const prepared = preparePropagationDesignApproval(this.workspace, options.designApprovalGate);
    const path = nodePath.join(this.workspace, '.safeword/config.json');
    const previous = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...previous, ...options }));
    const bytes = readFileSync(path, 'utf8');
    const extension = nodePath.join(this.runDirectory, 'extension');
    const action = this.projectDelivery
      ? this.projectVerificationBinding('preToolUse')
      : {
          args: [nodePath.join(extension, 'runtime/dispatch.js'), 'preToolUse:0'],
          program: nodePath.join(extension, 'runtime/dispatch.js'),
        };
    const stop = this.verificationTransport().stopArguments;
    await this.freshAgent();
    const initial = this.hookLog();
    const seen = new Set(nativeHookRecords(initial).map(row => row.raw));
    const rawPath = nodePath.join(this.runDirectory, `design-${randomUUID()}.log`);
    const read = () => {
      const log = this.hookLog();
      writeFileSync(rawPath, log);
      return nativeHookRecords(log)
        .filter(row => !seen.has(row.raw))
        .map(row => row.raw)
        .join('\n');
    };
    const prompt = this.payload(
      'design-prompt.txt',
      [
        'Authorized isolated phase-transition test. Use Write exactly once on the absolute file',
        JSON.stringify(prepared.file),
        'with this exact complete content:',
        JSON.stringify(prepared.after),
        'Let installed hooks decide. Rejection is expected. Do not retry, use Shell or other tools, edit other files or configuration. Report the actual result and stop.',
      ].join(' '),
    );
    await this.action('fill', prompt);
    await this.action('submit', prompt);
    await eventually('actual native design Write and completed Stop', () => {
      const rows = nativeHookRecords(read());
      const request = rows.find(row => nativeHookCommand(row, action.args));
      return (
        !!request &&
        rows.some(
          row =>
            nativeHookCommand(row, stop) &&
            row.input.status === 'completed' &&
            row.input.conversation_id === request.input.conversation_id &&
            row.input.generation_id === request.input.generation_id,
        )
      );
    });
    const raw = read();
    return {
      ...nativeDesignObservation(raw, {
        action: action.args,
        stop,
        workspace: realpathSync(this.workspace),
        version: hostReleases.cursorIde.version,
        file: prepared.file,
        content: prepared.after,
      }),
      installation: this.observedInstallation(),
      origin: action.program,
      raw,
      rawPath,
      configuration: { path, bytes, after: readFileSync(path, 'utf8') },
      before: prepared.before,
      expectedEffect: prepared.after,
      effect: readFileSync(prepared.file, 'utf8'),
    };
  }

  async refreshResources(inputs: CanonicalCatalogueInputs): Promise<void> {
    assert.ok(this.probe);
    this.canonical = { ...inputs, sourcePackage: this.projectSource };
    synchronizePropagationSource(this.canonical);
    if (!this.portableDelivery) {
      this.restoreObservedHookCommands();
      await refreshCursorProjectCatalogue(
        this.projectSource,
        this.workspace,
        'upgrade',
        this.environment,
      );
    }
    this.probe = this.projectDelivery
      ? { ...this.canonical, packageRoot: this.probe.packageRoot }
      : await refreshNativeCatalogueProbe(this.probe, this.canonical);
    if (this.portableDelivery) {
      const staging = mkdtempSync(nodePath.join(this.runDirectory, 'extension-refresh-'));
      try {
        const generated = nodePath.join(staging, 'extension');
        await generatePropagationPackage(this.canonical, generated, 'cursor');
        reconcileGeneratedTree(generated, nodePath.join(this.runDirectory, 'extension'));
      } finally {
        rmSync(staging, { recursive: true, force: true });
      }
    }
    this.instrumentHooks(nodePath.join(this.workspace, '.host-contract'));
    rmSync(nodePath.join(this.workspace, '.host-contract/native-helper.json'), { force: true });
    writeFileSync(nodePath.join(this.workspace, '.host-contract/hooks.jsonl'), '');
    if (!this.projectDelivery)
      rmSync(nodePath.join(this.workspace, '.host-contract/workspace-open.json'), { force: true });
    await this.action('close');
    await this.launchWindow();
    await this.confirmNativeDiscovery();
  }

  observedInstallation(): string {
    return JSON.stringify([
      this.probe?.packageRoot,
      this.workspace,
      ...(this.portableDelivery ? [nodePath.join(this.runDirectory, 'extension')] : []),
    ]);
  }

  propagationPaths() {
    assert.ok(this.probe);
    if (this.projectDelivery)
      return installedPropagationPaths(nodePath.join(this.workspace, '.safeword'), 'project');
    return installedPropagationPaths(
      this.probe.packageRoot,
      'portable',
      nodePath.join(this.runDirectory, 'extension'),
    );
  }

  observedResources() {
    this.assertPackagedResult();
    return {
      delivery: this.projectDelivery ? 'project-hooks' : 'native',
      installation: this.observedInstallation(),
      raw: `${this.lastSnapshot}\n${readFileSync(
        nodePath.join(this.workspace, '.host-contract/hooks.jsonl'),
        'utf8',
      )}`,
      markers: observedCatalogueMarkers(this.lastSnapshot),
    };
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
            command?: string;
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
    assert.equal(realpathSync(record.origin), realpathSync(this.helperOrigin()));
    assert.ok(this.lastSnapshot.includes(this.probe.helperMarker));
    assert.ok(
      shells.some(row => row.helper_command_called && row.helper_markers.includes(record.marker)),
      'The actual packaged helper invocation must produce the marker in that same shell result',
    );
  }
}
