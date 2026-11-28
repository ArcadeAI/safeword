import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
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
import {
  sealClaudePluginCatalogue,
  writeClaudePluginCatalogue,
} from '../../src/claude-plugin/catalogue.js';
import { shellQuote } from '../../src/cli-protocol/replay-command.js';
import { VERSION } from '../../src/version.js';
import { parseShellWords } from '../../templates/hooks/lib/shell-segments.js';
import {
  assertClaudeNativeContinuation,
  observeClaudeNativeContinuation,
} from './claude-native-continuation.js';
import { ClaudeNativeContractActor, type ClaudeNativeFixture } from './claude-native-contract.js';
import { assertMatchingTree } from './codex-plugin-package.js';
import {
  type CanonicalCatalogueInputs,
  createCanonicalCatalogueInputs,
  observedCatalogueMarkers,
} from './native-catalogue-probe.js';
import {
  assertArchitectureObservation,
  ObservedPropagationMismatch,
  preparePropagationCompletion,
  preparePropagationDesignApproval,
  type PropagationArchitectureCase,
} from './propagation-policy-case.js';
import { generatePropagationPackage, installedPropagationPaths } from './propagation-source.js';

/** Retain the registered native package and project across canonical revisions. */
export class ClaudeNativeCatalogueActor {
  private readonly actor: ClaudeNativeContractActor;
  private readonly backups: { path: string; backup: string }[] = [];
  private inputs?: CanonicalCatalogueInputs;
  private turn = 0;
  private cliBundle = '';
  private readonly configuredSession = randomUUID();
  private configuredSessionStarted = false;
  private continuation?: Awaited<ReturnType<typeof observeClaudeNativeContinuation>>;
  private readonly handoffSession = randomUUID();
  private handoffStarted = false;

  constructor(private readonly fixture: ClaudeNativeFixture) {
    this.actor = new ClaudeNativeContractActor(fixture);
  }

  private get handoffHandbook() {
    return nodePath.join(this.fixture.runtimePath, 'resources/SAFEWORD.md');
  }

  private handoffHelper() {
    const skill = readFileSync(
      nodePath.join(this.fixture.runtimePath, 'skills/explain/SKILL.md'),
      'utf8',
    );
    const script = /```bash\n([\s\S]*?)```/u.exec(skill)?.[1];
    assert.ok(script, 'NATIVE_HELPER_ORIGIN_MISMATCH: no declared helper');
    const lines = script.trim().split('\n');
    assert.equal(lines.length, 2);
    assert.equal(lines[0], 'PROJECT_DIR="$PWD"');
    assert.deepEqual(parseShellWords(lines[1] ?? ''), [
      'bun',
      '${CLAUDE_PLUGIN_ROOT}/runtime/hooks/audit-principle-trace.ts',
      '$PROJECT_DIR',
    ]);
    return {
      runtime: nodePath.join(this.fixture.runtimePath, 'runtime/hooks/audit-principle-trace.ts'),
      command: `CLAUDE_PLUGIN_ROOT=${shellQuote(this.fixture.runtimePath)}\n${script}`,
    };
  }

  private handoffResult(capture: string, id: string) {
    const results = this.actor
      .events(capture)
      .flatMap(row => (row.type === 'user' ? (row.message?.content ?? []) : []))
      .filter(row => row.type === 'tool_result' && row.tool_use_id === id);
    assert.equal(results.length, 1, 'CLAUDE_HANDOFF_HELPER_RESULT_MISSING');
    const result = results[0];
    assert.ok(result);
    assert.notEqual(result.is_error, true, 'CLAUDE_HANDOFF_HELPER_RESULT_MISSING');
    return result;
  }

