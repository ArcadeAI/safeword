import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { reconcileGeneratedTree } from '../../scripts/generated-tree-differences.js';
import { shellQuote } from '../../src/cli-protocol/replay-command.js';
import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import { extractFilePath, extractWriteContent } from '../../templates/hooks/cursor/gate-adapter.js';
import {
  observedHelperProgram,
  observedNativeShellResults,
  observedNativeWrite,
  type ObservedShell,
  requireNativeHelperExecution,
} from './cursor-cli-observations.js';
import { command } from './cursor-native-window.js';
import {
  type CanonicalCatalogueInputs,
  createCanonicalCatalogueInputs,
  createNativeCatalogueProbe,
  type NativeCatalogueProbe,
  observedCatalogueMarkers,
  refreshNativeCatalogueProbe,
} from './native-catalogue-probe.js';
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

const cliRoot = nodePath.resolve(import.meta.dirname, '../..');

const resourceDigest = (file: string): string =>
  createHash('sha256').update(readFileSync(file)).digest('hex');

/** Correlate the real hook decision with the native tool result and owned effect. */
function assertReadinessEffect(
  decision: { permission: string; user_message?: string },
  shell: ObservedShell,
  effect: string | undefined,
  expectedEffect: string,
): void {
  if (decision.permission === 'deny') {
    assert.ok(typeof decision.user_message === 'string' && decision.user_message.length > 0);
    assert.ok(
      shell.result?.rejected?.reason?.includes(decision.user_message),
      'CURSOR_NATIVE_DENIAL_NOT_OBSERVED',
    );
    assert.equal(shell.result?.success, undefined);
    assert.equal(effect, undefined, 'CURSOR_DENIED_ACTION_HAS_EFFECT');
  } else {
    assert.equal(shell.result?.success?.exitCode, 0, 'CURSOR_ALLOWED_ACTION_NOT_EXECUTED');
    assert.equal(shell.result?.rejected, undefined);
    assert.equal(effect, expectedEffect, 'CURSOR_ALLOWED_ACTION_EFFECT_MISSING');
  }
}

/** Native CLI skill discovery plus observed packaged helper output. */
export class CursorCliCatalogueActor {
  private readonly temporary = mkdtempSync(nodePath.join(tmpdir(), 'cursor-cli-catalogue-'));
  private readonly root = realpathSync(this.temporary);
  private readonly workspace = nodePath.join(this.root, 'workspace');
  private readonly extension = nodePath.join(this.root, 'native-extension');
  private probe?: NativeCatalogueProbe;
  private stdout = '';
  private readinessTurns = 0;
  private canonical?: CanonicalCatalogueInputs;
  private readonly observerLog = nodePath.join(this.root, 'stop-observations.jsonl');
  private readonly shim = nodePath.join(this.root, 'bin');
  private readonly shell = nodePath.join(this.root, 'shell');
  private readonly realBun = realpathSync(
    execFileSync('which', ['bun'], { encoding: 'utf8' }).trim(),
  );
  private readonly expectedResources = new Map<string, string>();

  constructor(
    private readonly executable: string,
    private readonly inputs?: CanonicalCatalogueInputs,
    private readonly disabledClaudePlugins?: readonly string[],
  ) {
    mkdirSync(this.shim);
    mkdirSync(this.shell);
    for (const name of ['.zprofile', '.zshrc']) {
      writeFileSync(
        nodePath.join(this.shell, name),
        `export PATH=${shellQuote(this.shim)}:"$PATH"\n`,
      );
    }
    const observer = nodePath.join(
      cliRoot,
      'tests/fixtures/host-contract/native-runtime-observer.mjs',
    );
    writeFileSync(
      nodePath.join(this.shim, 'bun'),
      `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(observer)} "$@"\n`,
      { mode: 0o755 },
    );
  }

