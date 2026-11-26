import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import architectureCase from '../../tests/fixtures/host-contract/propagation-architecture-case.json';
import { ClaudeNativeCatalogueActor } from '../../tests/helpers/claude-native-catalogue.js';
import type { ClaudeNativeFixture } from '../../tests/helpers/claude-native-contract.js';
import { CodexNativeCatalogueActor } from '../../tests/helpers/codex-native-catalogue.js';
import type { CodexGuardFixture } from '../../tests/helpers/codex-native-continuation.js';
import type { WorkflowReview } from '../../tests/helpers/codex-reviewed-workflow.js';
import { CursorCliCatalogueActor } from '../../tests/helpers/cursor-cli-catalogue.js';
import {
  CursorNativeCatalogueActor,
  type CursorNativeFixtureConfig,
} from '../../tests/helpers/cursor-native-catalogue.js';
import {
  ReviewedCodexPropagation,
  stageHeadlessCodexPropagation,
} from '../../tests/helpers/headless-codex-propagation.js';
import {
  type CanonicalCatalogueInputs,
  createCanonicalCatalogueInputs,
} from '../../tests/helpers/native-catalogue-probe.js';
import { OpenCodeNativeCatalogueActor } from '../../tests/helpers/opencode-native-catalogue.js';
import type { OpenCodeNativeFixture } from '../../tests/helpers/opencode-native-write.js';
import { ObservedPropagationMismatch } from '../../tests/helpers/propagation-policy-case.js';
import {
  createPropagationSource,
  propagationFingerprint,
  propagationVerificationOwner,
  requirePropagationVerificationMarker,
} from '../../tests/helpers/propagation-source.js';
import { PropagationOutcomeError } from './propagation-policy-phases.js';
import {
  type ArchitectureSetting,
  type HandoffSetting,
  type PolicyObservation,
  type PropagationLane,
  propagationLanes,
  type RetainedDiagnostic,
  type RetainedPolicyActor,
  runResourcePropagation,
} from './resource-propagation.js';

type NativeActor =
  | ClaudeNativeCatalogueActor
  | CodexNativeCatalogueActor
  | CursorCliCatalogueActor
  | CursorNativeCatalogueActor
  | OpenCodeNativeCatalogueActor;

async function observePolicy(
  actor: NativeActor,
  evidence: string,
  validSetupEvidence: string,
  setting?: ArchitectureSetting,
): Promise<PolicyObservation> {
  if (setting) {
    if (actor instanceof CursorNativeCatalogueActor)
      return {
        protocol: 'cursor-stop',
        observation: await actor.observeArchitecture(evidence, {
          ...architectureCase,
          options: setting.options,
        }),
      };
    assert.ok(
      (actor instanceof ClaudeNativeCatalogueActor || actor instanceof CodexNativeCatalogueActor) &&
        setting.kind === 'architecture-review',
      'HOST_CONTRACT_PROOF_UNAVAILABLE: configured architecture case unsupported by this actor',
    );
    return {
      protocol: 'stop-json',
      observation: await actor.observeVerification(evidence, {
        ...architectureCase,
        options: setting.options,
      }),
    };
  }
  if (actor instanceof ClaudeNativeCatalogueActor || actor instanceof CodexNativeCatalogueActor) {
    // Their second argument is an option case, NOT readiness setup evidence.
    const observation = await actor.observeVerification(evidence);
    assert.ok(
      'decisions' in observation,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: completion observations missing',
    );
    return { protocol: 'stop-json', observation };
  }
  if (actor instanceof OpenCodeNativeCatalogueActor)
    return {
      protocol: 'exit-status',
      observation: await actor.observeVerification(evidence, validSetupEvidence),
    };
  return {
    protocol: 'permission-json',
    observation: await actor.observeVerification(evidence, validSetupEvidence),
  };
}

