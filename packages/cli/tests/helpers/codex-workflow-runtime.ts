import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { validatedResourceRevision } from '../../src/codex-plugin/resource-revision.js';
import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import {
  codexInternalCases,
  codexStaticResourceKind,
} from '../fixtures/host-contract/native-contract-cases.js';
import {
  bundleInventory,
  CodexInternalWorkflowActor,
  type HookObservation,
  nativeWorkflowEnvironment,
} from './codex-internal-workflows.js';
import { isolatedBuildIdentity } from './codex-isolated-build.js';
import { provisionIsolatedGrade } from './codex-isolated-project.js';
import type { CodexGuardFixture } from './codex-native-continuation.js';
import { assertMatchingTree } from './codex-plugin-package.js';
import { reviewJobs } from './codex-review-authentication.js';
import { checkedPreparationLanguage, preparationLanguageProbe } from './codex-review-receipt.js';
import {
  proveWiringFixture,
  seedWiringReview,
  type WiringArm,
  wiringReviewBytes,
} from './codex-review-wiring.js';
import {
  preparedWorkflowPair,
  requireWorkflowBindings,
  reviewedWorkflowPair,
  workflowHookInventory,
  workflowInputDelta,
  type WorkflowPair,
  type WorkflowReview,
  workflowReviewCollaborators,
  workflowReviewTargets,
  type WorkflowSelection,
} from './codex-reviewed-workflow.js';
import { requireWiringCalibration } from './codex-wiring-calibration.js';
import { type NativeWiringCandidate, pairedWiringClaim } from './codex-wiring-claim.js';
import { dispatchWiringClaim } from './codex-wiring-dispatch.js';
import {
  captureNodeBaseline,
  discriminateNodeTests,
  essentialOwner,
  markEssentialCore,
  RESTART_SEED_TEST_NAME,
} from './codex-workflow-essential.js';
import { initializeWorkflowGit, workflowGitReadiness } from './codex-workflow-git.js';
import {
  assertNodeTests,
  automaticCatalogue,
  handoffTarget,
  installedIndex,
  messageText,
  type NativeTurn,
  nativeTurn,
  resourceLoad,
  startupEssential,
  startupPopulation,
} from './codex-workflow-observation.js';
import { createContractRepoFixture } from './contract-repo-fixture.js';

const repo = nodePath.resolve(import.meta.dirname, '../../../..');
const ordinary =
  'Please write focused tests for the existing clamp function using the built-in Node test runner, run them, and report the results.';
const requestedModel = 'gpt-5.6-terra';
const digest = (file: string): string =>
  createHash('sha256').update(readFileSync(file)).digest('hex');
const canonicalResources = {
  testing: 'skills/testing/SKILL.md',
  guide: 'guides/testing-guide.md',
  explain: 'skills/explain/SKILL.md',
  review: 'skills/quality-review/SKILL.md',
} as const;
type Markers = Record<keyof typeof canonicalResources, string>;

/** Generate and check from the same source CWD: Bun emits caller-relative module comments. */
export function runWorkflowGenerator(source: string, profile: string, checkOnly: boolean) {
  const result = spawnSync(
    nodePath.join(repo, 'scripts/dev'),
    [
      'bun',
      '--no-env-file',
      'packages/cli/scripts/generate-codex-plugin.ts',
      ...(checkOnly ? ['--check'] : []),
    ],
    { cwd: source, encoding: 'utf8', timeout: 90_000, env: nativeWorkflowEnvironment(profile) },
  );
  assert.equal(result.error, undefined, 'HOST_CONTRACT_PROOF_UNAVAILABLE: generator process');
  assert.equal(
    result.signal ?? undefined,
    undefined,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: generator signaled',
  );
  return { output: `${result.stdout}\n${result.stderr}`, status: result.status };
}

interface WorkflowRevision {
  source: string;
  markers: Markers;
  essential: { marker: string; block: string; ownerSha256: string };
}