  private handoffCalls(
    capture: string,
    currentTool: boolean,
    helper: { runtime: string; command: string },
  ) {
    const calls = this.actor
      .events(capture)
      .flatMap(row => (row.type === 'assistant' ? (row.message?.content ?? []) : []))
      .filter(row => row.type === 'tool_use');
    if (!currentTool) {
      assert.equal(calls.length, 0, 'CLAUDE_HANDOFF_HELPER_UNEXPECTED');
      return calls;
    }
    const helpers = calls.filter(
      row => row.name === 'Bash' && row.input?.command?.trim() === helper.command.trim(),
    );
    assert.equal(helpers.length, 1, 'CLAUDE_HANDOFF_HELPER_MISSING');
    const call = helpers[0];
    assert.ok(call);
    assert.equal(
      calls.filter(row => row.name === 'Bash').length,
      1,
      'CLAUDE_HANDOFF_UNEXPECTED_TOOL',
    );
    const preceding = calls.slice(0, -1);
    assert.equal(calls.at(-1), call, 'CLAUDE_HANDOFF_UNEXPECTED_TOOL');
    const handbook = this.handoffHandbook;
    const inspections =
      preceding[0]?.input?.file_path === handbook ? [handbook, helper.runtime] : [helper.runtime];
    assert.ok(preceding.length <= inspections.length, 'CLAUDE_HANDOFF_UNEXPECTED_TOOL');
    for (const [index, inspection] of preceding.entries()) {
      assert.equal(inspection.name, 'Read', 'CLAUDE_HANDOFF_UNEXPECTED_TOOL');
      assert.equal(
        inspection.input?.file_path,
        inspections[index],
        'CLAUDE_HANDOFF_UNEXPECTED_TOOL',
      );
      assert.ok(inspection.id);
      this.handoffResult(capture, inspection.id);
    }
    return helpers;
  }

  private assertHandoffHelper(
    capture: string,
    currentTool: boolean,
    helper: { runtime: string; command: string },
  ) {
    const calls = this.handoffCalls(capture, currentTool, helper);
    const file = nodePath.join(this.actor.project, '.host-contract/native-helper.json');
    assert.equal(calls.length, currentTool ? 1 : 0, 'CLAUDE_HANDOFF_HELPER_MISSING');
    let record: { marker: string; origin: string } | undefined;
    if (currentTool) {
      const call = calls[0];
      assert.ok(call?.id);
      assert.equal(call.name, 'Bash');
      assert.equal(
        call.input?.command?.trim(),
        helper.command.trim(),
        'NATIVE_HELPER_ORIGIN_MISMATCH',
      );
      const result = this.handoffResult(capture, call.id);
      assert.ok(
        this.inputs && result.content?.includes(this.inputs.helperMarker),
        'CLAUDE_HANDOFF_HELPER_RESULT_MISSING',
      );
      assert.ok(existsSync(file), 'CLAUDE_HANDOFF_HELPER_MISSING');
      record = JSON.parse(readFileSync(file, 'utf8'));
      assert.ok(record);
      assert.equal(record.marker, this.inputs.helperMarker);
      assert.equal(realpathSync(record.origin), helper.runtime, 'NATIVE_HELPER_ORIGIN_MISMATCH');
    } else assert.equal(existsSync(file), false, 'CLAUDE_HANDOFF_HELPER_UNEXPECTED');
    return record;
  }

  private assertHandoffOutcome(
    observations: ReturnType<ClaudeNativeContractActor['observations']>,
    correction: boolean,
  ) {
    const decisions = observations.map(row => JSON.parse(row.stdout.trim() || '{}'));
    const first = observations[0];
    assert.ok(first);
    assert.equal(first.input.stop_hook_active, false);
    assert.equal(first.input.last_assistant_message, 'READY', 'CLAUDE_HANDOFF_MESSAGE_MISMATCH');
    if (correction) {
      assert.equal(decisions[0].decision, 'block', 'CLAUDE_HANDOFF_OPTION_DROPPED');
      assert.match(
        decisions[0].reason,
        /terminal-handoff\/v1 correction/u,
        'CLAUDE_HANDOFF_REASON_MISMATCH',
      );
      assert.equal(observations.length, 2, 'CLAUDE_HANDOFF_CONTINUATION_BOUND_MISMATCH');
      assert.equal(observations[1]?.input.stop_hook_active, true);
      assert.deepEqual(decisions[1], {});
    } else assert.deepEqual(decisions[0], {});
    assert.equal(
      observations.length,
      correction ? 2 : 1,
      'CLAUDE_HANDOFF_CONTINUATION_BOUND_MISMATCH',
    );
    return decisions;
  }

