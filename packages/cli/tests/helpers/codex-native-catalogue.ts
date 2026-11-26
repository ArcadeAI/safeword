import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { reconcileGeneratedTree } from '../../scripts/generated-tree-differences.js';
import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import { parseShellWords } from '../../templates/hooks/lib/shell-segments.js';
import { nativeWorkflowEnvironment, requireCodexNativeTrust } from './codex-internal-workflows.js';
import {
  assertCodexGuardFixture,
  type CodexGuardFixture,
  type CodexHandoffCase,
  CodexNativeContinuationActor,
  type CodexVerificationCase,
} from './codex-native-continuation.js';
import { CodexNativeWriteActor } from './codex-native-write.js';
import { assertMatchingTree } from './codex-plugin-package.js';
import type { ReviewedCodexPropagation } from './headless-codex-propagation.js';
import { observeExactHostVersion } from './host-contract-version.js';
import {
  type CanonicalCatalogueInputs,
  createCanonicalCatalogueInputs,
  createNativeCatalogueProbe,
  type NativeCatalogueProbe,
  observedCatalogueMarkers,
  refreshNativeCatalogueProbe,
} from './native-catalogue-probe.js';
import { catalogueHelperRuntime, observedHelperProgram } from './native-helper-command.js';
import type { PropagationArchitectureCase } from './propagation-policy-case.js';
import { createPropagationSource, installedPropagationPaths } from './propagation-source.js';

const execute = promisify(execFile);

export interface PreparedCodexCatalogue {
  fixture: CodexGuardFixture;
  inputs: CanonicalCatalogueInputs;
  expectedPackageRoot: string;
}

export function readPreparedCodexCatalogue(file?: string): PreparedCodexCatalogue {
  assert.ok(file, 'HOST_CONTRACT_PROOF_UNAVAILABLE: prepared catalogue descriptor required');
  const descriptor = JSON.parse(readFileSync(file, 'utf8')) as PreparedCodexCatalogue;
  assertCodexGuardFixture(descriptor.fixture);
  for (const value of [
    descriptor.inputs.canonicalRoot,
    descriptor.inputs.sourcePackage,
    descriptor.expectedPackageRoot,
  ]) {
    assert.ok(
      value && nodePath.isAbsolute(value),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: prepared catalogue path required',
    );
    realpathSync(value);
  }
  for (const field of ['workflowMarker', 'guideMarker', 'helperMarker'] as const)
    assert.ok(
      typeof descriptor.inputs[field] === 'string' && descriptor.inputs[field].length > 0,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: prepared catalogue marker required',
    );
  assert.notEqual(
    realpathSync(descriptor.expectedPackageRoot),
    descriptor.fixture.installedPath,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: prepared catalogue snapshot must be separate',
  );
  return descriptor;
}

/** Same canonical catalogue probe as Cursor, installed by the real Codex CLI. */
export class CodexNativeCatalogueActor {
  private readonly root: string;
  private readonly profile: string;
  private readonly project: string;
  private probe?: NativeCatalogueProbe;
  private installed = '';
  private events = '';
  private completion?: CodexNativeContinuationActor;
  private handoffCompletion?: CodexNativeContinuationActor;
  private canonical?: CanonicalCatalogueInputs;
  private readonly staged?: ReviewedCodexPropagation;
  private readonly trustDeadline?: number;

  constructor(
    private readonly fixture: CodexGuardFixture,
    private readonly inputs?: CanonicalCatalogueInputs,
    private readonly binding: 'fresh' | 'provisioned' = 'fresh',
    private readonly expectedPackageRoot?: string,
    readiness?: number | ReviewedCodexPropagation,
  ) {
    if (typeof readiness === 'number') this.trustDeadline = readiness;
    else this.staged = readiness;
    if (binding === 'provisioned' || this.staged) {
      assertCodexGuardFixture(fixture);
      const authorHome = process.env.CODEX_HOME ?? nodePath.join(process.env.HOME ?? '', '.codex');
      assert.notEqual(
        fixture.profile,
        existsSync(authorHome) ? realpathSync(authorHome) : nodePath.resolve(authorHome),
        'CODEX_AUTHOR_PROFILE_REFUSED',
      );
    }
    this.root =
      binding === 'provisioned'
        ? fixture.root
        : mkdtempSync(nodePath.join(fixture.root, 'codex-guard-'));
    this.profile = nodePath.join(this.root, 'profile');
    this.project = nodePath.join(this.root, 'project');
  }

  private environment(): NodeJS.ProcessEnv {
    return nativeWorkflowEnvironment(this.profile);
  }