/** One concrete-actor adapter shared by the factory and source characterizations. */
export function retainNativeResourceActor(
  actor: NativeActor,
  sourcePackage?: string,
): RetainedPolicyActor {
  return {
    handoffProtocol: actor instanceof CursorNativeCatalogueActor ? 'cursor-stop' : undefined,
    ...((actor instanceof CodexNativeCatalogueActor ||
      actor instanceof ClaudeNativeCatalogueActor) && {
      observeContinuation: () => actor.observeContinuation(),
      assertContinuation: () => {
        actor.assertContinuation();
      },
    }),
    observeDesignApproval: async options => {
      if (actor instanceof CodexNativeCatalogueActor)
        return {
          protocol: 'codex-pre-tool-json',
          observation: await actor.observeDesignApproval(options),
        };
      if (actor instanceof CursorNativeCatalogueActor || actor instanceof CursorCliCatalogueActor)
        return {
          protocol: 'permission-json',
          observation: await actor.observeDesignApproval(options),
        };
      if (actor instanceof OpenCodeNativeCatalogueActor)
        return { protocol: 'exit-status', observation: await actor.observeDesignApproval(options) };
      assert.ok(
        actor instanceof ClaudeNativeCatalogueActor,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: design setting unsupported by this actor',
      );
      return { protocol: 'pre-tool-json', observation: await actor.observeDesignApproval(options) };
    },
    observeHandoff: (setting: HandoffSetting) => {
      if (actor instanceof CursorNativeCatalogueActor) return actor.observeHandoff(setting);
      assert.ok(
        actor instanceof ClaudeNativeCatalogueActor || actor instanceof CodexNativeCatalogueActor,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: terminal setting unsupported by this actor',
      );
      return actor.observeHandoff({
        enabled: setting.options.terminalHandoffCorrection,
        currentTool: setting.currentTool,
        configuration: setting.options,
      });
    },
    fingerprint: () => propagationFingerprint(actor.propagationPaths()),
    refreshResources: next =>
      actor.refreshResources(sourcePackage ? { ...next, sourcePackage } : next),
    observe: async () => {
      if (actor instanceof ClaudeNativeCatalogueActor) return actor.observe();
      await actor.invokeWorkflow();
      return actor.observedResources();
    },
    observeVerification: (evidence, validSetupEvidence, setting) =>
      observePolicy(actor, evidence, validSetupEvidence, setting),
    ...((actor instanceof ClaudeNativeCatalogueActor ||
      actor instanceof CodexNativeCatalogueActor) && {
      close: () => {
        actor.close();
      },
    }),
  };
}

async function prepareCodexResourceActor(
  lane: PropagationLane,
  inputs: CanonicalCatalogueInputs,
  fixture: CodexGuardFixture,
  readiness?: number | ReviewedCodexPropagation,
) {
  const staged = typeof readiness === 'object';
  const actor = new CodexNativeCatalogueActor(
    fixture,
    inputs,
    staged ? 'fresh' : 'provisioned',
    undefined,
    readiness,
  );
  try {
    await actor.prepare('Codex', lane.version, lane.runtime);
  } catch (error) {
    actor.close();
    throw error;
  }
  return retainNativeResourceActor(actor, inputs.sourcePackage);
}

// This diagnostic component is deliberately NOT the complete task6 proof row.
// Policy/options actual-hook propagation must join before that row can pass.
export async function prepareNativeResourceActor(
  lane: PropagationLane,
  inputs: CanonicalCatalogueInputs,
  fixture: unknown,
  runDirectory: string,
  readiness?: number | ReviewedCodexPropagation,
): Promise<RetainedPolicyActor> {
  console.log(`PROPAGATION_NATIVE_CASE ${lane.id} ${inputs.workflowMarker}`);
  const staged = typeof readiness === 'object' && lane.agent === 'codex';
  const ownedInputs = staged
    ? inputs
    : {
        ...inputs,
        sourcePackage: createPropagationSource(
          mkdtempSync(nodePath.join(runDirectory, `${lane.agent}-source-`)),
          inputs,
        ),
      };
  if (lane.agent === 'codex')
    return prepareCodexResourceActor(lane, ownedInputs, fixture as CodexGuardFixture, readiness);
  if (lane.agent === 'claude') {
    const actor = new ClaudeNativeCatalogueActor(fixture as ClaudeNativeFixture);
    try {
      await actor.prepare(ownedInputs);
    } catch (error) {
      actor.close();
      throw error;
    }
    return retainNativeResourceActor(actor, ownedInputs.sourcePackage);
  }
  let actor: CursorCliCatalogueActor | CursorNativeCatalogueActor | OpenCodeNativeCatalogueActor;
  if (lane.agent === 'opencode') {
    actor = new OpenCodeNativeCatalogueActor(
      fixture as OpenCodeNativeFixture,
      'skill',
      ownedInputs,
    );
    await actor.prepare('OpenCode V2', lane.version, lane.runtime);
  } else {
    assert.equal(
      lane.agent,
      'cursor',
      'HOST_CONTRACT_PROOF_UNAVAILABLE: no native resource driver',
    );
    if (lane.runtime === 'CLI') {
      const { binary, disabledClaudePlugins } = fixture as {
        binary: string;
        disabledClaudePlugins?: string[];
      };
      actor = new CursorCliCatalogueActor(binary, ownedInputs, disabledClaudePlugins);
      await actor.prepare('Cursor', lane.version, lane.runtime);
    } else {
      actor = new CursorNativeCatalogueActor(fixture as CursorNativeFixtureConfig, ownedInputs);
      await actor.prepare(
        'Cursor',
        lane.version,
        lane.runtime,
        lane.delivery === 'native' ? 'portable' : lane.delivery,
      );
    }
  }
  return retainNativeResourceActor(actor, ownedInputs.sourcePackage);
}

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