  private assertHandoffFinalMessage(
    capture: string,
    observations: ReturnType<ClaudeNativeContractActor['observations']>,
  ) {
    const last = this.actor.events(capture).findLast(row => row.type === 'assistant');
    const text = last?.message?.content
      ?.filter(row => row.type === 'text')
      .map(row => row.text)
      .join('\n');
    assert.equal(
      text,
      observations.at(-1)?.input.last_assistant_message,
      'CLAUDE_HANDOFF_MESSAGE_MISMATCH',
    );
  }

  private async observePhaseWrite(
    enabled: boolean,
    optionConfig?: PropagationArchitectureCase['options'],
  ) {
    const actor = this.actor;
    const session = randomUUID();
    const prepared = preparePropagationDesignApproval(actor.project, enabled);
    const config = nodePath.join(actor.project, '.safeword/config.json');
    if (optionConfig) {
      const previous = JSON.parse(readFileSync(config, 'utf8'));
      writeFileSync(config, JSON.stringify({ ...previous, ...optionConfig }));
    }
    const snapshot = { path: config, bytes: readFileSync(config, 'utf8') };
    const input = { file_path: prepared.file, content: prepared.after };
    const offset = actor.observations().length;
    const capture = `design-approval-${++this.turn}`;
    let turnError: unknown;
    try {
      await actor.turn(
        `Authorized isolated planning transition. Read ${prepared.file} first, then use Write exactly once with the following exact input. Let installed hooks govern this action; rejection is expected. Do not retry, repair files, change configuration, bypass a hook or perform other work. Report the actual tool result and stop.\nWRITE_INPUT=${JSON.stringify(input)}`,
        'Read,Write',
        capture,
        { sessionId: session },
      );
    } catch (error) {
      if (!optionConfig) throw error;
      turnError = error;
    } finally {
      if (enabled && !optionConfig)
        assert.equal(
          readFileSync(prepared.file, 'utf8'),
          prepared.before,
          'CLAUDE_DENIED_PHASE_WRITE_REACHED_DISK',
        );
    }
    const events = actor.events(capture);
    const attempts = events
      .flatMap(row => (row.type === 'assistant' ? (row.message?.content ?? []) : []))
      .filter(row => row.type === 'tool_use' && row.name === 'Write');
    assert.equal(
      attempts.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: expected one native phase Write',
    );
    const attempt = attempts[0];
    assert.ok(attempt);
    assert.deepEqual(attempt.input, input, 'CLAUDE_PHASE_WRITE_INPUT_MISMATCH');
    const observations = actor
      .observations()
      .slice(offset)
      .filter(
        row =>
          row.args.includes('PreToolUse') &&
          row.args.some(argument => argument.endsWith('/pre-tool-quality.ts')) &&
          row.input.tool_name === 'Write',
      );
    const ticket = readFileSync(prepared.file, 'utf8');
    const observation = {
      installation: JSON.stringify([this.fixture.runtimePath, actor.project]),
      configuration: snapshot,
      effect: ticket,
      before: prepared.before,
      expectedEffect: prepared.after,
      raw: JSON.stringify({
        observations,
        events,
        configuration: snapshot,
        configurationAfter: readFileSync(config, 'utf8'),
        effect: ticket,
        requestedSession: session,
        requestedInput: input,
        turnError: turnError instanceof Error ? turnError.message : undefined,
      }),
    };
    this.assertConfiguredWriteEffect(optionConfig, observation, events);
    if (turnError) {
      assert.ok(turnError instanceof Error);
      throw turnError;
    }
    assert.equal(
      observations.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native phase Write guard missing',
    );
    const guard = observations[0];
    assert.ok(guard);
    assert.ok(
      guard.args.includes(nodePath.join(this.fixture.runtimePath, 'runtime/dispatch.js')),
      'CLAUDE_PHASE_WRITE_RUNTIME_MISMATCH',
    );
    assert.equal(guard.status, 0, guard.stderr);
    assert.equal(guard.input.cwd, actor.project);
    assert.equal(guard.input.session_id, session);
    assert.equal(Reflect.get(guard.input, 'hook_event_name'), 'PreToolUse');
    assert.deepEqual(guard.input.tool_input, input, 'CLAUDE_PHASE_WRITE_INPUT_MISMATCH');
    assert.ok(guard.input.tool_use_id);
    assert.equal(guard.input.tool_use_id, attempt.id);
    const results = events
      .flatMap(row => (row.type === 'user' ? (row.message?.content ?? []) : []))
      .filter(row => row.type === 'tool_result' && row.tool_use_id === guard.input.tool_use_id);
    assert.equal(
      results.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native phase Write result missing',
    );
    const result = results[0];
    assert.ok(result);
    const decision = JSON.parse(guard.stdout.trim() || '{}');
    if (optionConfig)
      assert.equal(
        readFileSync(config, 'utf8'),
        snapshot.bytes,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: settings changed during native turn',
      );
    const completed = { ...observation, decision };
    this.assertPhaseWriteOutcome(
      { designApprovalGate: enabled, configuration: optionConfig },
      decision,
      result,
      completed,
    );
    return { ...completed, decisions: [decision], ticket };
  }