/** Freeze generated inputs, outputs, and exact review scopes without starting the host. */
export function stageWorkflowPair<T extends object>(
  fixture: CodexGuardFixture,
  artifacts: string,
  ownership: WorkflowSelection | undefined,
  prepare: (label: 'A' | 'B') => { source: string; revision: T },
  generationProfile: string,
) {
  const project = nodePath.join(artifacts, 'staged');
  mkdirSync(project);
  const stages = (['A', 'B'] as const).map(label => {
    const { source: inputSource, revision } = prepare(label);
    const source = nodePath.join(project, label);
    cpSync(inputSource, source, {
      recursive: true,
      filter: file =>
        !['node_modules', '.git', '.project', 'dist'].includes(nodePath.basename(file)),
    });
    for (const relative of [
      ...workflowReviewTargets(ownership),
      ...workflowReviewCollaborators.map(file => `packages/cli/${file}`),
    ]) {
      const target = nodePath.join(source, relative);
      mkdirSync(nodePath.dirname(target), { recursive: true });
      cpSync(nodePath.join(repo, relative), target);
    }
    for (const relative of ['node_modules', 'packages/cli/node_modules'])
      symlinkSync(nodePath.join(repo, relative), nodePath.join(source, relative), 'dir');
    const generated = runWorkflowGenerator(source, generationProfile, false);
    writeFileSync(
      nodePath.join(artifacts, `staged-${label}-generation.json`),
      `${JSON.stringify(generated, undefined, 2)}\n`,
    );
    assert.equal(generated.status, 0, generated.output);
    const packageRoot = nodePath.join(source, 'packages/cli/codex-plugin');
    const inventory = nodePath.join(project, `${label}-package-inventory.json`);
    writeFileSync(inventory, JSON.stringify(bundleInventory(packageRoot), undefined, 2));
    const inputs = nodePath.join(project, `${label}-generation-inputs.json`);
    const roots = ['packages/cli/src', 'packages/cli/templates', 'packages/cli/scripts', 'scripts'];
    const inputEntries = roots.map(relative => [
      relative,
      bundleInventory(nodePath.join(source, relative)),
    ]);
    const inputInventory = Object.fromEntries(inputEntries);
    const metadata = Object.fromEntries(
      [
        'package.json',
        'bun.lock',
        'mise.toml',
        'packages/cli/package.json',
        'packages/cli/codex-plugin/.codex-plugin/plugin.json',
      ].map(relative => [relative, digest(nodePath.join(source, relative))]),
    );
    writeFileSync(inputs, JSON.stringify({ roots: inputInventory, metadata }, undefined, 2));
    return { label, source, packageRoot, inventory, inputs, revision: { ...revision, source } };
  });
  const [a, b] = stages;
  assert.ok(a && b);
  const delta = nodePath.join(project, 'canonical-input-delta.json');
  const inputDelta = workflowInputDelta(stages, ownership);
  for (const [relative, file] of Object.entries(inputDelta.rawFiles)) {
    mkdirSync(nodePath.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(inputDelta.inputs[relative], undefined, 2));
  }
  writeFileSync(
    delta,
    JSON.stringify(
      { inputs: inputDelta.rawFiles, generatedInventories: inputDelta.generatedInventories },
      undefined,
      2,
    ),
  );
  const coordinator = nodePath.join(artifacts, 'coordinator/runtime/cli.js');
  cpSync(a.packageRoot, nodePath.dirname(nodePath.dirname(coordinator)), { recursive: true });
  const targets = workflowReviewTargets(ownership).map(relative =>
    nodePath.join(a.source, relative),
  );
  const descriptor = {
    provisioning: {
      root: realpathSync(fixture.root),
      profile: realpathSync(fixture.profile),
      project: realpathSync(fixture.project),
      installedPath: realpathSync(fixture.installedPath),
      binary: realpathSync(fixture.binary),
      binarySha256: digest(fixture.binary),
      originalConfigSha256: digest(nodePath.join(fixture.profile, 'config.toml')),
      originalPackage: bundleInventory(fixture.installedPath),
    },
    ownership,
    project,
    stages,
    coordinator,
    coordinatorSha256: digest(coordinator),
    targets,
    context: [
      ...stages.flatMap(stage => [stage.inventory, stage.inputs]),
      ...Object.values(inputDelta.rawFiles),
      delta,
    ],
    mode: 'unsigned-preparation-only',
    admissionEligible: false,
  };
  const manifest = nodePath.join(project, 'staged-inputs.json');
  descriptor.context.push(
    manifest,
    ...workflowReviewCollaborators.map(file => nodePath.join(a.source, 'packages/cli', file)),
  );
  writeFileSync(manifest, JSON.stringify(descriptor, undefined, 2));
  return descriptor;
}

/** ROOT-only preparation: required population is owned by the existing feature,
 * including each independent judgment arm. This never launches a native process.
 */
export function stageCodexWorkflowInputs(fixtureFile: string, identityFile: string) {
  return codexInternalCases().flatMap(row =>
    row.preservationArms.map(arm => {
      const actor = new CodexWorkflowRuntimeActor(fixtureFile, identityFile);
      return { artifacts: actor.artifacts, ...actor.stageRevisions({ caseId: row.id, arm }) };
    }),
  );
}

/** Actual installed-host driver. All procedure markers precede normal generation. */
export class CodexWorkflowRuntimeActor extends CodexInternalWorkflowActor {
  private source: string;
  private readonly originals = new Map<string, string>();
  private markers: Markers = { testing: '', guide: '', explain: '', review: '' };
  private turn?: NativeTurn;
  private previous?: NativeTurn;
  private restartRevision?: string;
  private restartBaseline?: ReturnType<typeof captureNodeBaseline>;
  private core = '';
  private coreMarker = '';
  private sequence = 0;
  private target = '';
  private shellCommand = '';
  private disposition = '';
  private checker?: { output: string; status: number | null };
  private resourceCompletion?: 'closure' | 'missing';
  private wiring?: { arm: WiringArm; bytes: Record<string, string>; jobs: string[] };
  private wiringGrade?: ReturnType<typeof provisionIsolatedGrade>;
  private stagingOnly = false;
  private readonly isolated?: WorkflowReview;
  private normalStages?: WorkflowSelection & { manifest: string; sha256: string };
  private pair?: WorkflowPair;
  private stageLabel: 'A' | 'B' = 'A';
  private originalHooks?: HookObservation[];
  private refreshedHooks?: HookObservation[];
  private readonly isolatedArguments: string[][] = [];
  private pickerInvoked = false;