  private async command(args: string[]): Promise<string> {
    const pending = execute(
      this.fixture.binary,
      [
        ...(args[0] === 'exec' && this.staged ? await this.stagedModelArguments() : []),
        '--enable',
        'hooks',
        '--enable',
        'plugins',
        ...args,
      ],
      {
        cwd: this.project,
        env: this.environment(),
        encoding: 'utf8',
        timeout: 180_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    pending.child.stdin?.end();
    const result = await pending;
    return result.stdout;
  }

  private async stagedModelArguments(): Promise<string[]> {
    assert.ok(this.staged && this.canonical && this.probe);
    return this.staged.modelArguments(
      this.canonical,
      this.probe.packageRoot,
      this.preparedFixture(),
    );
  }

  private stageProbe(inputs: CanonicalCatalogueInputs, packageRoot: string): NativeCatalogueProbe {
    assert.ok(this.staged);
    const approved = this.staged.select(inputs);
    mkdirSync(packageRoot, { recursive: true });
    reconcileGeneratedTree(approved.packageRoot, packageRoot);
    return { ...inputs, packageRoot };
  }

  private async requireNativeTrust(): Promise<void> {
    if (this.staged) return;
    this.assertPreparedPackage();
    assert.ok(this.probe);
    await requireCodexNativeTrust(
      this.preparedFixture(),
      this.probe.packageRoot,
      this.trustDeadline,
    );
    this.assertPreparedPackage();
  }

  private assertPreparedPackage(actual = this.installed): void {
    if (!this.expectedPackageRoot) return;
    try {
      assertMatchingTree(this.expectedPackageRoot, actual);
    } catch (error) {
      throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: prepared catalogue package changed', {
        cause: error,
      });
    }
  }

  close(): void {
    this.handoffCompletion?.close();
    if (this.staged) rmSync(nodePath.join(this.profile, 'auth.json'), { force: true });
  }

