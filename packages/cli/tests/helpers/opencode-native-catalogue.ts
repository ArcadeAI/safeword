import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { openCodeProfilePaths } from '../../src/opencode/config-root.js';
import { readOpenCodeV2Enrollment } from '../../src/opencode/v2-enrollment.js';
import { stageOpenCodeV2Profile } from '../../src/opencode/v2-profile.js';
import { OPENCODE_V2_PLUGIN_LAYOUT } from '../../src/schema.js';
import { assertMatchingTree } from './codex-plugin-package.js';
import {
  type CanonicalCatalogueInputs,
  createCanonicalCatalogueInputs,
  createNativeCatalogueProbe,
  type NativeCatalogueProbe,
  observedCatalogueMarkers,
  reconcileNativeCatalogueProbe,
  refreshNativeCatalogueProbe,
} from './native-catalogue-probe.js';
import { catalogueHelperRuntime } from './native-helper-command.js';
import type {
  ModelMessage,
  NativeModelReply,
  NativeModelRequest,
} from './opencode-native-driver.js';
import { openCodeScriptedModelFixture } from './opencode-native-driver.js';
import type { OpenCodeNativeFixture } from './opencode-native-write.js';
import { OpenCodeNativeWriteActor } from './opencode-native-write.js';
import {
  ObservedPropagationMismatch,
  preparePropagationDesignApproval,
  preparePropagationReadiness,
  type PropagationArchitectureCase,
} from './propagation-policy-case.js';
import {
  createPropagationSource,
  generatePropagationPackage,
  installedPropagationPaths,
} from './propagation-source.js';

const execute = promisify(execFile);

function assertDesignApprovalOutcome(
  enabled: boolean,
  dispatch: { status: number; stderr: string },
  results: ModelMessage[],
  effect: { actual?: string; before: string; after: string },
) {
  assert.equal(dispatch.status, enabled ? 2 : 0, 'OPENCODE_DESIGN_APPROVAL_OUTCOME_MISMATCH');
  if (dispatch.status === 2) {
    assert.match(
      dispatch.stderr,
      /design approval.*approve-plan/isu,
      'OPENCODE_DESIGN_APPROVAL_REASON_MISMATCH',
    );
    assert.match(
      JSON.stringify(results),
      /design approval.*approve-plan/isu,
      'OPENCODE_DESIGN_APPROVAL_RESULT_MISSING',
    );
    assert.equal(effect.actual, effect.before, 'OPENCODE_DENIED_PHASE_WRITE_REACHED_DISK');
  } else {
    assert.equal(effect.actual, effect.after, 'OPENCODE_ALLOWED_PHASE_WRITE_MISSING');
  }
}

function assertVerificationLogs(native: string, dispatch: string, configured: boolean) {
  assert.ok(
    native.trim() && (configured || dispatch.trim()),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: native verification guard missing',
  );
}
function assertVerificationDispatches(
  dispatches: { status: number; args: string[]; input: { hook_event_name: string } }[],
  tool: string,
  dispatcher: string,
) {
  const pre = dispatches[0];
  const completedEdit = pre?.status === 0 && (tool === 'write' || tool === 'edit');
  const events = completedEdit ? ['PreToolUse', 'PostToolUse'] : ['PreToolUse'];
  assert.deepEqual(
    dispatches.map(row => row.input.hook_event_name),
    events,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: verification dispatch ambiguous',
  );
  for (const row of dispatches) {
    const post = row.input.hook_event_name === 'PostToolUse';
    assert.deepEqual(row.args, post ? [dispatcher, '--observe-ticket'] : [dispatcher]);
    if (post) assert.equal(row.status, 0);
  }
}

function readDesignConfig(snapshot?: { path: string }) {
  return snapshot && readFileSync(snapshot.path, 'utf8');
}

interface DesignWriteFacts {
  raw: string;
  configuration?: { path: string; bytes: string };
  effect?: string;
  before: string;
  expectedEffect: string;
}