  private assertConfiguredWriteEffect(
    optionConfig: PropagationArchitectureCase['options'] | undefined,
    observation: { raw: string; effect: string; before: string },
    events: ReturnType<ClaudeNativeContractActor['events']>,
  ) {
    if (!optionConfig?.designApprovalGate || observation.effect === observation.before) return;
    const loaded = events
      .find(row => row.type === 'system' && row.subtype === 'init')
      ?.plugins?.find(row => row.name === 'safeword');
    assert.ok(loaded, 'HOST_CONTRACT_PROOF_UNAVAILABLE: native session did not load Safeword');
    assert.equal(realpathSync(loaded.path), realpathSync(this.fixture.runtimePath));
    const manifest = nodePath.join(this.fixture.runtimePath, 'hooks/hooks.json');
    const hooks = JSON.parse(readFileSync(manifest, 'utf8'));
    const binding = hooks.hooks.PreToolUse.flatMap(
      (row: { hooks: { command: string }[] }) => row.hooks,
    ).find((row: { command: string }) => row.command.includes('/pre-tool-quality.ts'));
    assert.ok(binding, 'HOST_CONTRACT_PROOF_UNAVAILABLE: installed phase Write binding missing');
    // A declaration is not a dispatch receipt; absent callbacks remain absent.
    const bypass = { ...observation, bindingDeclaration: { manifest, command: binding.command } };
    throw new ObservedPropagationMismatch(
      bypass,
      new Error('CLAUDE_DENIED_PHASE_WRITE_REACHED_DISK'),
    );
  }