/** Fixed revisions for the whole invocation, including any normal human trust wait. */
export function prepareNativePropagationInputs(directory: string, joined: boolean) {
  for (const name of ['previous', 'current', ...(joined ? ['policy'] : [])])
    mkdirSync(nodePath.join(directory, name));
  const previous = createCanonicalCatalogueInputs(nodePath.join(directory, 'previous'));
  const current = createCanonicalCatalogueInputs(nodePath.join(directory, 'current'));
  if (!joined) return { previous, current };
  const policyRoot = nodePath.join(directory, 'policy/canonical');
  cpSync(previous.canonicalRoot, policyRoot, { recursive: true });
  const inputs = { ...previous, canonicalRoot: policyRoot };
  const marker = `VERIFICATION_${randomUUID()}`;
  requirePropagationVerificationMarker(inputs, marker);
  cpSync(
    nodePath.join(policyRoot, propagationVerificationOwner),
    nodePath.join(current.canonicalRoot, propagationVerificationOwner),
  );
  return { previous, current, policy: { inputs, marker } };
}

/** Persist concrete objects and raw bytes BEFORE returning to either grader. */
export function captureNativePropagationActor(
  actor: RetainedPolicyActor,
  lane: string,
  directory: string,
): RetainedPolicyActor {
  let sequence = 0;
  const persist = (kind: string, observed: { raw: string }) => {
    const prefix = nodePath.join(directory, `${encodeURIComponent(lane)}-${++sequence}-${kind}`);
    const raw = `${prefix}.stdout`;
    const object = `${prefix}.json`;
    writeFileSync(raw, observed.raw);
    writeFileSync(object, JSON.stringify(observed));
    appendFileSync(
      nodePath.join(directory, 'observations.jsonl'),
      `${JSON.stringify({ lane, kind, raw_artifact: raw, raw_sha256: sha256(raw), observation_artifact: object, observation_sha256: sha256(object) })}\n`,
    );
    return { raw_artifact: raw, raw_sha256: sha256(raw) };
  };
  const captureObservation = async <Result>(
    kind: 'design' | 'handoff' | 'policy',
    observe: () => Promise<Result>,
    observationOf: (result: Result) => { raw: string },
  ): Promise<Result> => {
    try {
      const result = await observe();
      persist(kind, observationOf(result));
      return result;
    } catch (error) {
      if (!(error instanceof ObservedPropagationMismatch)) throw error;
      persist(`${kind}-mismatch`, error.observation);
      throw new PropagationOutcomeError({
        exit: 2,
        failures: [`PROPAGATION_${kind.toUpperCase()}_MISMATCH:${lane}:${error.message}`],
      });
    }
  };
  return {
    ...actor,
    observeContinuation: async () => {
      assert.ok(actor.observeContinuation, 'HOST_CONTRACT_PROOF_UNAVAILABLE: continuation missing');
      const observed = await actor.observeContinuation();
      persist('continuation', observed);
      return observed;
    },
    observe: async () => {
      const observed = await actor.observe();
      Object.assign(observed, persist('resources', observed));
      return observed;
    },
    observeDesignApproval: async options => {
      const observe = actor.observeDesignApproval?.bind(actor, options);
      if (!observe)
        throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: design setting observation missing');
      return captureObservation('design', observe, result => result.observation);
    },
    observeHandoff: async setting => {
      const observe = actor.observeHandoff?.bind(actor, setting);
      if (!observe)
        throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: terminal setting observation missing');
      return captureObservation('handoff', observe, result => result);
    },
    observeVerification: (evidence, setup, setting) =>
      captureObservation(
        'policy',
        () => actor.observeVerification(evidence, setup, setting),
        result => result.observation,
      ),
  };
}