function configureDesignOptions(project: string, options?: PropagationArchitectureCase['options']) {
  let snapshot: { path: string; bytes: string } | undefined;
  if (options) {
    const path = nodePath.join(project, '.safeword/config.json');
    const previous = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...previous, ...options }));
    snapshot = { path, bytes: readFileSync(path, 'utf8') };
  }
  return snapshot;
}

function assertConfiguredDesignEffect(observed: DesignWriteFacts, enabled?: boolean) {
  const config = observed.configuration;
  if (!config) return;
  assert.equal(
    readFileSync(config.path, 'utf8'),
    config.bytes,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: design configuration changed during turn',
  );
  if (enabled && typeof observed.effect === 'string' && observed.effect !== observed.before)
    throw new ObservedPropagationMismatch(
      observed,
      new Error('OPENCODE_DENIED_PHASE_WRITE_REACHED_DISK'),
    );
}

function assertObservedDesignApproval(
  enabled: boolean,
  dispatch: { status: number; stderr: string },
  results: ModelMessage[],
  observed: DesignWriteFacts,
) {
  try {
    assertDesignApprovalOutcome(enabled, dispatch, results, {
      actual: observed.effect,
      before: observed.before,
      after: observed.expectedEffect,
    });
  } catch (error) {
    if (!observed.configuration) throw error;
    throw new ObservedPropagationMismatch(observed, error);
  }
}

function commandsFromNativeSkill(content: string, packageRoot: string, workflow: string) {
  const base = /^Base directory for this skill: (.+)$/mu.exec(content)?.[1];
  assert.equal(
    base,
    nodePath.join(packageRoot, 'skills', workflow),
    'Native skill base directory differs from its packaged workflow',
  );
  assert.ok(base);
  const runtime = catalogueHelperRuntime(
    content,
    nodePath.join(base, 'SKILL.md'),
    nodePath.join(packageRoot, 'runtime/cli.js'),
  );
  const script = /```bash\n([\s\S]*?)```/u.exec(content)?.[1];
  const guideLink = /\[the packaged guide\]\(([^)]+)\)/u.exec(content)?.[1];
  assert.ok(script && guideLink);
  return {
    guide: nodePath.resolve(base, guideLink),
    helper: `SAFEWORD_PLUGIN_RUNTIME="${runtime}"; ${script}`,
  };
}

/** Same canonical content/guide/helper probe as Codex and Cursor, through the native V2 SDK. */
export class OpenCodeNativeCatalogueActor {
  private readonly source: string;
  private probe?: NativeCatalogueProbe;
  private native?: OpenCodeNativeWriteActor;
  private candidate = '';
  private directory = '';
  private project = '';
  private ownedModelConfig?: { file: string; bytes: Buffer };
  private results: ModelMessage[] = [];
  private bindingFailure = '';
  private loadedWorkflow = '';
  private argumentObserved = false;
  private readonly workflow: string;
  private readonly argument: string;

  constructor(
    private readonly fixture: OpenCodeNativeFixture,
    private readonly entrypoint: 'skill' | 'command' = 'skill',
    private readonly inputs?: CanonicalCatalogueInputs,
  ) {
    this.source = mkdtempSync(nodePath.join(fixture.runsDirectory, 'opencode-catalogue-'));
    this.workflow = entrypoint === 'command' ? 'bdd' : 'explain';
    this.argument = `ARGUMENT_${nodePath.basename(this.source)}`;
  }

  private prepareModel(
    paths: Parameters<Parameters<OpenCodeNativeWriteActor['runModelFixture']>[0]>[0],
  ) {
    const modelConfig = nodePath.join(paths.project, 'opencode.json');
    if (this.ownedModelConfig) {
      assert.equal(modelConfig, this.ownedModelConfig.file, 'OPENCODE_OWNED_MODEL_CONFIG_CHANGED');
      assert.deepEqual(
        readFileSync(modelConfig),
        this.ownedModelConfig.bytes,
        'OPENCODE_OWNED_MODEL_CONFIG_CHANGED',
      );
      rmSync(modelConfig);
      this.ownedModelConfig = undefined;
    }
    this.candidate = paths.candidate;
    this.directory = paths.directory;
    this.project = paths.project;
    mkdirSync(nodePath.join(paths.project, '.host-contract'), { recursive: true });
    return modelConfig;
  }