  private assertPhaseWriteOutcome(
    options: Pick<PropagationArchitectureCase['options'], 'designApprovalGate'> & {
      configuration?: PropagationArchitectureCase['options'];
    },
    decision: {
      hookSpecificOutput?: {
        hookEventName?: string;
        permissionDecision?: string;
        permissionDecisionReason?: string;
      };
    },
    result: { is_error?: boolean; content?: string },
    effect: { raw: string; effect: string; before: string; expectedEffect: string },
  ) {
    try {
      if (options.designApprovalGate) {
        assert.equal(effect.effect, effect.before, 'CLAUDE_DENIED_PHASE_WRITE_REACHED_DISK');
        assert.equal(decision.hookSpecificOutput?.hookEventName, 'PreToolUse');
        assert.equal(
          decision.hookSpecificOutput?.permissionDecision,
          'deny',
          'CLAUDE_DESIGN_APPROVAL_OUTCOME_MISMATCH',
        );
        assert.match(
          decision.hookSpecificOutput.permissionDecisionReason ?? '',
          /design approval.*approve-plan/isu,
          'CLAUDE_DESIGN_APPROVAL_REASON_MISMATCH',
        );
        assert.equal(result.is_error, true, 'CLAUDE_DESIGN_APPROVAL_RESULT_MISSING');
        assert.match(
          result.content ?? '',
          /design approval.*approve-plan/isu,
          'CLAUDE_DESIGN_APPROVAL_RESULT_MISSING',
        );
      } else {
        assert.ok(
          [undefined, 'allow'].includes(decision.hookSpecificOutput?.permissionDecision),
          'CLAUDE_DESIGN_APPROVAL_OUTCOME_MISMATCH',
        );
        assert.notEqual(result.is_error, true, 'CLAUDE_DESIGN_APPROVAL_RESULT_MISSING');
        assert.equal(effect.effect, effect.expectedEffect, 'CLAUDE_ALLOWED_PHASE_WRITE_MISSING');
      }
    } catch (error) {
      if (!options.configuration) throw error;
      throw new ObservedPropagationMismatch(effect, error);
    }
  }

  async observeDesignApproval(optionConfig: PropagationArchitectureCase['options']) {
    const {
      installation,
      raw,
      configuration: snapshot,
      decision,
      effect,
      before,
      expectedEffect,
    } = await this.observePhaseWrite(optionConfig.designApprovalGate, optionConfig);
    return { installation, raw, configuration: snapshot, decision, effect, before, expectedEffect };
  }