  private environment(): NodeJS.ProcessEnv {
    if (this.disabledClaudePlugins?.length) {
      const directory = nodePath.join(this.workspace, '.claude');
      const file = nodePath.join(directory, 'settings.local.json');
      const settings = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
      const disabled = Object.fromEntries(this.disabledClaudePlugins.map(name => [name, false]));
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        file,
        JSON.stringify({
          ...settings,
          enabledPlugins: {
            ...settings.enabledPlugins,
            ...disabled,
          },
        }),
      );
    }
    return {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([name]) => !name.startsWith('CLAUDE_') && !name.startsWith('SAFEWORD_'),
        ),
      ),
      CURSOR_CONFIG_DIR: nodePath.join(this.root, 'profile'),
      CURSOR_DATA_DIR: nodePath.join(this.root, 'data'),
      ZDOTDIR: this.shell,
      CLAUDE_CONFIG_DIR: nodePath.join(this.root, 'foreign-claude'),
      PATH: `${this.shim}:${process.env.PATH ?? ''}`,
      SAFEWORD_OBSERVER_REAL_BUN: this.realBun,
      SAFEWORD_OBSERVER_RUNTIME: nodePath.join(this.extension, 'runtime/dispatch.js'),
      SAFEWORD_OBSERVER_LOG: this.observerLog,
    };
  }

  private shellObservations(event = 'beforeShellExecution') {
    assert.ok(
      existsSync(this.observerLog),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native Cursor CLI readiness hook missing',
    );
    return readFileSync(this.observerLog, 'utf8')
      .trim()
      .split('\n')
      .map(
        line =>
          JSON.parse(line) as {
            args: string[];
            input: {
              conversation_id: string;
              workspace_roots: string[];
              status: string;
              command: string;
              hook_event_name: string;
              tool_name?: string;
              tool_input?: Record<string, unknown>;
            };
            stdout: string;
            stderr: string;
            status: number;
          },
      )
      .filter(row => row.args.at(-1)?.startsWith(`${event}:`));
  }

  private async readinessOutput(args: string[]): Promise<string> {
    const rawFile = nodePath.join(this.root, `readiness-${++this.readinessTurns}.jsonl`);
    let raw: string;
    try {
      raw = await command(this.executable, args, {
        cwd: this.workspace,
        env: this.environment(),
        timeout: 240_000,
      });
    } catch (error) {
      // execFile retains partial streams on failure; preserve them without
      // converting a failed/aborted process into a successful turn.
      if (error && typeof error === 'object') {
        if ('stdout' in error && typeof error.stdout === 'string')
          writeFileSync(rawFile, error.stdout);
        if ('stderr' in error && typeof error.stderr === 'string')
          writeFileSync(`${rawFile}.stderr`, error.stderr);
      }
      throw error;
    }
    writeFileSync(rawFile, raw);
    return raw;
  }

  private readinessTurn(ownedCommand: string) {
    return this.nativeTurn(
      `Run exactly this owned local readiness command once. Do no other work and do not retry a rejected action.\nCommand: ${ownedCommand}\nReport its actual result without changing files.`,
    );
  }

  private async nativeTurn(prompt: string) {
    assert.ok(this.probe);
    const args = [
      '--workspace',
      this.workspace,
      '--plugin-dir',
      this.probe.packageRoot,
      '--plugin-dir',
      this.extension,
      '--trust',
      '--print',
      '--output-format',
      'stream-json',
    ];
    if (process.env.SAFEWORD_CURSOR_CLI_MODEL)
      args.push('--model', process.env.SAFEWORD_CURSOR_CLI_MODEL);
    args.push(prompt);
    const raw = await this.readinessOutput(args);
    const events = raw
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    const result = events.findLast(row => row.type === 'result');
    assert.equal(
      result?.subtype,
      'success',
      'HOST_CONTRACT_PROOF_UNAVAILABLE: Cursor CLI turn incomplete',
    );
    assert.equal(result.is_error, false);
    assert.ok(typeof result.session_id === 'string' && result.session_id.length > 0);
    return { raw, session: result.session_id as string };
  }

  async prepare(host: string, version: string, runtime: string): Promise<void> {
    assert.equal(host, 'Cursor');
    assert.equal(version, hostReleases.cursorCli.version);
    assert.equal(runtime, 'CLI');
    assert.ok(nodePath.isAbsolute(this.executable));
    const actualVersion = await command(this.executable, ['--version']);
    assert.equal(
      actualVersion.trim(),
      version,
      'CURSOR_CLI_UNAVAILABLE: catalogue exact version mismatch',
    );
    for (const directory of ['.cursor', '.safeword', '.host-contract'])
      mkdirSync(nodePath.join(this.workspace, directory), { recursive: true });
    writeFileSync(
      nodePath.join(this.workspace, '.safeword/SAFEWORD.md'),
      'Synthetic enrolled project.\n',
    );
    writeFileSync(
      nodePath.join(this.workspace, '.safeword/config.json'),
      JSON.stringify({
        autoUpgrade: false,
        selfReport: { capture: false, surface: false, file: false },
      }),
    );
    const inputs = this.inputs ?? createCanonicalCatalogueInputs(this.root);
    this.canonical = {
      ...inputs,
      sourcePackage: inputs.sourcePackage ?? createPropagationSource(this.root, inputs),
    };
    this.probe = await createNativeCatalogueProbe(this.root, undefined, 'explain', this.canonical);
    await generatePropagationPackage(this.canonical, this.extension, 'cursor');
    writeFileSync(
      nodePath.join(this.workspace, '.cursor/cli.json'),
      JSON.stringify({
        permissions: {
          allow: [
            'Shell(bun)',
            'Shell(cd)',
            'Shell(export)',
            'Read(**)',
            `Read(${this.probe.packageRoot}/**)`,
          ],
          deny: [],
        },
      }),
    );
    // A valid supplied helper is a Given prerequisite, never a replacement When.
    await command(
      'bun',
      [
        nodePath.join(this.probe.packageRoot, 'runtime/cli.js'),
        'project',
        'runtime',
        'audit-principle-trace',
        this.workspace,
      ],
      {
        cwd: this.workspace,
        env: this.environment(),
      },
    );
    const artifact = nodePath.join(this.workspace, '.host-contract/native-helper.json');
    assert.equal(JSON.parse(readFileSync(artifact, 'utf8')).marker, this.probe.helperMarker);
    rmSync(artifact);
    assert.equal(existsSync(nodePath.join(this.workspace, '.cursor/hooks.json')), false);
    writeFileSync(
      nodePath.join(this.root, 'fixture.json'),
      JSON.stringify({
        host,
        version,
        runtime,
        workspace: this.workspace,
        extension: this.extension,
        core: this.probe.packageRoot,
      }),
    );
    for (const relative of [
      'runtime/cli.js',
      'skills/explain/SKILL.md',
      'skills/explain/references/HOST_CONTRACT_GUIDE.md',
      'templates/hooks/audit-principle-trace.ts',
    ]) {
      const file = nodePath.join(this.probe.packageRoot, relative);
      this.expectedResources.set(file, resourceDigest(file));
    }
  }

  observedInstallation(): string {
    assert.ok(this.probe);
    return JSON.stringify([this.extension, this.workspace, this.probe.packageRoot]);
  }

  propagationPaths() {
    assert.ok(this.probe);
    return installedPropagationPaths(this.probe.packageRoot, 'portable', this.extension);
  }

  close(): void {
    rmSync(this.root, { recursive: true, force: true });
  }

  confirmCanonicalProbe(): void {
    assert.ok(this.probe);
    assert.ok(
      readFileSync(
        nodePath.join(this.probe.packageRoot, 'skills/explain/SKILL.md'),
        'utf8',
      ).includes(this.probe.workflowMarker),
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
    const args = [
      '--workspace',
      this.workspace,
      '--plugin-dir',
      this.probe.packageRoot,
      '--plugin-dir',
      this.extension,
      '--trust',
      '--print',
      '--output-format',
      'stream-json',
    ];
    if (process.env.SAFEWORD_CURSOR_CLI_MODEL)
      args.push('--model', process.env.SAFEWORD_CURSOR_CLI_MODEL);
    args.push(
      'Use the installed explain skill for the Safeword contract catalogue probe. Follow its packaged guide and helper instructions. Run its declared helper exactly once in a single Shell call. Copy the complete helper command unchanged. Do not add commands before or after it, wrap it, or retry it, even if it fails. Report the actual result and required markers. Do no other work.',
    );
    this.stdout = await command(this.executable, args, {
      cwd: this.workspace,
      env: this.environment(),
      timeout: 240_000,
    });
    writeFileSync(nodePath.join(this.root, 'stdout.jsonl'), this.stdout);
    console.log(`Cursor CLI catalogue evidence: ${this.root}`);
    requireNativeHelperExecution(this.stdout);
    for (const [file, digest] of this.expectedResources) {
      assert.ok(
        existsSync(file),
        'CURSOR_CLI_UNAVAILABLE: agent removed an installed probe resource',
      );
      assert.equal(
        resourceDigest(file),
        digest,
        'CURSOR_CLI_UNAVAILABLE: agent changed installed probe content',
      );
    }
  }

  /** Native pre-action decision and matching Shell result; no CLI Stop/continuation claim. */
  async observeVerification(evidence: string, validSetupEvidence: string) {
    assert.ok(this.probe);
    const fixture = await preparePropagationReadiness(
      this.workspace,
      this.probe.packageRoot,
      evidence,
      validSetupEvidence,
      this.root,
    );
    const permissions = nodePath.join(this.workspace, '.cursor/cli.json');
    const config = JSON.parse(readFileSync(permissions, 'utf8'));
    const executable = shellQuote(nodePath.join(this.workspace, '.host-contract/gh'));
    assert.equal(fixture.command, `${executable} pr create`);
    const allow = `Shell(${executable})`;
    if (!config.permissions.allow.includes(allow)) config.permissions.allow.push(allow);
    writeFileSync(permissions, JSON.stringify(config));
    rmSync(fixture.effect, { force: true });
    const offset = existsSync(this.observerLog) ? this.shellObservations().length : 0;
    const turn = await this.readinessTurn(fixture.command);
    const observations = this.shellObservations().slice(offset);
    assert.ok(
      observations.length,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native Cursor CLI readiness hook missing',
    );
    assert.equal(
      observations.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: Cursor readiness dispatch ambiguous',
    );
    const row = observations[0];
    assert.ok(row);
    assert.equal(row.args[0], nodePath.join(this.extension, 'runtime/dispatch.js'));
    assert.equal(row.args.at(-1), 'beforeShellExecution:0');
    assert.equal(row.status, 0, row.stderr);
    assert.equal(row.input.conversation_id, turn.session);
    assert.deepEqual(row.input.workspace_roots, [this.workspace]);
    assert.equal(row.input.hook_event_name, 'beforeShellExecution');
    assert.equal(row.input.command, fixture.command, 'CURSOR_NATIVE_COMMAND_MISMATCH');
    const attempts = observedNativeShellResults(turn.raw);
    assert.equal(
      attempts.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: Cursor readiness Shell attempt ambiguous',
    );
    const shell = attempts[0];
    assert.ok(shell);
    assert.equal(shell.args.command, fixture.command);
    const decision = JSON.parse(row.stdout);
    assert.ok(['allow', 'deny'].includes(decision.permission));
    const effect = existsSync(fixture.effect) ? readFileSync(fixture.effect, 'utf8') : undefined;
    const observation = {
      installation: this.observedInstallation(),
      decision,
      effect,
      expectedEffect: fixture.marker,
      raw: JSON.stringify({ observations, events: turn.raw }),
    };
    assert.ok(
      shell.result?.success || shell.result?.rejected,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: completed Cursor Shell result missing',
    );
    if (shell.result.rejected) {
      assert.equal(
        decision.permission,
        'deny',
        'HOST_CONTRACT_PROOF_UNAVAILABLE: vendor permission refused an allowed action',
      );
      assert.ok(
        shell.result.rejected.reason?.includes(decision.user_message),
        'CURSOR_NATIVE_DENIAL_NOT_OBSERVED',
      );
    }
    try {
      assertReadinessEffect(decision, shell, effect, fixture.marker);
    } catch (error) {
      throw new ObservedPropagationMismatch(observation, error);
    }
    return observation;
  }

  /** Actual CLI Write callback and completed tool/turn; deliberately no Stop requirement. */
  async observeDesignApproval(options: PropagationArchitectureCase['options']) {
    assert.ok(this.probe);
    const prepared = preparePropagationDesignApproval(this.workspace, options.designApprovalGate);
    const path = nodePath.join(this.workspace, '.safeword/config.json');
    const previous = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...previous, ...options }));
    const bytes = readFileSync(path, 'utf8');
    const permissions = nodePath.join(this.workspace, '.cursor/cli.json');
    const config = JSON.parse(readFileSync(permissions, 'utf8'));
    const allow = `Write(${nodePath.relative(this.workspace, prepared.file)})`;
    if (!config.permissions.allow.includes(allow)) config.permissions.allow.push(allow);
    writeFileSync(permissions, JSON.stringify(config));
    const offset = existsSync(this.observerLog) ? this.shellObservations('preToolUse').length : 0;
    const turn = await this.nativeTurn(
      [
        'Authorized isolated phase-transition test. Use Write exactly once with the following exact file and complete content.',
        'If your startup instructions require it, first read the workspace Safeword handbook. Let the installed hooks decide. Do not retry, use Shell, use any other tool, or change any other file. Report the actual result and stop.',
        `DESIGN_WRITE_INPUT=${JSON.stringify({ file: prepared.file, content: prepared.after })}`,
      ].join(' '),
    );
    const observations = this.shellObservations('preToolUse').slice(offset);
    const raw = JSON.stringify({ observations, events: turn.raw });
    const rawPath = nodePath.join(this.root, `design-${this.readinessTurns}.json`);
    writeFileSync(rawPath, raw); // Durable native records before provenance validation or grading.
    assert.equal(
      observations.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: CLI Write callback cardinality',
    );
    const row = observations[0];
    assert.ok(row);
    assert.deepEqual(row.args, [
      nodePath.join(this.extension, 'runtime/dispatch.js'),
      'preToolUse:0',
    ]);
    assert.equal(row.status, 0, row.stderr);
    assert.equal(row.input.hook_event_name, 'preToolUse');
    assert.equal(row.input.tool_name, 'Write');
    assert.equal(row.input.conversation_id, turn.session);
    assert.deepEqual(row.input.workspace_roots, [this.workspace]);
    const file = extractFilePath(row.input.tool_input);
    assert.ok(file);
    assert.equal(nodePath.resolve(this.workspace, file), prepared.file);
    assert.equal(extractWriteContent(row.input.tool_input), prepared.after);
    const write = observedNativeWrite(
      turn.raw,
      this.workspace,
      prepared.file,
      prepared.after,
      turn.session,
    );
    const decision = JSON.parse(row.stdout) as {
      permission?: string;
      user_message?: string;
      agent_message?: string;
    };
    assert.ok(
      ['allow', 'deny'].includes(decision.permission ?? ''),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: CLI Write decision missing',
    );
    return {
      installation: this.observedInstallation(),
      raw,
      rawPath,
      decision,
      write,
      origin: row.args[0],
      configuration: { path, bytes, after: readFileSync(path, 'utf8') },
      before: prepared.before,
      expectedEffect: prepared.after,
      effect: readFileSync(prepared.file, 'utf8'),
    };
  }

  async refreshResources(inputs: CanonicalCatalogueInputs): Promise<void> {
    assert.ok(this.probe);
    assert.ok(this.canonical?.sourcePackage);
    this.canonical = { ...inputs, sourcePackage: this.canonical.sourcePackage };
    this.probe = await refreshNativeCatalogueProbe(this.probe, this.canonical);
    const stage = mkdtempSync(nodePath.join(this.root, 'extension-refresh-'));
    const candidate = nodePath.join(stage, 'candidate');
    try {
      await generatePropagationPackage(this.canonical, candidate, 'cursor');
      reconcileGeneratedTree(candidate, this.extension);
    } finally {
      rmSync(stage, { recursive: true, force: true });
    }
    for (const file of this.expectedResources.keys())
      this.expectedResources.set(file, resourceDigest(file));
    rmSync(nodePath.join(this.workspace, '.host-contract/native-helper.json'), { force: true });
  }

  observedResources() {
    this.assertPackagedResult();
    return {
      delivery: 'native',
      installation: this.observedInstallation(),
      raw: this.stdout,
      markers: observedCatalogueMarkers(this.stdout),
    };
  }

  assertPackagedResult(): void {
    assert.ok(this.probe);
    const probe = this.probe;
    assert.ok(
      this.stdout.includes(this.probe.workflowMarker),
      'NATIVE_CATALOGUE_MISSING: workflow marker absent',
    );
    assert.ok(
      this.stdout.includes(this.probe.guideMarker),
      'NATIVE_CATALOGUE_MISSING: packaged guide marker absent',
    );
    const shells = requireNativeHelperExecution(this.stdout);
    const runtime = realpathSync(nodePath.join(probe.packageRoot, 'runtime/cli.js'));
    assert.ok(
      shells.some(shell => {
        const program = observedHelperProgram(shell.args.command);
        return (
          program &&
          existsSync(program) &&
          realpathSync(program) === runtime &&
          shell.result?.success?.exitCode === 0 &&
          shell.result.success.stdout?.includes(probe.helperMarker)
        );
      }),
      'NATIVE_HELPER_ORIGIN_MISMATCH: exact packaged helper command and marker must share an actual Shell result',
    );
    const artifact = nodePath.join(this.workspace, '.host-contract/native-helper.json');
    assert.ok(existsSync(artifact), 'NATIVE_HELPER_ORIGIN_MISMATCH: helper artifact absent');
    const record = JSON.parse(readFileSync(artifact, 'utf8')) as {
      marker: string;
      origin: string;
      runtime?: string;
    };
    assert.equal(
      record.marker,
      this.probe.helperMarker,
      'NATIVE_HELPER_ORIGIN_MISMATCH: helper marker changed',
    );
    assert.ok(
      record.runtime && existsSync(record.runtime),
      'NATIVE_HELPER_ORIGIN_MISMATCH: helper was not dispatched by the package runtime',
    );
    assert.equal(
      realpathSync(record.runtime),
      realpathSync(nodePath.join(probe.packageRoot, 'runtime/cli.js')),
      'NATIVE_HELPER_ORIGIN_MISMATCH: helper reentry runtime changed',
    );
    assert.ok(
      record.origin && existsSync(record.origin),
      'NATIVE_HELPER_ORIGIN_MISMATCH: helper origin missing',
    );
    assert.equal(
      realpathSync(record.origin),
      realpathSync(
        nodePath.join(this.probe.packageRoot, 'templates/hooks/audit-principle-trace.ts'),
      ),
      'NATIVE_HELPER_ORIGIN_MISMATCH: helper came from another package',
    );
  }
}