  private skillReply(
    request: NativeModelRequest,
    candidate: string,
    probe: NativeCatalogueProbe,
  ): NativeModelReply {
    const results = request.messages?.filter(message => message.role === 'tool') ?? [];
    if (results.length === 0) return { tool: { name: 'skill', input: { id: 'safeword-explain' } } };
    const loaded = results[0]?.content;
    if (typeof loaded !== 'string' || !loaded.includes(probe.workflowMarker)) return {};
    try {
      const commands = commandsFromNativeSkill(loaded, candidate, this.workflow);
      if (results.length === 1) return { tool: { name: 'read', input: { path: commands.guide } } };
      if (results.length === 2)
        return { tool: { name: 'shell', input: { command: commands.helper } } };
      return {};
    } catch (error) {
      this.bindingFailure = String(error);
      return {};
    }
  }

  private commandReply(
    request: NativeModelRequest,
    candidate: string,
    probe: NativeCatalogueProbe,
  ): NativeModelReply {
    const results = request.messages?.filter(message => message.role === 'tool') ?? [];
    this.argumentObserved ||= JSON.stringify(request.messages).includes(this.argument);
    const text = request.messages
      ?.filter(message => message.role === 'user')
      .flatMap(message => {
        if (typeof message.content === 'string') return [message.content];
        if (!Array.isArray(message.content)) return [];
        return message.content.flatMap((part: { text?: unknown }) =>
          typeof part.text === 'string' ? [part.text] : [],
        );
      })
      .find(content => content.includes(probe.workflowMarker));
    if (text) this.loadedWorkflow = text;
    if (!text) return {};
    try {
      const commands = commandsFromNativeSkill(text, candidate, this.workflow);
      if (results.length === 0) return { tool: { name: 'read', input: { path: commands.guide } } };
      if (results.length === 1)
        return { tool: { name: 'shell', input: { command: commands.helper } } };
      return {};
    } catch (error) {
      this.bindingFailure = String(error);
      return {};
    }
  }

  private assertCommandSubmission(
    observations: { prompt?: { text?: string } }[],
    apiRegistration: string,
  ): void {
    if (existsSync(apiRegistration)) {
      if (this.loadedWorkflow !== '') {
        const result = JSON.parse(
          readFileSync(nodePath.join(this.directory, 'native-command-result.json'), 'utf8'),
        ) as { missing: boolean };
        assert.equal(result.missing, false, 'NATIVE_COMMAND_DISPATCH_MISSING');
      }
      return;
    }
    if (this.loadedWorkflow !== '') {
      assert.ok(
        observations.some(row => row.prompt?.text === this.argument),
        'NATIVE_COMMAND_DISPATCH_MISSING',
      );
      assert.equal(
        observations.some(row => row.prompt?.text === `/safeword-bdd ${this.argument}`),
        false,
        'NATIVE_COMMAND_DISPATCH_MISSING',
      );
      return;
    }
    assert.ok(
      observations.some(row => row.prompt?.text === `/safeword-bdd ${this.argument}`),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native TUI command submission was not observed',
    );
  }

  private assertCommandOutput(probe: NativeCatalogueProbe): void {
    const messages = nodePath.join(this.directory, 'native-command-messages.json');
    if (existsSync(messages)) {
      const visible = readFileSync(messages, 'utf8');
      for (const marker of [
        probe.workflowMarker,
        probe.guideMarker,
        probe.helperMarker,
        this.argument,
      ])
        assert.ok(
          visible.includes(marker),
          'NATIVE_HELPER_ORIGIN_MISMATCH: native CLI message result omitted canonical command output',
        );
    }
  }