  /** Bounded correction on Claude's non-edit Stop path; never a done-gate/action denial. */
  async observeHandoff(options: {
    enabled: boolean;
    currentTool: boolean;
    configuration?: PropagationArchitectureCase['options'];
  }) {
    const actor = this.actor;
    const session = this.handoffSession;
    const given = preparePropagationCompletion(actor.project, session, 'claude', '');
    writeFileSync(
      nodePath.join(given.ticket, 'ticket.md'),
      given.content.replace('phase: done', 'phase: implement'),
    );
    const config = nodePath.join(actor.project, '.safeword/config.json');
    const previous = JSON.parse(readFileSync(config, 'utf8'));
    writeFileSync(
      config,
      JSON.stringify({
        ...previous,
        ...options.configuration,
        terminalHandoffCorrection: options.enabled,
      }),
    );
    const snapshot = { path: config, bytes: readFileSync(config, 'utf8') };
    const helper = this.handoffHelper();
    rmSync(nodePath.join(actor.project, '.host-contract/native-helper.json'), { force: true });
    const capture = `handoff-${++this.turn}`;
    const offset = actor.observations().length;
    const toolInstructions = options.currentTool
      ? `If startup requests the handbook, Read ${this.handoffHandbook} first. You may then inspect the declared helper with one Read of its exact file path. Execute the following packaged helper exactly once in one Bash call in this current turn. Use no other tools.`
      : 'Use no tools in this turn.';
    await actor.turn(
      `Authorized isolated terminal test. ${toolInstructions} Then reply only READY and stop. Do not edit other files/configuration, write helper results yourself or perform other work. If the host supplies a correction, report it honestly without further tools.\nHANDOFF_HELPER_COMMAND=${JSON.stringify(options.currentTool ? helper.command : '')}`,
      options.currentTool ? 'Read,Bash' : '',
      capture,
      {
        sessionId: session,
        resume: this.handoffStarted,
        // Fix the malformed test input; installed Stop policy still decides the outcome.
        appendSystemPrompt:
          'For this isolated native Stop-hook conformance test, deliberately make the INITIAL final answer for each new user request exactly READY, with no Markdown or additional text. This is only the test input for the real installed hook, not permission to bypass any hook. Use only the requested tools and follow the requested helper procedure, including permitted Read inspection. If a Stop hook supplies feedback after that initial answer, follow its feedback honestly in the automatic continuation, with no further tools. Do not add a decision brief to the initial answer before the Stop hook has supplied feedback.',
      },
    );
    if (options.configuration)
      assert.equal(
        readFileSync(config, 'utf8'),
        snapshot.bytes,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: settings changed during native turn',
      );
    this.handoffStarted = true;
    const observedHelper = this.assertHandoffHelper(capture, options.currentTool, helper);
    const observations = actor
      .observations()
      .slice(offset)
      .filter(
        row =>
          row.args.includes('Stop') &&
          row.args.some(argument => argument.endsWith('/stop-quality.ts')),
      );
    assert.ok(observations.length, 'HOST_CONTRACT_PROOF_UNAVAILABLE: native handoff Stop missing');
    for (const row of observations) {
      assert.equal(row.status, 0, row.stderr);
      assert.equal(row.input.session_id, session);
      assert.equal(row.input.cwd, actor.project);
      assert.equal(row.input.hook_event_name, 'Stop');
      assert.ok(row.args.includes(nodePath.join(this.fixture.runtimePath, 'runtime/dispatch.js')));
      assert.ok(
        row.input.transcript_path && existsSync(row.input.transcript_path),
        'HOST_CONTRACT_PROOF_UNAVAILABLE: native handoff transcript missing',
      );
    }
    // Preserve the actual callback/effect/configuration BEFORE outcome grading.
    const observation = {
      installation: JSON.stringify([this.fixture.runtimePath, actor.project]),
      decisions: observations.map(row => JSON.parse(row.stdout.trim() || '{}')),
      configuration: snapshot,
      helper: observedHelper,
      raw: JSON.stringify({
        observations,
        events: actor.events(capture),
        helper: observedHelper,
        configuration: snapshot,
      }),
    };
    assert.ok(
      observation.decisions.every(row => row && typeof row === 'object' && !Array.isArray(row)),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: malformed native handoff Stop',
    );
    assert.equal(
      observations[0]?.input.last_assistant_message,
      'READY',
      'CLAUDE_HANDOFF_MESSAGE_MISMATCH',
    );
    this.assertHandoffFinalMessage(capture, observations);
    try {
      observation.decisions = this.assertHandoffOutcome(
        observations,
        options.enabled && options.currentTool,
      );
    } catch (error) {
      throw new ObservedPropagationMismatch(observation, error);
    }
    return observation;
  }

  async prepare(inputs?: CanonicalCatalogueInputs): Promise<void> {
    await this.actor.prepare();
    this.cliBundle = readFileSync(
      nodePath.join(this.fixture.runtimePath, 'runtime/cli.js'),
      'utf8',
    );
    for (const [index, path] of [this.fixture.runtimePath, this.fixture.installedPath].entries()) {
      const backup = nodePath.join(this.actor.directory, `package-before-${index}`);
      cpSync(path, backup, { recursive: true });
      this.backups.push({ path, backup });
    }
    await this.refreshResources(inputs ?? createCanonicalCatalogueInputs(this.actor.directory));
    mkdirSync(nodePath.join(this.actor.project, '.host-contract'));
  }

  propagationPaths() {
    return installedPropagationPaths(this.fixture.runtimePath, 'claude');
  }

  async refreshResources(inputs: CanonicalCatalogueInputs): Promise<void> {
    const candidate = nodePath.join(this.actor.directory, 'candidate');
    if (inputs.sourcePackage) {
      const staging = mkdtempSync(nodePath.join(this.actor.directory, 'policy-build-'));
      try {
        const generated = nodePath.join(staging, 'portable');
        await generatePropagationPackage(inputs, generated, 'claude');
        mkdirSync(candidate, { recursive: true });
        reconcileGeneratedTree(generated, candidate);
      } finally {
        rmSync(staging, { recursive: true, force: true });
      }
    } else {
      writeClaudePluginCatalogue(
        {
          cliBundle: this.cliBundle,
          sourceRoot: nodePath.resolve(import.meta.dirname, '../../src'),
          templatesRoot: inputs.canonicalRoot,
          version: VERSION,
        },
        candidate,
      );
      sealClaudePluginCatalogue(candidate, VERSION);
    }
    for (const { path } of this.backups) {
      reconcileGeneratedTree(candidate, path);
    }
    await this.actor.prepare(candidate);
    this.inputs = inputs;
  }