export function nativePropagationExit(error: unknown): number {
  return error instanceof PropagationOutcomeError ? error.grade.exit : 3;
}

function continuationSources(diagnostic?: {
  retainedCodexContinuation?: true;
  retainedClaudeContinuation?: true;
  retainedCursorContinuation?: true;
}) {
  return [
    ...(diagnostic?.retainedCodexContinuation
      ? [
          '../../tests/helpers/codex-native-continuation.ts',
          '../../tests/helpers/codex-native-catalogue.ts',
        ]
      : []),
    ...(diagnostic?.retainedClaudeContinuation
      ? [
          '../../tests/helpers/claude-native-continuation.ts',
          '../../tests/helpers/claude-native-catalogue.ts',
          '../../tests/helpers/claude-native-contract.ts',
        ]
      : []),
    ...(diagnostic?.retainedCursorContinuation
      ? [
          '../../tests/helpers/cursor-native-catalogue.ts',
          '../../tests/helpers/cursor-native-observations.ts',
        ]
      : []),
  ];
}

function diagnosticName(diagnostic: RetainedDiagnostic) {
  return [
    ...(diagnostic.headless ? ['headless'] : []),
    'retained-settings',
    ...(diagnostic.retainedCodexContinuation ? ['codex-continuation'] : []),
    ...(diagnostic.retainedClaudeContinuation ? ['claude-continuation'] : []),
    ...(diagnostic.retainedCursorContinuation ? ['cursor-continuation'] : []),
  ].join('-');
}

function fixtureBindings(
  required: ReturnType<typeof propagationLanes>,
  mismatch = 'HOST_CONTRACT_PROOF_UNAVAILABLE: fixture bindings differ from required population',
) {
  const file = process.env.SAFEWORD_PROPAGATION_FIXTURES;
  assert.ok(file, 'HOST_CONTRACT_PROOF_UNAVAILABLE: explicit owned native fixture map required');
  // Values are fixture FILE paths, never commands, observations or success flags.
  const bindings = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
  assert.deepEqual(
    Object.keys(bindings).toSorted((a, b) => a.localeCompare(b)),
    required.map(row => row.id).toSorted((a, b) => a.localeCompare(b)),
    mismatch,
  );
  return { file, bindings };
}

interface HeadlessPropagationPlan {
  fixtureMapSha256: string;
  bindingHashes: Record<string, string>;
  policyMarker: string;
  pairs: WorkflowReview[];
}

const headless: RetainedDiagnostic = {
  headless: true,
  retainedSettings: true,
  retainedCodexContinuation: true,
  retainedClaudeContinuation: true,
};

function codexFixture(bindings: Record<string, string>): CodexGuardFixture {
  const lane = propagationLanes(headless).find(candidate => candidate.agent === 'codex');
  assert.ok(lane);
  const file = bindings[lane.id];
  assert.ok(
    file && nodePath.isAbsolute(file),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: owned Codex fixture required',
  );
  return JSON.parse(readFileSync(file, 'utf8')) as CodexGuardFixture;
}

function fixtureHashes(bindings: Record<string, string>) {
  return Object.fromEntries(Object.values(bindings).map(file => [file, sha256(file)]));
}

function prepareHeadlessPropagation() {
  const { file, bindings } = fixtureBindings(propagationLanes(headless));
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-native-propagation-'));
  const { previous, current, policy } = prepareNativePropagationInputs(directory, true);
  assert.ok(policy);
  const pairs = stageHeadlessCodexPropagation(codexFixture(bindings), [
    previous,
    policy.inputs,
    current,
  ]);
  const descriptor = nodePath.join(directory, 'propagation-plan.json');
  writeFileSync(
    descriptor,
    JSON.stringify(
      {
        fixtureMapSha256: sha256(file),
        bindingHashes: fixtureHashes(bindings),
        policyMarker: policy.marker,
        pairs,
      },
      undefined,
      2,
    ),
  );
  console.log(`PROPAGATION_STAGED_PLAN ${descriptor}`);
  return 0;
}