  async prepare(host: string, version: string, runtime: string): Promise<void> {
    const canonical = this.inputs ?? createCanonicalCatalogueInputs(this.source, this.workflow);
    const sourcePackage =
      canonical.sourcePackage ?? createPropagationSource(this.source, canonical, this.workflow);
    this.probe = await createNativeCatalogueProbe(
      this.source,
      (output, source) => {
        assert.ok(source, 'OPENCODE_OWNED_SOURCE_REQUIRED');
        return generatePropagationPackage(
          { ...canonical, sourcePackage: source },
          output,
          'opencode',
        );
      },
      this.workflow,
      { ...canonical, sourcePackage },
    );
    this.native = new OpenCodeNativeWriteActor({
      ...this.fixture,
      v2CandidatePackage: this.probe.packageRoot,
    });
    await this.native.prepare(host, version, runtime);
  }

  confirmCanonicalProbe(): void {
    assert.ok(this.probe);
    const workflow = readFileSync(
      nodePath.join(this.probe.packageRoot, 'skills', this.workflow, 'SKILL.md'),
      'utf8',
    );
    assert.ok(workflow.includes(this.probe.workflowMarker));
    assert.ok(
      readFileSync(
        nodePath.join(
          this.probe.packageRoot,
          'skills',
          this.workflow,
          'references/HOST_CONTRACT_GUIDE.md',
        ),
        'utf8',
      ).includes(this.probe.guideMarker),
    );
  }

  async refreshResources(inputs: CanonicalCatalogueInputs): Promise<void> {
    assert.ok(this.probe && this.candidate);
    const profile = nodePath.join(this.directory, 'profile');
    const previous = readOpenCodeV2Enrollment(
      profile,
      this.project,
      this.candidate,
      OPENCODE_V2_PLUGIN_LAYOUT,
    );
    assert.ok(
      previous,
      'PROPAGATION_ENROLLMENT_REFRESH_UNAVAILABLE: prior candidate enrollment missing',
    );
    const generate = (output: string, sourcePackage?: string) => {
      assert.ok(sourcePackage, 'OPENCODE_OWNED_SOURCE_REQUIRED');
      return generatePropagationPackage({ ...inputs, sourcePackage }, output, 'opencode');
    };
    this.probe = await refreshNativeCatalogueProbe(this.probe, inputs, generate);
    if (inputs.sourcePackage) reconcileNativeCatalogueProbe(this.probe, this.candidate);
    else await refreshNativeCatalogueProbe({ ...this.probe, packageRoot: this.candidate }, inputs);
    const result = stageOpenCodeV2Profile(
      profile,
      openCodeProfilePaths(profile).lock,
      {
        projectDirectory: this.project,
        packageDirectory: this.candidate,
        epoch: previous.epoch,
      },
      previous,
    );
    assert.ok(
      result.state === 'changed' || result.state === 'healthy',
      'PROPAGATION_ENROLLMENT_REFRESH_UNAVAILABLE',
    );
  }