  async observe() {
    const actor = this.actor;
    const inputs = this.inputs;
    const fixture = this.fixture;
    assert.ok(inputs);
    const capture = `catalogue-${++this.turn}`;
    const helper = nodePath.join(fixture.runtimePath, 'runtime/hooks/audit-principle-trace.ts');
    const receipt = nodePath.join(actor.project, '.host-contract/native-helper.json');
    const preflight = execFileSync('bun', [helper, actor.project], {
      cwd: actor.project,
      encoding: 'utf8',
    });
    assert.equal(preflight.trim(), inputs.helperMarker);
    rmSync(receipt);
    await actor.turn(
      'Invoke /safeword:explain using its discovered Skill tool. Follow that skill’s packaged guide and runtime helper instructions, then report the actual markers. Do no other work or write receipts yourself.',
      'Skill,Read,Bash',
      capture,
    );
    const events = actor
      .events(capture)
      .filter(event => event.type === 'user' || event.type === 'assistant');
    const calls = events
      .flatMap(event => (event.type === 'assistant' ? (event.message?.content ?? []) : []))
      .filter(content => content.type === 'tool_use');
    assert.ok(
      calls.some(call => call.name === 'Skill' && call.input?.skill === 'safeword:explain'),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native model did not invoke Skill',
    );
    const guide = nodePath.join(fixture.runtimePath, 'skills/explain/HOST_CONTRACT_GUIDE.md');
    assert.ok(
      calls.some(
        call =>
          call.name === 'Read' &&
          call.input?.file_path &&
          realpathSync(call.input.file_path) === realpathSync(guide),
      ),
      'NATIVE_CLAUDE_CATALOGUE_MISSING: packaged guide was not read',
    );
    const raw = readFileSync(nodePath.join(actor.directory, `${capture}-events.jsonl`), 'utf8');
    const turnOutput = JSON.stringify(events);
    for (const marker of [inputs.workflowMarker, inputs.guideMarker, inputs.helperMarker])
      assert.ok(
        turnOutput.includes(marker),
        'NATIVE_CLAUDE_CATALOGUE_MISSING: canonical marker not observed',
      );
    const result = JSON.parse(readFileSync(receipt, 'utf8')) as { marker: string; origin: string };
    assert.equal(result.marker, inputs.helperMarker, 'NATIVE_HELPER_ORIGIN_MISMATCH');
    assert.equal(
      realpathSync(result.origin),
      realpathSync(helper),
      'NATIVE_HELPER_ORIGIN_MISMATCH',
    );
    const helperCall = calls.find(
      call => call.name === 'Bash' && call.input?.command?.includes(helper),
    );
    assert.ok(
      helperCall?.id,
      'NATIVE_HELPER_ORIGIN_MISMATCH: native Bash did not invoke the packaged helper',
    );
    const toolOutput = events
      .flatMap(event => (event.type === 'user' ? (event.message?.content ?? []) : []))
      .filter(
        content =>
          content.type === 'tool_result' &&
          !content.is_error &&
          content.tool_use_id === helperCall.id,
      );
    assert.ok(
      toolOutput.some(content => content.content?.includes(inputs.helperMarker)),
      'NATIVE_HELPER_ORIGIN_MISMATCH: helper output did not reach the native host',
    );
    return {
      delivery: 'native',
      installation: JSON.stringify([this.fixture.runtimePath, actor.project]),
      raw,
      markers: observedCatalogueMarkers(turnOutput),
    };
  }