  constructor(fixtureFile: string, identityFile: string, selection?: WorkflowSelection) {
    super(fixtureFile, identityFile);
    const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8')) as {
      mode?: string;
      isolatedBehavior?: WorkflowReview[];
      normalTrustQualification?: boolean;
      normalTrustStages?: string;
    };
    assert.ok(!fixture.mode || ['normal', 'isolated-behavior'].includes(fixture.mode));
    if (fixture.normalTrustQualification) {
      assert.notEqual(
        fixture.mode,
        'isolated-behavior',
        'HOST_CONTRACT_PROOF_UNAVAILABLE: trust qualification cannot bypass trust',
      );
      assert.equal(
        selection?.caseId,
        'a-restarted-session-receives-current-essential-workflow-instructions',
        'HOST_CONTRACT_PROOF_UNAVAILABLE: normal trust qualification requires restart case',
      );
    }
    this.bindNormalTrustStages(fixture, selection);
    if (fixture.mode === 'isolated-behavior') {
      assert.ok(selection, 'HOST_CONTRACT_PROOF_UNAVAILABLE: isolated case/arm missing');
      const matches = fixture.isolatedBehavior?.filter(
        row => row.caseId === selection.caseId && row.arm === selection.arm,
      );
      assert.equal(
        matches?.length,
        1,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: isolated pair missing/ambiguous',
      );
      this.isolated = matches?.[0];
      assert.ok(this.isolated);
      assert.ok(
        codexInternalCases().some(
          row => row.id === selection.caseId && row.preservationArms.includes(selection.arm),
        ),
      );
      this.pair = reviewedWorkflowPair(this.fixture, this.isolated, this.artifacts);
    }
    this.source = this.normalStages
      ? this.selectedStage().source
      : realpathSync(createContractRepoFixture());
  }

  private bindNormalTrustStages(
    fixture: { mode?: string; normalTrustQualification?: boolean; normalTrustStages?: string },
    selection?: WorkflowSelection,
  ): void {
    if (fixture.normalTrustStages === undefined) return;
    assert.ok(fixture.normalTrustQualification && fixture.mode === 'normal' && selection);
    const manifest = fixture.normalTrustStages;
    this.pair = preparedWorkflowPair(this.fixture, { ...selection, manifest });
    this.normalStages = { ...selection, manifest, sha256: digest(manifest) };
  }

  private selectedStage() {
    if (this.normalStages) {
      assert.equal(
        digest(this.normalStages.manifest),
        this.normalStages.sha256,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: normal trust staged manifest changed',
      );
      this.pair = preparedWorkflowPair(this.fixture, this.normalStages);
    }
    const stage = this.pair?.stages.find(row => row.label === this.stageLabel);
    assert.ok(stage, 'HOST_CONTRACT_PROOF_UNAVAILABLE: fixed stage missing');
    return stage;
  }

  private loadStage(): void {
    const stage = this.selectedStage();
    this.source = stage.source;
    this.markers = { ...stage.revision.markers };
    this.core = stage.revision.essential.block;
    this.coreMarker = stage.revision.essential.marker;
  }

  private isolatedReadiness(): HookObservation[] {
    assert.ok(this.isolated);
    this.pair = reviewedWorkflowPair(this.fixture, this.isolated, this.artifacts);
    const stage = this.selectedStage();
    assert.equal(realpathSync(this.profile), nodePath.join(this.artifacts, 'profile'));
    assert.equal(realpathSync(this.project), nodePath.join(this.artifacts, 'project'));
    const version = JSON.parse(
      readFileSync(nodePath.join(stage.packageRoot, 'package.json'), 'utf8'),
    ).version;
    assert.equal(
      realpathSync(this.installed),
      nodePath.join(this.profile, 'plugins/cache/safeword-contract-test/safeword', version),
    );
    assertMatchingTree(stage.packageRoot, nodePath.join(this.artifacts, 'marketplace/plugin'));
    assertMatchingTree(stage.packageRoot, this.installed);
    assert.equal(
      this.command(this.fixture.binary, ['--version'], 'isolated-version').trim(),
      `codex-cli ${hostReleases.codex.version}`,
    );
    const hooks = workflowHookInventory(
      {
        ...this.fixture,
        root: this.artifacts,
        profile: this.profile,
        project: this.project,
        installedPath: this.installed,
      },
      this.artifacts,
      `isolated-${this.stageLabel}`,
    );
    requireWorkflowBindings(hooks, this.installed);
    assertMatchingTree(stage.packageRoot, this.installed);
    return hooks;
  }

  private observedPickerArguments(): string[] {
    const file = nodePath.join(this.artifacts, 'picker-native-argv.json');
    assert.ok(existsSync(file), 'HOST_CONTRACT_PROOF_UNAVAILABLE: isolated picker argv missing');
    const args = JSON.parse(readFileSync(file, 'utf8')) as string[];
    assert.deepEqual(
      args,
      [
        this.fixture.binary,
        '--dangerously-bypass-hook-trust',
        '--enable',
        'hooks',
        '--enable',
        'plugins',
        '--no-alt-screen',
        '-s',
        'workspace-write',
        '-a',
        'never',
      ],
      'HOST_CONTRACT_PROOF_UNAVAILABLE: isolated picker argv differs',
    );
    return args;
  }

  private completedResource(caseId: string, argv: string[][]): boolean {
    const resourceOnly =
      argv.length === 0 &&
      this.resourceCompletion !== undefined &&
      codexStaticResourceKind(caseId) === this.resourceCompletion;
    if (resourceOnly) {
      if (this.resourceCompletion === 'closure') this.assertClosure();
      else this.assertMissing();
    }
    return resourceOnly;
  }

  private validateIsolatedArguments(argv: string[][], resourceOnly: boolean): boolean {
    assert.ok(
      argv.length || resourceOnly,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: isolated behavior argv missing',
    );
    const bypassed =
      argv.length > 0 &&
      argv.every(
        args =>
          args.filter(argument => argument === '--dangerously-bypass-hook-trust').length === 1,
      );
    assert.ok(
      bypassed || resourceOnly,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: isolated behavior argv differs',
    );
    return bypassed;
  }

  private wiringCandidate(): NativeWiringCandidate {
    assert.ok(this.wiring && this.turn);
    assert.deepEqual(wiringReviewBytes(this.project), this.wiring.bytes);
    this.assertPublic('quality-review');
    return {
      locations: {
        project: this.project,
        profile: this.profile,
        installed: this.installed,
        artifacts: this.artifacts,
      },
      before: [...this.wiring.jobs],
      turn: this.turn,
      bytes: structuredClone(this.wiring.bytes),
    };
  }

  private save(label: string, value: unknown): void {
    writeFileSync(
      nodePath.join(this.artifacts, `${label}.json`),
      `${JSON.stringify(value, undefined, 2)}\n`,
    );
  }

  private markRevision(label: string): void {
    for (const [key, relative] of Object.entries(canonicalResources)) {
      const file = nodePath.join(this.source, 'packages/cli/templates', relative);
      if (!this.originals.has(file)) this.originals.set(file, readFileSync(file, 'utf8'));
      const marker = `RESOURCE_${randomUUID()}`;
      this.markers[key as keyof Markers] = marker;
      const original = this.originals.get(file) ?? '';
      const prefix = /^---\r?\n[\s\S]*?\r?\n---\r?\n/u.exec(original)?.[0] ?? '';
      if (relative.endsWith('/SKILL.md'))
        assert.ok(prefix, 'HOST_CONTRACT_PROOF_UNAVAILABLE: canonical skill frontmatter missing');
      // Optional diagnostic closure edge, not a production essential dependency.
      // No public handoff text or production procedure is replaced.
      const reference =
        key === 'testing' ? '\n[Testing guide](../../guides/testing-guide.md)\n' : '';
      writeFileSync(
        file,
        `${prefix}\n<!-- ${marker} -->\n${reference}${original.slice(prefix.length)}`,
      );
    }
    const owner = essentialOwner(this.source);
    if (!this.originals.has(owner)) this.originals.set(owner, readFileSync(owner, 'utf8'));
    this.coreMarker = `ESSENTIAL_${randomUUID()}`;
    this.core = markEssentialCore(this.source, this.originals.get(owner) ?? '', this.coreMarker);
    this.save(label, {
      source: this.source,
      markers: this.markers,
      essential: { marker: this.coreMarker, block: this.core, ownerSha256: digest(owner) },
      canonicalHashes: Object.fromEntries(
        Object.entries(canonicalResources).map(([key, relative]) => [
          key,
          digest(nodePath.join(this.source, 'packages/cli/templates', relative)),
        ]),
      ),
    });
  }

  /** Unsigned root preparation only. Both ordinary generated trees exist before
   * any action; a fresh consumer still needs the normal independent input review.
   * This actor is deliberately unusable for native actions after staging.
   */
  stageRevisions(ownership?: { caseId: string; arm: string }) {
    if (ownership)
      assert.ok(
        codexInternalCases().some(
          row => row.id === ownership.caseId && row.preservationArms.includes(ownership.arm),
        ),
        'HOST_CONTRACT_PROOF_UNAVAILABLE: foreign staging case/arm',
      );
    assert.equal(this.stagingOnly, false, 'HOST_CONTRACT_PROOF_UNAVAILABLE: stages already frozen');
    assert.equal(this.sequence, 0, 'HOST_CONTRACT_PROOF_UNAVAILABLE: action precedes staging');
    assert.equal(
      this.installed,
      '',
      'HOST_CONTRACT_PROOF_UNAVAILABLE: installation precedes staging',
    );
    this.stagingOnly = true;
    const descriptor = stageWorkflowPair(
      this.fixture,
      this.artifacts,
      ownership,
      label => {
        this.markRevision(`staged-${label}-revision`);
        const revision = JSON.parse(
          readFileSync(nodePath.join(this.artifacts, `staged-${label}-revision.json`), 'utf8'),
        ) as WorkflowRevision;
        return { source: this.source, revision };
      },
      this.profile,
    );
    this.save('staged-inputs', descriptor);
    return descriptor;
  }

  protected override bypassesPersistedTrust(): boolean {
    return this.isolated !== undefined;
  }

  protected override generateCandidate(source: string, candidate: string, version: string): void {
    if (!this.isolated && !this.normalStages) {
      super.generateCandidate(source, candidate, version);
      return;
    }
    cpSync(this.selectedStage().packageRoot, candidate, { recursive: true });
  }

  protected override requirePreparedTrust(candidate: string): Promise<HookObservation[]> {
    return this.isolated
      ? Promise.resolve(this.isolatedReadiness())
      : super.requirePreparedTrust(candidate);
  }

  protected override command(
    program: string,
    args: string[],
    label: string,
    cwd = this.project,
  ): string {
    let timeout = 240_000;
    if (this.isolated && program === this.fixture.binary && args.includes('exec')) {
      timeout = 420_000;
      const hooks = this.isolatedReadiness();
      args = ['--dangerously-bypass-hook-trust', ...args];
      this.isolatedArguments.push([...args]);
      this.save(`${label}-isolated-mode`, {
        mode: 'isolated-behavior',
        admissionEligible: false,
        argv: args,
        hooks,
        review: this.isolated,
        stage: this.selectedStage(),
        coordinatorSha256: this.pair?.coordinatorSha256,
      });
    }
    return super.command(program, args, label, cwd, timeout);
  }

  protected override pickerModeArguments(): string[] {
    if (!this.isolated) return [];
    this.isolatedReadiness();
    return ['--dangerously-bypass-hook-trust'];
  }

  override inspectPicker(): void {
    super.inspectPicker();
    if (this.isolated) {
      this.pickerInvoked = true;
      this.observedPickerArguments();
    }
  }

  protected override async preservedBindings(): Promise<Record<string, unknown>> {
    if (!this.isolated) {
      const bindings = await super.preservedBindings(this.refreshedHooks ?? this.before);
      if (!this.fixture.normalTrustQualification) return bindings;
      const stages = ['A', 'B'].flatMap(label => {
        const file = nodePath.join(this.artifacts, `normal-trust-${label}.json`);
        return existsSync(file) ? [{ label, file, ...JSON.parse(readFileSync(file, 'utf8')) }] : [];
      });
      if (this.previous) {
        assert.equal(
          stages.length,
          2,
          'HOST_CONTRACT_PROOF_UNAVAILABLE: normal trust stages missing',
        );
        assert.notEqual(
          stages[0].package['runtime/cli.js'],
          stages[1].package['runtime/cli.js'],
          'HOST_CONTRACT_PROOF_UNAVAILABLE: normal trust script unchanged',
        );
      }
      return {
        ...bindings,
        normalTrustQualification: {
          mode: 'normal-trust-invalidation',
          stages,
          previousThread: this.previous?.thread,
          currentThread: this.turn?.thread,
          nativeTurnArtifacts: [1, this.sequence].map(index =>
            nodePath.join(this.artifacts, `turn-${index}.json`),
          ),
        },
      };
    }
    const child = this.isolatedReadiness();
    const original = workflowHookInventory(this.fixture, this.artifacts, 'original-after');
    requireWorkflowBindings(original, this.fixture.installedPath, true);
    assert.deepEqual(original, this.originalHooks);
    const nativeBehaviorArgv = [
      ...this.isolatedArguments,
      ...(this.pickerInvoked ? [this.observedPickerArguments()] : []),
    ];
    const resourceOnly = this.completedResource(this.isolated.caseId, nativeBehaviorArgv);
    const persistedHookTrustBypassed = this.validateIsolatedArguments(
      nativeBehaviorArgv,
      resourceOnly,
    );
    assert.deepEqual(
      child.map(({ eventName, enabled, sourcePath }) => ({ eventName, enabled, sourcePath })),
      this.before.map(({ eventName, enabled, sourcePath }) => ({ eventName, enabled, sourcePath })),
    );
    return {
      fiveTrustedBindingsUnchanged: false,
      persistedHookTrustBypassed,
      originalFiveTrustedBindingsUnchanged: true,
      fiveEnabledBindingsUnchanged: true,
      mode: 'isolated-behavior',
      admissionEligible: false,
      nativeBehaviorArgv,
      ...(resourceOnly && {
        nativeModelInvocation: 'not-applicable',
        resourceCaseId: this.isolated.caseId,
        resourceCheckKind: this.resourceCompletion,
        resourceCheckCompleted: true,
      }),
      stages: this.pair?.stages,
      review: this.isolated,
      childInventory: child,
    };
  }

  prepareWiringGrade(): void {
    const file = process.env.SAFEWORD_WIRING_CALIBRATION;
    assert.ok(file, 'HOST_CONTRACT_PROOF_UNAVAILABLE: authenticated calibration required');
    this.wiringGrade = provisionIsolatedGrade(this.artifacts, this.fixture.profile);
    this.save('wiring-calibration', requireWiringCalibration(file, this.wiringGrade));
  }

  override async preserve(): Promise<void> {
    try {
      await super.preserve();
    } finally {
      this.wiringGrade?.cleanupCredentials();
    }
  }

  async prepareCanonical(): Promise<void> {
    mkdirSync(nodePath.join(this.project, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(this.project, '.safeword/SAFEWORD.md'),
      'Owned native invocation fixture.\n',
    );
    writeFileSync(
      nodePath.join(this.project, '.safeword/config.json'),
      '{"paths":{"projectRoot":".project"}}\n',
    );
    writeFileSync(
      nodePath.join(this.project, 'package.json'),
      '{"type":"module","scripts":{"test":"node --test"}}\n',
    );
    writeFileSync(
      nodePath.join(this.project, 'clamp.js'),
      'export function clamp(value, min, max) { if (min > max) throw new RangeError("min exceeds max"); return Math.min(max, Math.max(min, value)); }\n',
    );
    initializeWorkflowGit(this.project, this.artifacts);
    if (this.isolated) {
      this.loadStage();
      this.originalHooks = workflowHookInventory(this.fixture, this.artifacts, 'original-before');
      requireWorkflowBindings(this.originalHooks, this.fixture.installedPath, true);
    } else if (this.normalStages) this.loadStage();
    else this.markRevision(`revision-${this.sequence}`);
    await this.prepare(this.source);
    if (this.isolated)
      this.restartRevision = validatedResourceRevision(
        this.installed,
        installedIndex(this.installed),
      );
    this.save('canonical-installation', {
      source: this.source,
      installed: this.installed,
      index: installedIndex(this.installed),
    });
  }

  run(prompt: string, resume = false): NativeTurn {
    assert.notEqual(
      this.stagingOnly,
      true,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: staging-only actor cannot execute native actions',
    );
    workflowGitReadiness(
      this.project,
      nodePath.join(this.artifacts, `project-git-before-turn-${this.sequence + 1}.json`),
    );
    for (const marker of [...Object.values(this.markers), this.coreMarker])
      assert.ok(!prompt.includes(marker));
    const previous = resume ? this.turn : undefined;
    const offset = previous?.allEntries.length ?? 0;
    const args = [
      '--enable',
      'hooks',
      '--enable',
      'plugins',
      'exec',
      ...(previous ? ['resume'] : []),
      '--json',
      '--skip-git-repo-check',
      '-c',
      'approval_policy="never"',
      '-c',
      'sandbox_mode="workspace-write"',
      '-c',
      'sandbox_workspace_write.network_access=true',
      '-m',
      requestedModel,
    ];
    if (resume) {
      assert.ok(previous);
      args.push(previous.thread);
    }
    const label = `turn-${++this.sequence}`;
    const language = checkedPreparationLanguage(
      this.command(
        '/bin/zsh',
        ['-lc', preparationLanguageProbe],
        `${label}.shell-language`,
        this.project,
      ),
    );
    writeFileSync(
      nodePath.join(this.artifacts, `${label}.shell-language.json`),
      JSON.stringify({
        project: this.project,
        profile: this.profile,
        installed: this.installed,
        label,
        ...language,
      }),
    );
    writeFileSync(nodePath.join(this.artifacts, `${label}.request.txt`), prompt);
    const stdout = this.command(this.fixture.binary, [...args, prompt], label);
    const turn = nativeTurn(this.profile, stdout, offset, previous?.thread);
    assert.ok(
      turn.models.every(model => model === requestedModel),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: requested and observed model differ',
    );
    this.turn = turn;
    this.save(label, {
      requestedModel,
      observedModels: turn.models,
      thread: turn.thread,
      rollout: turn.rollout,
      offset,
    });
    return turn;
  }

  testOrdinary(): void {
    this.run(ordinary);
  }

  establishRestartThread(): void {
    this.seedReviewTests();
    const reads = ['internal/testing/SKILL.md', 'templates/guides/testing-guide.md']
      .map(relative => `cat ${JSON.stringify(nodePath.join(this.installed, relative))}`)
      .join(' and ');
    this.run(
      `For this initial setup turn only, use three separate native shell tool invocations: run ${reads}, then run \`node --test clamp.test.js\`. Emit each whole unmodified result separately, without bundling or re-encoding.`,
    );
    this.save('restart-setup', {
      method: 'explicit-initial-A-reads',
      causalLimit:
        'Prior explicit A paths and the setup output-format instruction remain in history and may shape B output. The resumed assertion proves current essential startup delivery, not a resumed procedure read, startup discovery alone or two consecutive ordinary turns.',
    });
  }

  assertTesting(withEssentials = false): void {
    assert.ok(this.turn);
    const context = startupPopulation(this.turn, this.installed, [
      this.markers.testing,
      this.markers.guide,
    ]);
    if (withEssentials) {
      const revision = validatedResourceRevision(this.installed, installedIndex(this.installed));
      this.restartRevision ??= revision;
      assert.ok(
        context.includes(`Resource revision: ${revision}`),
        'INTERNAL_WORKFLOW_UNMET: current resource revision not delivered',
      );
      this.save(`resource-revision-${this.sequence}`, {
        revision,
        initialRevision: this.restartRevision,
      });
    }
    const delivery = startupEssential(this.turn, this.installed, this.core);
    let body;
    if (!withEssentials || this.sequence === 1)
      body = resourceLoad(
        this.turn,
        nodePath.join(this.installed, 'internal/testing/SKILL.md'),
        this.markers.testing,
        withEssentials,
        withEssentials ? this.core : undefined,
      );
    assertNodeTests(this.turn);
    writeFileSync(nodePath.join(this.artifacts, `startup-${this.sequence}.txt`), context);
    this.save(`reads-${this.sequence}`, {
      body,
      delivery,
      essential: withEssentials
        ? {
            marker: this.coreMarker,
            bytes: Buffer.byteLength(this.core),
            sha256: createHash('sha256').update(this.core).digest('hex'),
          }
        : undefined,
    });
  }

  async refresh(): Promise<void> {
    assert.ok(this.turn);
    this.previous = this.turn;
    if (this.isolated || this.normalStages) {
      this.stageLabel = 'B';
      this.loadStage();
    } else this.markRevision(`revision-${this.sequence}`);
    for (const marker of Object.values(this.markers))
      assert.ok(!JSON.stringify(this.previous.allEntries).includes(marker));
    assert.ok(!JSON.stringify(this.previous.allEntries).includes(this.coreMarker));
    const candidate = nodePath.join(this.artifacts, 'marketplace/plugin');
    rmSync(candidate, { recursive: true });
    const version = (
      JSON.parse(readFileSync(nodePath.join(this.source, 'packages/cli/package.json'), 'utf8')) as {
        version: string;
      }
    ).version;
    if (this.isolated || this.normalStages)
      cpSync(this.selectedStage().packageRoot, candidate, { recursive: true });
    else
      this.command(
        nodePath.join(repo, 'scripts/dev'),
        [
          'bun',
          nodePath.join(this.source, 'packages/cli/scripts/generate-codex-plugin.ts'),
          '--version',
          version,
          '--output',
          candidate,
        ],
        'refresh-generate',
      );
    this.command(
      this.fixture.binary,
      ['plugin', 'remove', 'safeword@safeword-contract-test', '--json'],
      'refresh-remove',
    );
    this.command(
      this.fixture.binary,
      ['plugin', 'add', 'safeword@safeword-contract-test', '--json'],
      'refresh-install',
    );
    assertMatchingTree(candidate, this.installed);
    assert.ok(this.restartRevision, 'HOST_CONTRACT_PROOF_UNAVAILABLE: initial revision absent');
    assert.notEqual(
      validatedResourceRevision(this.installed, installedIndex(this.installed)),
      this.restartRevision,
      'INTERNAL_WORKFLOW_UNMET: refresh did not change actual resource revision',
    );
    const refreshed = await this.requirePreparedTrust(candidate);
    this.acceptRefreshedBindings(refreshed);
    this.save('refreshed-installation', {
      installed: this.installed,
      runtimeSha256: digest(nodePath.join(this.installed, 'runtime/cli.js')),
      testingSha256: digest(nodePath.join(this.installed, 'internal/testing/SKILL.md')),
      guideSha256: digest(nodePath.join(this.installed, 'templates/guides/testing-guide.md')),
      index: installedIndex(this.installed),
      previousThread: this.previous.thread,
      hooks: refreshed,
    });
  }

  protected acceptRefreshedBindings(refreshed: HookObservation[]): void {
    if (this.isolated) return;
    if (!this.fixture.normalTrustQualification) {
      assert.deepEqual(refreshed, this.before);
      return;
    }
    const stable = (hooks: HookObservation[]) =>
      hooks.map(hook =>
        Object.fromEntries(Object.entries(hook).filter(([key]) => key !== 'currentHash')),
      );
    assert.deepEqual(
      stable(refreshed),
      stable(this.before),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: normal trust bindings changed',
    );
    for (const [index, hook] of this.before.entries()) {
      const next = refreshed[index]?.currentHash;
      assert.ok(
        typeof hook.currentHash === 'string' &&
          hook.currentHash.trim() &&
          typeof next === 'string' &&
          next.trim(),
        'HOST_CONTRACT_PROOF_UNAVAILABLE: normal trust fingerprint missing',
      );
      assert.notEqual(
        next,
        hook.currentHash,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: normal trust fingerprint unchanged',
      );
    }
    this.refreshedHooks = refreshed;
  }

  resumeTesting(): void {
    assert.equal(
      this.restartBaseline,
      undefined,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: baseline recapture',
    );
    this.restartBaseline = captureNodeBaseline(this.project, this.artifacts);
    this.run(
      'Please extend the focused tests for clamp to cover values inside the range, at and outside the bounds, and invalid bounds. Run the built-in Node tests and report the results.',
      true,
    );
  }

  assertRefreshed(): void {
    assert.ok(this.previous && this.turn);
    assert.equal(this.turn.thread, this.previous.thread);
    this.assertTesting(true);
    discriminateNodeTests(this.project, this.artifacts, this.restartBaseline);
  }

  invokePublic(name: 'explain' | 'quality-review'): void {
    const request =
      name === 'explain'
        ? '$safeword:explain Explain the current work and the next concrete action. Make no changes.'
        : '$safeword:quality-review Review clamp.js and clamp.test.js for behavior and wiring coverage. Follow its existing Optional examples reference for Wiring Tests. Make no source changes; run the normal review procedure and report actual findings. If you change directories before reviewing, use cd … && … so review stops if that fails.';
    this.run(request);
  }

  seedReviewTests(): void {
    writeFileSync(
      nodePath.join(this.project, 'clamp.test.js'),
      'import {test} from "node:test"; import assert from "node:assert/strict"; import {clamp} from "./clamp.js"; ' +
        `test(${JSON.stringify(RESTART_SEED_TEST_NAME)},()=>assert.equal(clamp(2,0,1),1));\n`,
    );
  }

  prepareWiring(arm: WiringArm): void {
    const config = nodePath.join(this.project, '.safeword/config.json');
    const existing = JSON.parse(readFileSync(config, 'utf8'));
    writeFileSync(
      config,
      JSON.stringify({
        ...existing,
        crossAgentReview: 'prefer',
        crossAgentReviewRoutes: { codex: [{ reviewer: 'claude', model: 'claude-opus-5' }] },
      }),
    );
    const bytes = seedWiringReview(this.project, arm);
    this.save('wiring-fixture', { arm, bytes, proof: proveWiringFixture(this.project, arm) });
    this.wiring = { arm, bytes, jobs: reviewJobs(this.project) };
  }

  reviewWiring(): void {
    assert.ok(this.wiring);
    assert.deepEqual(wiringReviewBytes(this.project), this.wiring.bytes);
    this.wiring.jobs = reviewJobs(this.project);
    this.save('wiring-before-dispatch', this.wiring);
    this.invokePublic('quality-review');
    assert.deepEqual(
      wiringReviewBytes(this.project),
      this.wiring.bytes,
      'INTERNAL_WORKFLOW_UNMET: review changed target bytes',
    );
  }

  assertWiringPair(other: CodexWorkflowRuntimeActor): void {
    assert.deepEqual(
      new Set([this.wiring?.arm, other.wiring?.arm]),
      new Set(['covered', 'defective']),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: paired fixture roles',
    );
    assert.ok(this.wiringGrade && process.env.SAFEWORD_WIRING_CALIBRATION);
    requireWiringCalibration(process.env.SAFEWORD_WIRING_CALIBRATION, this.wiringGrade);
    const pair = pairedWiringClaim([this.wiringCandidate(), other.wiringCandidate()]);
    this.save('wiring-native-pair', { roles: [this.wiring?.arm, other.wiring?.arm], ...pair });
    const dispatch = dispatchWiringClaim(this.wiringGrade, pair.claim, pair.candidates);
    const grade = dispatch.read();
    assert.equal(
      isolatedBuildIdentity(
        readFileSync(this.wiringGrade.binding.runtime, 'utf8'),
        this.wiringGrade.binding,
      ),
      this.wiringGrade.buildIdentity,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: bound grader changed',
    );
    this.save('wiring-paired-grade', grade);
    for (const instance of [this, other]) {
      assert.ok(instance.wiring);
      assert.deepEqual(wiringReviewBytes(instance.project), instance.wiring.bytes);
    }
    assert.ok(grade.accepted, 'INTERNAL_WORKFLOW_UNMET: calibrated paired Wiring judgment');
  }

  assertPublic(name: 'explain' | 'quality-review'): void {
    assert.ok(this.turn);
    const key = name === 'explain' ? 'explain' : 'review';
    const publicPath = nodePath.join(this.installed, 'skills', name, 'SKILL.md');
    const load = resourceLoad(this.turn, publicPath, this.markers[key], true);
    if (name === 'quality-review') {
      const reference = handoffTarget(
        publicPath,
        nodePath.join(this.installed, 'internal/testing/SKILL.md'),
      );
      const testing = resourceLoad(
        { ...this.turn, afterEntryIndex: load.entryIndex },
        reference.resolved,
        this.markers.testing,
      );
      assert.ok(
        load.entryIndex < testing.entryIndex,
        'INTERNAL_WORKFLOW_UNMET: internal read did not follow the public procedure load',
      );
      this.save('public-handoff', {
        load,
        reference,
        testing,
        causalLimit: 'Automatic discovery remains enabled; exclusive causation is not established.',
      });
    } else {
      const developer = this.turn.entries
        .filter(entry => entry.payload?.role === 'developer')
        .map(messageText)
        .join('\n');
      const catalogue = automaticCatalogue(developer);
      assert.ok(
        catalogue.some(
          entry =>
            entry.name === 'bdd' &&
            entry.path === nodePath.join(this.installed, 'skills/bdd/SKILL.md'),
        ) && developer.includes('internal/testing/SKILL.md'),
        'HOST_CONTRACT_PROOF_UNAVAILABLE: automatic catalogue controls absent',
      );
      assert.ok(
        catalogue.every(entry => entry.name !== 'explain'),
        'INTERNAL_WORKFLOW_UNMET: manual workflow present in automatic catalogue',
      );
      this.save('manual-load', { load, developer });
    }
  }

  setWritePolicy(disposition: 'allowed' | 'denied'): void {
    this.disposition = disposition;
    const relative =
      disposition === 'allowed'
        ? 'allowed-control.txt'
        : '.project/tickets/sentinel-native/ticket.md';
    this.target = nodePath.join(this.project, relative);
    mkdirSync(nodePath.dirname(this.target), { recursive: true });
    assert.equal(existsSync(this.target), false);
    this.shellCommand = `printf %s native-control > ${relative}`;
  }

  attemptWrite(): void {
    const attempt =
      this.disposition === 'allowed'
        ? `\n\`\`\`sh\n${this.shellCommand}\n\`\`\`\n`
        : `${this.shellCommand} . `;
    this.run(
      `This is an authorized isolated native hook integration test. Use the shell tool exactly once to attempt: ${attempt}Let existing hooks govern it. Rejection is expected for protected files. Do not bypass, retry or use alternative tools; report the actual result.`,
      true,
    );
  }

  assertWrite(): void {
    assert.ok(this.turn);
    const stderr = readFileSync(
      nodePath.join(this.artifacts, `turn-${this.sequence}.stderr`),
      'utf8',
    );
    if (this.disposition === 'denied') {
      assert.equal(
        existsSync(this.target),
        false,
        'INTERNAL_WORKFLOW_UNMET: denied sentinel reached disk',
      );
      assert.ok(
        stderr.includes(`Command: ${this.shellCommand}`),
        'INTERNAL_WORKFLOW_UNMET: completed task made no actual denied tool attempt',
      );
      assert.equal(stderr.match(/Command blocked by PreToolUse hook:/gu)?.length, 1);
      assert.ok(
        stderr.includes("Safeword can't check what a shell command writes to a ticket file"),
      );
    } else {
      assert.ok(existsSync(this.target), 'INTERNAL_WORKFLOW_UNMET: permitted write was omitted');
      assert.equal(readFileSync(this.target, 'utf8'), 'native-control');
      assert.ok(
        this.turn.events.some(
          event =>
            event.item?.type === 'command_execution' &&
            event.item.command?.includes(this.shellCommand) &&
            event.item.exit_code === 0,
        ),
        'INTERNAL_WORKFLOW_UNMET: completed task omitted the paired shell execution',
      );
    }
    this.save('write-outcome', {
      disposition: this.disposition,
      target: this.target,
      shellCommand: this.shellCommand,
    });
  }

  traverseClosure(): void {
    assertMatchingTree(
      nodePath.join(this.source, 'packages/cli/templates'),
      nodePath.join(this.installed, 'templates'),
    );
    const foreign = nodePath.join(this.artifacts, 'foreign');
    mkdirSync(foreign);
    const closure = this.command(
      nodePath.join(repo, 'scripts/dev'),
      [
        'node',
        nodePath.join(repo, 'packages/cli/tests/fixtures/host-contract/codex-workflow-closure.mjs'),
        this.installed,
        nodePath.join(this.source, 'packages/cli/templates'),
      ],
      'foreign-closure',
      foreign,
    );
    const version = this.command(
      nodePath.join(repo, 'scripts/dev'),
      ['bun', nodePath.join(this.installed, 'runtime/cli.js'), '--version'],
      'foreign-helper',
      foreign,
    );
    this.save('closure', { ...JSON.parse(closure), version });
    if (this.isolated) {
      this.assertClosure();
      this.resourceCompletion = 'closure';
    }
  }

  assertClosure(): void {
    const value = JSON.parse(
      readFileSync(nodePath.join(this.artifacts, 'closure.json'), 'utf8'),
    ) as {
      cwd: string;
      installed: string;
      canonical: string[];
      resources: unknown[];
      templates: unknown[];
      version: string;
    };
    assert.equal(value.cwd, nodePath.join(this.artifacts, 'foreign'));
    assert.equal(value.installed, this.installed);
    assert.deepEqual(
      value.canonical,
      installedIndex(this.installed)
        .workflows.map(entry => entry.name)
        .toSorted((a, b) => a.localeCompare(b)),
    );
    assert.ok(
      value.resources.length > 0 && value.templates.length > 0 && value.version.includes('.'),
    );
  }

  check(): { output: string; status: number | null } {
    return runWorkflowGenerator(this.source, this.profile, true);
  }

  prepareMissing(): void {
    if (this.isolated) {
      const control = nodePath.join(this.artifacts, 'missing-source');
      cpSync(this.selectedStage().source, control, { recursive: true, verbatimSymlinks: true });
      this.source = control;
    }
    const shipped = nodePath.join(this.source, 'packages/cli/codex-plugin');
    const generated = runWorkflowGenerator(this.source, this.profile, false);
    this.save('missing-normal-generation', generated);
    assert.equal(generated.status, 0, generated.output);
    const clean = this.check();
    assert.equal(clean.status, 0, clean.output);
    const missing = nodePath.join(shipped, 'internal/testing/SKILL.md');
    assert.ok(existsSync(missing));
    rmSync(missing);
    this.save('missing-clean-control', clean);
  }

  checkMissing(): void {
    this.checker = this.check();
    this.save('missing-check', this.checker);
    if (this.isolated) {
      assert.equal(
        typeof this.checker.status,
        'number',
        'HOST_CONTRACT_PROOF_UNAVAILABLE: checker did not complete',
      );
      this.assertMissing();
      this.resourceCompletion = 'missing';
    }
  }
  assertMissing(): void {
    assert.ok(this.checker);
    assert.notEqual(this.checker.status, 0, 'INTERNAL_WORKFLOW_UNMET: incomplete package accepted');
    assert.ok(this.checker.output.includes('internal/testing/SKILL.md'));
  }
}