  async invokeWorkflow(): Promise<void> {
    assert.ok(this.native);
    assert.ok(this.probe);
    const probe = this.probe;
    await this.native.runModelFixture(async paths => {
      const modelConfig = this.prepareModel(paths);
      this.bindingFailure = '';
      this.loadedWorkflow = '';
      this.argumentObserved = false;
      writeFileSync(nodePath.join(paths.directory, 'native-observations.jsonl'), '');
      // This newly owned synthetic profile has no user assets. Remove legacy delivery
      // so a project helper or copied profile skill cannot satisfy native package proof.
      for (const directory of ['hooks', 'skills', 'guides'])
        rmSync(nodePath.join(paths.project, '.safeword', directory), {
          recursive: true,
          force: true,
        });
      for (const directory of ['skills', 'commands', 'agents'])
        rmSync(nodePath.join(paths.directory, 'profile', directory), {
          recursive: true,
          force: true,
        });
      const skillFile = nodePath.join(paths.candidate, 'skills', this.workflow, 'SKILL.md');
      const workflow = readFileSync(skillFile, 'utf8');
      const runtime = catalogueHelperRuntime(
        workflow,
        skillFile,
        nodePath.join(paths.candidate, 'runtime/cli.js'),
      );
      // Prerequisite only: remove this artifact before the actual native helper call.
      await execute(
        'bun',
        [runtime, 'project', 'runtime', 'audit-principle-trace', paths.project],
        {
          cwd: paths.project,
          env: { ...process.env, SAFEWORD_CLI: undefined, SAFEWORD_PLUGIN_CLI: runtime },
        },
      );
      const artifact = nodePath.join(paths.project, '.host-contract/native-helper.json');
      assert.equal(JSON.parse(readFileSync(artifact, 'utf8')).marker, this.probe?.helperMarker);
      rmSync(artifact);
      const model = await openCodeScriptedModelFixture(paths.directory, request => {
        if (this.entrypoint === 'command')
          return this.commandReply(request, paths.candidate, probe);
        return this.skillReply(request, paths.candidate, probe);
      });
      this.results = model.results;
      return {
        ...model,
        beforeTurn: () => {
          // configureModel has now created this turn's actual loopback config.
          this.ownedModelConfig = { file: modelConfig, bytes: readFileSync(modelConfig) };
        },
        command: this.entrypoint === 'command' ? 'safeword-bdd' : undefined,
        prompt:
          this.entrypoint === 'command'
            ? this.argument
            : 'Invoke only the installed safeword-explain workflow, its declared guide, and its exact packaged helper.',
      };
    });
  }

  /** Six-option Write case through the existing native PreToolUse dispatcher. */
  async observeDesignApproval(options: PropagationArchitectureCase['options']) {
    const observed = await this.observeVerification('', '', {
      enabled: options.designApprovalGate,
      tool: 'write',
      configuration: options,
    });
    assert.ok(observed.configuration && typeof observed.effect === 'string');
    return { ...observed, configuration: observed.configuration, effect: observed.effect };
  }