  async observeContinuation() {
    assert.ok(
      this.configuredSessionStarted,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: retained Claude session missing',
    );
    this.continuation = await observeClaudeNativeContinuation(
      this.actor,
      this.configuredSession,
      true,
    );
    return {
      installation: JSON.stringify([this.fixture.runtimePath, this.actor.project]),
      raw: JSON.stringify(this.continuation),
    };
  }

  assertContinuation() {
    assert.ok(this.continuation, 'HOST_CONTRACT_PROOF_UNAVAILABLE: Claude continuation missing');
    assertClaudeNativeContinuation(this.actor, this.continuation);
  }

  /** Root-only native execution: no direct helper invocation supplies the decision. */
  async observeVerification(
    evidence: string,
    architecture?: PropagationArchitectureCase,
    designApproval?: { enabled: boolean; configuration?: PropagationArchitectureCase['options'] },
  ) {
    if (designApproval)
      return this.observePhaseWrite(designApproval.enabled, designApproval.configuration);
    const actor = this.actor;
    const session = architecture ? this.configuredSession : randomUUID();
    const { ticket } = preparePropagationCompletion(
      actor.project,
      session,
      'claude',
      evidence,
      architecture,
    );
    const config = architecture
      ? {
          path: nodePath.join(actor.project, '.safeword/config.json'),
          bytes: readFileSync(nodePath.join(actor.project, '.safeword/config.json'), 'utf8'),
        }
      : undefined;
    const offset = actor.observations().length;
    const capture = `verification-${++this.turn}`;
    await actor.turn(
      'Authorized isolated completion test. Reply with READY and stop. Do not use tools, edit files, repair verification or perform other work. Let installed native Stop hooks govern completion.',
      '',
      capture,
      {
        sessionId: session,
        resume: !!architecture && this.configuredSessionStarted,
        maxTurns: 1,
        allowTurnLimit: true,
      },
    );
    if (config)
      assert.equal(
        readFileSync(config.path, 'utf8'),
        config.bytes,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: settings changed during native turn',
      );
    if (architecture) this.configuredSessionStarted = true;
    const observations = actor
      .observations()
      .slice(offset)
      .filter(
        row =>
          row.input.session_id === session &&
          row.input.cwd === actor.project &&
          row.args.includes('Stop') &&
          row.args.some(argument => argument.endsWith('/stop-quality.ts')),
      );
    assert.ok(
      observations.length > 0,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native Stop decision missing',
    );
    for (const observation of observations) assert.equal(observation.status, 0, observation.stderr);
    const decisions = observations.map(row => (row.stdout.trim() ? JSON.parse(row.stdout) : {}));
    const observation = {
      installation: JSON.stringify([this.fixture.runtimePath, actor.project]),
      decisions,
      ticket: readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8'),
      ...(config && { configuration: config }),
      raw: JSON.stringify({
        observations,
        events: actor.events(capture),
        configuration: config,
      }),
    };
    if (architecture)
      assertArchitectureObservation(observation, architecture.options.architectureReviewGate);
    return observation;
  }

  close(): void {
    if (this.backups.length === 0) return;
    for (const { path, backup } of this.backups) {
      rmSync(path, { recursive: true });
      cpSync(backup, path, { recursive: true });
    }
    assertMatchingTree(
      nodePath.resolve(import.meta.dirname, '../../../../plugin'),
      this.fixture.runtimePath,
    );
    assertMatchingTree(this.fixture.runtimePath, this.fixture.installedPath);
  }
}

/** Single-turn compatibility helper; the propagation runner retains the actor instead. */
export async function proveClaudeNativeCatalogue(
  fixture: ClaudeNativeFixture,
  inputs?: CanonicalCatalogueInputs,
) {
  const actor = new ClaudeNativeCatalogueActor(fixture);
  try {
    await actor.prepare(inputs);
    return await actor.observe();
  } finally {
    actor.close();
  }
}