function selectReviewedHeadlessPropagation(
  file: string,
  bindings: Record<string, string>,
  directory: string,
  options: { diagnostic?: RetainedDiagnostic; prepare: typeof prepareNativeResourceActor },
) {
  return options.diagnostic?.headless && options.prepare === prepareNativeResourceActor
    ? readHeadlessPropagation(file, bindings, directory)
    : undefined;
}

function readHeadlessPropagation(
  file: string,
  bindings: Record<string, string>,
  directory: string,
) {
  const descriptor = process.env.SAFEWORD_CODEX_PROPAGATION_PLAN;
  assert.ok(
    descriptor && nodePath.isAbsolute(descriptor),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: reviewed Codex propagation plan required',
  );
  const plan = JSON.parse(readFileSync(descriptor, 'utf8')) as HeadlessPropagationPlan;
  assert.equal(
    sha256(file),
    plan.fixtureMapSha256,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: staged fixture map differs',
  );
  assert.deepEqual(
    fixtureHashes(bindings),
    plan.bindingHashes,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: staged fixtures differ',
  );
  const staged = new ReviewedCodexPropagation(codexFixture(bindings), plan.pairs, directory);
  const [previous, inputs, current] = staged.revisions;
  assert.match(plan.policyMarker, /^VERIFICATION_[a-f0-9-]+$/u);
  const policyOwner = (revision: CanonicalCatalogueInputs) =>
    readFileSync(nodePath.join(revision.canonicalRoot, propagationVerificationOwner), 'utf8');
  assert.ok(
    policyOwner(inputs).includes(plan.policyMarker) &&
      !policyOwner(previous).includes(plan.policyMarker),
  );
  assert.equal(policyOwner(inputs), policyOwner(current));
  writeFileSync(
    nodePath.join(directory, 'codex-staged-plan.json'),
    JSON.stringify({ descriptor, sha256: sha256(descriptor), pairs: plan.pairs }, undefined, 2),
  );
  return { staged, previous, current, policy: { inputs, marker: plan.policyMarker } };
}

function recordPropagationInputs(
  directory: string,
  file: string,
  bindingHashes: Record<string, string>,
  revisions: {
    previous: CanonicalCatalogueInputs;
    current: CanonicalCatalogueInputs;
    policy?: { inputs: CanonicalCatalogueInputs; marker: string };
    diagnostic?: RetainedDiagnostic;
  },
) {
  const { previous, current, policy, diagnostic } = revisions;
  const controllerHashes = Object.fromEntries(
    [
      'resource-propagation-run.ts',
      'resource-propagation.ts',
      'propagation-policy-phases.ts',
      'propagation-policy-grade.ts',
      ...(diagnostic ? ['propagation-settings.ts'] : []),
      ...continuationSources(diagnostic),
    ].map(path => [path, sha256(nodePath.join(import.meta.dirname, path))]),
  );
  writeFileSync(
    nodePath.join(directory, 'inputs.json'),
    JSON.stringify(
      {
        source_head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        fixture_map_sha256: sha256(file),
        fixture_sha256: bindingHashes,
        controller_sha256: controllerHashes,
        ...(diagnostic && { diagnostic: diagnosticName(diagnostic) }),
        policy_marker: policy?.marker,
        canonical: [previous, ...(policy ? [policy.inputs] : []), current].map(inputs => ({
          ...inputs,
          files: Object.fromEntries(
            [
              'skills/explain/SKILL.md',
              'skills/explain/HOST_CONTRACT_GUIDE.md',
              'hooks/audit-principle-trace.ts',
              propagationVerificationOwner,
            ].map(path => [path, sha256(nodePath.join(inputs.canonicalRoot, path))]),
          ),
        })),
      },
      undefined,
      2,
    ),
  );
}