  async observeVerification(
    evidence: string,
    validSetupEvidence: string,
    designApproval?: {
      enabled: boolean;
      tool: 'write' | 'edit';
      configuration?: PropagationArchitectureCase['options'];
    },
  ) {
    assert.ok(this.native && this.probe);
    const probe = this.probe;
    let effect = '',
      expectedEffect = '',
      command = '',
      before = '';
    const tool = designApproval?.tool ?? 'shell';
    const canonicalTool = { shell: 'Bash', write: 'Write', edit: 'Edit' }[tool];
    let toolInput: Record<string, unknown> = {},
      canonicalInput: Record<string, unknown> = {};
    let results: ModelMessage[] = [];
    let configSnapshot: { path: string; bytes: string } | undefined;
    await this.native.runModelFixture(async paths => {
      const modelConfig = this.prepareModel(paths);
      assertMatchingTree(probe.packageRoot, paths.candidate);
      if (designApproval) {
        const prepared = preparePropagationDesignApproval(paths.project, designApproval.enabled);
        configSnapshot = configureDesignOptions(paths.project, designApproval.configuration);
        effect = prepared.file;
        before = prepared.before;
        expectedEffect = prepared.after;
        toolInput =
          tool === 'write'
            ? { path: effect, content: expectedEffect }
            : {
                path: effect,
                oldString: 'phase: plan-implementation',
                newString: 'phase: plan-execution',
                replaceAll: false,
              };
        canonicalInput =
          tool === 'write'
            ? { file_path: effect, content: expectedEffect }
            : {
                file_path: effect,
                old_string: 'phase: plan-implementation',
                new_string: 'phase: plan-execution',
                replace_all: false,
              };
      } else {
        const prepared = await preparePropagationReadiness(
          paths.project,
          paths.candidate,
          evidence,
          validSetupEvidence,
          paths.directory,
        );
        ({ effect, marker: expectedEffect, command } = prepared);
        rmSync(effect, { force: true });
        toolInput = { command };
        canonicalInput = { command };
      }
      for (const file of ['native-observations.jsonl', 'runtime-observations.jsonl'])
        writeFileSync(nodePath.join(paths.directory, file), '');
      this.bindingFailure = '';
      const model = await openCodeScriptedModelFixture(paths.directory, request => {
        if (request.messages?.some(message => message.role === 'tool')) return {};
        if (!request.tools?.some(row => row.function?.name === tool)) {
          this.bindingFailure = `HOST_CONTRACT_PROOF_UNAVAILABLE: native ${tool} missing`;
          return {};
        }
        return { tool: { name: tool, input: toolInput } };
      });
      results = model.results;
      return {
        ...model,
        beforeTurn: () => {
          this.ownedModelConfig = { file: modelConfig, bytes: readFileSync(modelConfig) };
        },
        prompt: 'Execute the isolated predeclared local pre-action control once. Do no other work.',
      };
    });
    assert.equal(this.bindingFailure, '');
    const nativeRaw = readFileSync(
      nodePath.join(this.directory, 'native-observations.jsonl'),
      'utf8',
    );
    const dispatchRaw = readFileSync(
      nodePath.join(this.directory, 'runtime-observations.jsonl'),
      'utf8',
    );
    assertVerificationLogs(nativeRaw, dispatchRaw, Boolean(configSnapshot));
    const native = nativeRaw
      .trim()
      .split('\n')
      .map(line => JSON.parse(line))
      .filter(row => row.tool === tool);
    const dispatches = dispatchRaw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));
    const observations = dispatches.filter(row => row.input.hook_event_name === 'PreToolUse');
    assert.equal(
      native.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native verification attempt ambiguous',
    );
    assert.deepEqual(native[0].input, toolInput, 'OPENCODE_OPTION_INPUT_MISMATCH');
    assert.ok(
      native[0].plugins?.some(
        (plugin: { source: { type: string; path?: string }; state: { status: string } }) =>
          plugin.source.type === 'local' &&
          [this.candidate, nodePath.join(this.candidate, 'index.js')].includes(
            plugin.source.path ?? '',
          ) &&
          plugin.state.status === 'active',
      ),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: exact native candidate inactive',
    );
    assertMatchingTree(this.probe.packageRoot, this.candidate);
    const actualEffect = existsSync(effect) ? readFileSync(effect, 'utf8') : undefined;
    const observed = {
      installation: JSON.stringify([this.candidate, this.project]),
      observations,
      effect: actualEffect,
      expectedEffect,
      before,
      configuration: configSnapshot,
      raw: JSON.stringify({
        native: nativeRaw,
        dispatch: dispatchRaw,
        results,
        configuration: configSnapshot,
        configurationAfter: readDesignConfig(configSnapshot),
      }),
    };
    assertConfiguredDesignEffect(observed, designApproval?.enabled);
    assert.ok(
      dispatchRaw.trim(),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native verification guard missing',
    );
    assertVerificationDispatches(
      dispatches,
      tool,
      nodePath.join(this.candidate, 'runtime/dispatch.js'),
    );
    for (const row of dispatches) {
      assert.equal(row.input.cwd, this.project);
      assert.equal(row.input.session_id, native[0].session_id);
      assert.equal(row.input.tool_name, canonicalTool);
      assert.deepEqual(row.input.tool_input, canonicalInput, 'OPENCODE_OPTION_CODEC_MISMATCH');
      assert.ok(
        row.status === 0 || row.status === 2,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: verification dispatcher failed',
      );
    }
    if (designApproval)
      assertObservedDesignApproval(designApproval.enabled, observations[0], results, observed);
    return observed;
  }

  observedResources() {
    this.assertPackagedResult();
    return {
      delivery: 'native',
      installation: JSON.stringify([this.candidate, this.project]),
      raw: JSON.stringify({
        results: this.results,
        loadedWorkflow: this.loadedWorkflow,
        observations: readFileSync(
          nodePath.join(this.directory, 'native-observations.jsonl'),
          'utf8',
        ),
      }),
      markers: observedCatalogueMarkers(
        JSON.stringify({ results: this.results, loadedWorkflow: this.loadedWorkflow }),
      ),
    };
  }

  propagationPaths() {
    assert.ok(
      nodePath.isAbsolute(this.candidate),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: installed OpenCode candidate missing',
    );
    return installedPropagationPaths(this.candidate, 'portable');
  }

  assertPackagedResult(): void {
    assert.ok(this.probe);
    assertMatchingTree(this.probe.packageRoot, this.candidate);
    const observations = readFileSync(
      nodePath.join(this.directory, 'native-observations.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(
        line =>
          JSON.parse(line) as {
            tool?: string;
            input?: { id?: string };
            prompt?: { text?: string };
            plugins?: { source: { type: string; path?: string }; state: { status: string } }[];
          },
      );
    const invocations = observations.filter(
      row => row.tool === 'skill' && row.input?.id === 'safeword-explain',
    );
    if (this.entrypoint === 'skill')
      assert.equal(
        invocations.length,
        1,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: native skill invocation was not observed',
      );
    const apiRegistration = nodePath.join(this.directory, 'native-command-registration.json');
    let plugins = invocations[0]?.plugins;
    if (this.entrypoint === 'command') {
      plugins = existsSync(apiRegistration)
        ? (JSON.parse(readFileSync(apiRegistration, 'utf8')) as { data: typeof plugins }).data
        : observations.find(row => row.plugins)?.plugins;
    }
    if (this.entrypoint === 'command') this.assertCommandSubmission(observations, apiRegistration);
    assert.ok(
      plugins?.some(
        plugin =>
          plugin.source.type === 'local' &&
          plugin.source.path?.startsWith(this.candidate) &&
          plugin.state.status === 'active',
      ),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native candidate was not active at skill dispatch',
    );
    if (this.entrypoint === 'command')
      assert.ok(
        this.loadedWorkflow.includes(this.probe.workflowMarker),
        'NATIVE_OPENCODE_V2_COMMAND_MISSING',
      );
    if (this.entrypoint === 'command')
      assert.equal(this.argumentObserved, true, 'NATIVE_COMMAND_ARGUMENT_MISSING');
    const result = JSON.stringify({ results: this.results, loadedWorkflow: this.loadedWorkflow });
    assert.ok(
      result.includes(this.probe.workflowMarker),
      `NATIVE_OPENCODE_V2_CATALOGUE_MISSING: native skill did not load the canonical workflow; native result: ${JSON.stringify(this.results[0])}`,
    );
    assert.equal(this.bindingFailure, '', `NATIVE_HELPER_ORIGIN_MISMATCH: ${this.bindingFailure}`);
    assert.ok(
      result.includes(this.probe.guideMarker),
      'NATIVE_HELPER_ORIGIN_MISMATCH: native guide content was not loaded',
    );
    assert.ok(
      result.includes(this.probe.helperMarker),
      'NATIVE_HELPER_ORIGIN_MISMATCH: native helper returned no marker',
    );
    this.assertCommandOutput(this.probe);
    const receiptFile = nodePath.join(this.project, '.host-contract/native-helper.json');
    assert.ok(
      existsSync(receiptFile),
      'NATIVE_HELPER_ORIGIN_MISMATCH: no actual helper side effect',
    );
    const receipt = JSON.parse(readFileSync(receiptFile, 'utf8')) as {
      marker: string;
      origin: string;
      runtime: string;
    };
    assert.equal(receipt.marker, this.probe.helperMarker);
    assert.equal(
      receipt.origin,
      nodePath.join(this.candidate, 'templates/hooks/audit-principle-trace.ts'),
    );
    assert.equal(receipt.runtime, nodePath.join(this.candidate, 'runtime/cli.js'));
  }
}