  async prepare(host: string, version: string, runtime: string): Promise<void> {
    assert.equal(host, 'Codex');
    assert.equal(runtime, 'CLI');
    assert.equal(version, hostReleases.codex.version);
    if (this.binding === 'fresh') {
      mkdirSync(this.profile);
      mkdirSync(this.project);
      await execute('git', ['init', '--quiet'], { cwd: this.project });
      // Root supplies only this explicitly provisioned disposable profile auth.
      // Native trust is never copied or inferred from the parent profile.
      copyFileSync(
        nodePath.join(this.fixture.profile, 'auth.json'),
        nodePath.join(this.profile, 'auth.json'),
      );
      await execute('/bin/chmod', ['600', nodePath.join(this.profile, 'auth.json')]);
    }
    assert.equal(
      observeExactHostVersion(version, await this.command(['--version'])).state,
      'verified',
    );
    const inputs = this.inputs ?? createCanonicalCatalogueInputs(this.root);
    this.canonical = this.staged
      ? inputs
      : {
          ...inputs,
          sourcePackage: inputs.sourcePackage ?? createPropagationSource(this.root, inputs),
        };
    const probeDirectory =
      this.binding === 'provisioned'
        ? mkdtempSync(nodePath.join(this.root, 'catalogue-source-'))
        : this.root;
    this.probe = this.staged
      ? this.stageProbe(this.canonical, nodePath.join(this.root, 'candidate'))
      : await createNativeCatalogueProbe(
          probeDirectory,
          undefined,
          'explain',
          this.canonical,
          'codex-native',
        );
    this.assertPreparedPackage(this.probe.packageRoot);
    const registry = nodePath.join(this.root, '.agents/plugins');
    mkdirSync(registry, { recursive: true });
    writeFileSync(
      nodePath.join(registry, 'marketplace.json'),
      JSON.stringify({
        name: 'safeword-contract-test',
        owner: { name: 'Safeword isolated fixture' },
        plugins: [
          {
            name: 'safeword',
            source: {
              source: 'local',
              path: `./${nodePath.relative(this.root, this.probe.packageRoot)}`,
            },
            category: 'Developer Tools',
            policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
          },
        ],
      }),
    );
    await this.command(['plugin', 'marketplace', 'add', this.root]);
    const installation = JSON.parse(
      await this.command(['plugin', 'add', 'safeword@safeword-contract-test', '--json']),
    ) as { installedPath: string };
    this.installed = realpathSync(installation.installedPath);
    if (this.binding === 'provisioned')
      assert.equal(this.installed, this.fixture.installedPath, 'PROPAGATION_INSTALLATION_REPLACED');
    assert.ok(this.installed.startsWith(`${realpathSync(this.profile)}/plugins/cache/`));
    assertMatchingTree(this.probe.packageRoot, this.installed);
    mkdirSync(nodePath.join(this.project, '.host-contract'), { recursive: true });
    mkdirSync(nodePath.join(this.project, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(this.project, '.safeword/SAFEWORD.md'),
      'Synthetic catalogue probe project.\n',
    );
    writeFileSync(
      nodePath.join(this.project, '.safeword/config.json'),
      JSON.stringify({
        autoUpgrade: false,
        selfReport: { capture: false, surface: false, file: false },
      }),
    );
    // A working helper is a prerequisite, not a replacement native invocation.
    await execute(
      'bun',
      [
        nodePath.join(this.installed, 'runtime/cli.js'),
        'project',
        'runtime',
        'audit-principle-trace',
        this.project,
      ],
      { cwd: this.project, env: this.environment() },
    );
    const artifact = nodePath.join(this.project, '.host-contract/native-helper.json');
    assert.equal(JSON.parse(readFileSync(artifact, 'utf8')).marker, this.probe.helperMarker);
    rmSync(artifact);
    this.assertPreparedPackage();
    console.log(`Codex native catalogue evidence: ${this.root}`);
  }

  /** Exact prepared paths for root's normal native trust UI; never a trust grant. */
  preparedFixture(): CodexGuardFixture {
    assert.ok(this.installed);
    return {
      root: this.root,
      profile: this.profile,
      project: this.project,
      binary: this.fixture.binary,
      installedPath: this.installed,
    };
  }

  confirmCanonicalProbe(): void {
    assert.ok(this.probe);
    assert.ok(
      readFileSync(nodePath.join(this.installed, 'skills/explain/SKILL.md'), 'utf8').includes(
        this.probe.workflowMarker,
      ),
    );
    assert.equal(
      existsSync(nodePath.join(this.project, '.host-contract/native-helper.json')),
      false,
    );
  }

  async invokeWorkflow(): Promise<void> {
    rmSync(nodePath.join(this.project, '.host-contract/native-helper.json'), { force: true });
    this.confirmCanonicalProbe();
    await this.requireNativeTrust();
    this.events = await this.command([
      'exec',
      '--json',
      '--ephemeral',
      '--skip-git-repo-check',
      '-s',
      'workspace-write',
      '-c',
      'approval_policy="never"',
      '-m',
      'gpt-5.6-terra',
      '$safeword:explain Use only this installed workflow. Follow its packaged guide and helper instructions and report the requested markers. First read the packaged guide in a separate tool call and wait for its result. Then make a new shell call containing only the two variable assignments and the unchanged helper command. Assign SAFEWORD_PLUGIN_RUNTIME to the resolved literal absolute path and PROJECT_DIR="$PWD". Do not include a guide read, any other command, or a command substitution in the helper call. Do no other work.',
    ]);
    writeFileSync(nodePath.join(this.root, 'host-events.jsonl'), this.events);
  }

  async refreshResources(inputs: CanonicalCatalogueInputs): Promise<void> {
    assert.ok(this.probe);
    if (this.staged) {
      if (inputs.canonicalRoot === this.canonical?.canonicalRoot) return;
      this.probe = this.stageProbe(inputs, this.probe.packageRoot);
      this.canonical = inputs;
    } else {
      assert.ok(this.canonical?.sourcePackage);
      this.canonical = { ...inputs, sourcePackage: this.canonical.sourcePackage };
      this.probe = await refreshNativeCatalogueProbe(
        this.probe,
        this.canonical,
        undefined,
        'codex-native',
      );
    }
    const installed = JSON.parse(
      await this.command(['plugin', 'add', 'safeword@safeword-contract-test', '--json']),
    ) as { installedPath: string };
    assert.equal(
      realpathSync(installed.installedPath),
      this.installed,
      'PROPAGATION_INSTALLATION_REPLACED',
    );
    assertMatchingTree(this.probe.packageRoot, this.installed);
    await this.requireNativeTrust();
    rmSync(nodePath.join(this.project, '.host-contract/native-helper.json'), { force: true });
  }

  async observeVerification(evidence: string, setting?: CodexVerificationCase) {
    assert.ok(this.probe);
    await this.requireNativeTrust();
    if (!this.completion) {
      this.completion = new CodexNativeContinuationActor(
        {
          ...this.fixture,
          root: this.root,
          profile: this.profile,
          project: this.project,
          installedPath: this.installed,
        },
        this.probe.packageRoot,
        this.staged && (() => this.stagedModelArguments()),
      );
      await this.completion.prepareContinuation('Codex', hostReleases.codex.version);
    }
    return this.completion.observeVerification(evidence, setting, this.probe.helperMarker);
  }

  async observeContinuation() {
    assert.ok(this.completion, 'HOST_CONTRACT_PROOF_UNAVAILABLE: retained Codex thread missing');
    await this.requireNativeTrust();
    return this.completion.observeRetainedContinuation();
  }

  assertContinuation() {
    assert.ok(this.completion, 'HOST_CONTRACT_PROOF_UNAVAILABLE: retained Codex thread missing');
    this.completion.assertContinuation();
  }

  async observeDesignApproval(options: PropagationArchitectureCase['options']) {
    assert.ok(this.probe);
    await this.requireNativeTrust();
    return new CodexNativeWriteActor(
      this.preparedFixture(),
      this.staged && (() => this.stagedModelArguments()),
    ).observeDesignApproval(options, this.probe.packageRoot);
  }

  /** Configured terminal correction is separate from the task/done transition. */
  async observeHandoff(options: Required<CodexHandoffCase>) {
    assert.ok(this.probe);
    if (this.staged && !this.handoffCompletion) {
      this.handoffCompletion = new CodexNativeContinuationActor(
        this.preparedFixture(),
        this.probe.packageRoot,
        () => this.stagedModelArguments(),
        'scripted-handoff',
      );
      await this.handoffCompletion.prepareContinuation('Codex', hostReleases.codex.version);
    }
    const actual = this.handoffCompletion
      ? await this.handoffCompletion.observeVerification('', options, this.probe.helperMarker)
      : await this.observeVerification('', options);
    assert.ok(actual.configuration);
    return {
      installation: actual.installation,
      decisions: actual.decisions,
      configuration: actual.configuration,
      helper: actual.helper,
      raw: actual.raw,
    };
  }

  observedResources() {
    this.assertPackagedResult();
    return {
      delivery: 'native',
      installation: JSON.stringify([this.installed, this.project]),
      raw: this.events,
      markers: observedCatalogueMarkers(this.events),
    };
  }

  propagationPaths() {
    return installedPropagationPaths(this.installed, 'portable');
  }

  assertPackagedResult(): void {
    assert.ok(this.probe);
    const probe = this.probe;
    const skillFile = nodePath.join(this.installed, 'skills/explain/SKILL.md');
    const declaredRuntime = catalogueHelperRuntime(
      readFileSync(skillFile, 'utf8'),
      skillFile,
      nodePath.join(this.installed, 'runtime/cli.js'),
    );
    const rows = this.events
      .trim()
      .split('\n')
      .map(
        line =>
          JSON.parse(line) as {
            type: string;
            item?: {
              type: string;
              command?: string;
              aggregated_output?: string;
              exit_code?: number;
            };
          },
      );
    assert.equal(rows.at(-1)?.type, 'turn.completed');
    assert.ok(
      this.events.includes(this.probe.workflowMarker),
      'NATIVE_CATALOGUE_MISSING: workflow marker absent',
    );
    assert.ok(
      this.events.includes(this.probe.guideMarker),
      'NATIVE_CATALOGUE_MISSING: guide marker absent',
    );
    const executions = rows.filter(
      row =>
        row.type === 'item.completed' &&
        row.item?.type === 'command_execution' &&
        row.item.exit_code === 0 &&
        row.item.aggregated_output?.includes(probe.helperMarker),
    );
    const programs = executions
      .map(row => observedHelperProgram(parseShellWords(row.item?.command ?? '').at(-1) ?? ''))
      .filter(program => program !== undefined);
    assert.ok(
      programs.length,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: no unambiguous native helper command',
    );
    assert.ok(
      programs.includes(declaredRuntime),
      'NATIVE_HELPER_ORIGIN_MISMATCH: helper ignored the workflow binding',
    );
    const record = JSON.parse(
      readFileSync(nodePath.join(this.project, '.host-contract/native-helper.json'), 'utf8'),
    ) as { marker: string; origin: string; runtime: string };
    assert.equal(record.marker, this.probe.helperMarker);
    assert.equal(realpathSync(record.runtime), nodePath.join(this.installed, 'runtime/cli.js'));
    assert.equal(
      realpathSync(record.origin),
      nodePath.join(this.installed, 'templates/hooks/audit-principle-trace.ts'),
    );
    assertMatchingTree(this.probe.packageRoot, this.installed);
  }
}