export async function runNativeResourcePropagation(
  component: 'resources' | 'policy-resources' = 'resources',
  trustDeadline?: number,
  prepare: typeof prepareNativeResourceActor = prepareNativeResourceActor,
  diagnostic?: RetainedDiagnostic,
  reportDirectory?: string,
) {
  assert.ok(
    !diagnostic || (diagnostic.retainedSettings && component === 'policy-resources'),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: retained settings require the policy-resource diagnostic',
  );
  const required = propagationLanes(diagnostic);
  const { file, bindings } = fixtureBindings(required);
  const directory =
    reportDirectory ?? mkdtempSync(nodePath.join(tmpdir(), 'safeword-native-propagation-'));
  const reviewed = selectReviewedHeadlessPropagation(file, bindings, directory, {
    diagnostic,
    prepare,
  });
  const { previous, current, policy } =
    reviewed ?? prepareNativePropagationInputs(directory, component === 'policy-resources');
  const bindingHashes = fixtureHashes(bindings);
  recordPropagationInputs(directory, file, bindingHashes, {
    previous,
    policy,
    current,
    diagnostic,
  });
  console.log(`PROPAGATION_NATIVE_ARTIFACTS ${directory}`);
  const propagation = await runResourcePropagation(
    previous,
    current,
    async (lane, inputs) => {
      const path = bindings[lane.id];
      assert.ok(
        path && nodePath.isAbsolute(path),
        'HOST_CONTRACT_PROOF_UNAVAILABLE: absolute owned fixture file required',
      );
      const fixture: unknown = JSON.parse(readFileSync(path, 'utf8'));
      assert.equal(
        sha256(path),
        bindingHashes[path],
        'HOST_CONTRACT_PROOF_UNAVAILABLE: fixture changed before preparation',
      );
      const actor = await prepare(
        lane,
        inputs,
        fixture,
        directory,
        reviewed?.staged ?? trustDeadline,
      );
      return captureNativePropagationActor(actor, lane.id, directory);
    },
    policy,
    diagnostic,
  );
  for (const [path, digest] of Object.entries(bindingHashes))
    assert.equal(
      sha256(path),
      digest,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: fixture binding changed during execution',
    );
  const result = {
    ...propagation,
    ...(reviewed && { codex_execution: 'reviewed-isolated-behavior' }),
  };
  writeFileSync(
    nodePath.join(directory, 'resource-results.json'),
    `${JSON.stringify(result, undefined, 2)}\n`,
  );
  return result;
}

function checkQualificationFixtures(): void {
  const required = propagationLanes(headless);
  const { bindings } = fixtureBindings(
    required,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: HEADLESS_QUALIFICATION_POPULATION_MISMATCH',
  );
  console.log(`HEADLESS_QUALIFICATION_TARGETS ${JSON.stringify(required.map(lane => lane.id))}`);
  for (const path of Object.values(bindings)) {
    assert.ok(
      typeof path === 'string' && nodePath.isAbsolute(path),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: HEADLESS_QUALIFICATION_FIXTURES_UNAVAILABLE',
    );
    const fixture: unknown = JSON.parse(readFileSync(path, 'utf8'));
    assert.ok(
      fixture &&
        typeof fixture === 'object' &&
        !Array.isArray(fixture) &&
        Object.keys(fixture).length > 0,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: HEADLESS_QUALIFICATION_FIXTURES_UNAVAILABLE',
    );
  }
}

function propagationDeadline(): number {
  const deadline = Number(process.env.SAFEWORD_PROPAGATION_DEADLINE);
  assert.ok(
    Number.isFinite(deadline) && deadline > Date.now(),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: outer deadline required',
  );
  return deadline;
}

async function runHeadlessQualification(): Promise<number> {
  checkQualificationFixtures();
  const result = await runNativeResourcePropagation(
    'policy-resources',
    propagationDeadline(),
    prepareNativeResourceActor,
    headless,
    process.argv[3],
  );
  return result.exit;
}

/** Source orchestration seam only; the actual CLI always uses the concrete factory. */
export async function nativeMain(
  prepare: typeof prepareNativeResourceActor = prepareNativeResourceActor,
) {
  try {
    if (process.argv[2] === 'headless-qualification') return await runHeadlessQualification();
    const headlessRun = process.argv[2] === 'headless';
    if (headlessRun && process.argv[3] === '--prepare') return prepareHeadlessPropagation();
    const component = headlessRun ? 'policy-resources' : process.argv[2];
    assert.ok(component === 'resources' || component === 'policy-resources');
    const result = await runNativeResourcePropagation(
      component,
      propagationDeadline(),
      prepare,
      headlessRun ? headless : undefined,
    );
    const expected =
      component === 'resources'
        ? 'native-resource-propagation-only'
        : 'native-policy-resource-propagation-only';
    assert.equal(
      result.scope,
      expected,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: requested propagation component incomplete',
    );
    return result.exit;
  } catch (error) {
    console.error(String(error));
    return nativePropagationExit(error);
  }
}

if (import.meta.main) process.exitCode = await nativeMain();
