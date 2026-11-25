import assert from 'node:assert/strict';

import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import type {
  CursorArchitectureCap,
  nativeArchitectureStops,
  nativeHandoffEdit,
} from '../../tests/helpers/cursor-native-observations.js';
import type { CanonicalCatalogueInputs } from '../../tests/helpers/native-catalogue-probe.js';
import type { PropagationArchitectureCase } from '../../tests/helpers/propagation-policy-case.js';
import type { PropagationGrade } from './propagation-policy-grade.js';
import {
  PropagationOutcomeError,
  requireGrade,
  RetainedPolicyPhases,
} from './propagation-policy-phases.js';
import { runCursorRetainedContinuation, runRetainedSettings } from './propagation-settings.js';

export interface PropagationLane {
  id: string;
  agent: string;
  version: string;
  runtime: string;
  delivery: string;
}
type Markers = Pick<CanonicalCatalogueInputs, 'workflowMarker' | 'guideMarker' | 'helperMarker'>;
export interface ResourceObservation {
  lane: string;
  delivery: string;
  markers: Markers;
}

/** Integration-owned release metadata owns population; no caller host list. */
export function propagationLanes(scope?: { headless?: true }): PropagationLane[] {
  return Object.values(hostReleases).flatMap(target =>
    target.runtimes
      .filter(runtime => !scope?.headless || runtime !== 'IDE')
      .flatMap(runtime =>
        (target.delivery_variants ?? ['native']).map(delivery => ({
          id: `${target.agent}@${target.version}/${runtime}/${delivery}`,
          agent: target.agent,
          version: target.version,
          runtime,
          delivery,
        })),
      ),
  );
}

/** Diagnostic completion only, never an evidence importer/admission writer. */
export function resourceCompletion(
  required: readonly PropagationLane[],
  expected: Markers,
  observations: readonly ResourceObservation[],
) {
  const failures: string[] = [];
  let unavailable = false;
  const ids = new Set(required.map(lane => lane.id));
  for (const observation of observations) {
    if (!ids.has(observation.lane)) failures.push(`PROPAGATION_LANE_EXTRA:${observation.lane}`);
  }
  for (const lane of required) {
    const matches = observations.filter(row => row.lane === lane.id);
    if (matches.length !== 1) {
      failures.push(`PROPAGATION_LANE_COUNT:${lane.id}:${matches.length}`);
      continue;
    }
    const match = matches[0];
    assert.ok(match);
    if (match.delivery !== lane.delivery) {
      unavailable = true;
      failures.push(`PROPAGATION_DELIVERY_UNOBSERVED:${lane.id}`);
      continue;
    }
    const actual = match.markers;
    if (
      actual.workflowMarker !== expected.workflowMarker ||
      actual.guideMarker !== expected.guideMarker ||
      actual.helperMarker !== expected.helperMarker
    )
      failures.push(`PROPAGATION_RESOURCE_STALE:${lane.id}`);
  }
  const exit = unavailable ? 3 : Number(failures.length > 0) * 2;
  return { exit, failures };
}

export interface RetainedResourceActor {
  refreshResources(inputs: CanonicalCatalogueInputs): Promise<void>;
  observe(): Promise<Omit<ResourceObservation, 'lane'> & { installation: string; raw: string }>;
  close?(): void;
}

interface PolicyObservationBase {
  installation: string;
  raw: string;
}
/** Keep native protocols distinct; the required grader owns their expectations. */
export type PolicyObservation =
  | {
      protocol: 'cursor-stop';
      observation: PolicyObservationBase & {
        stops: readonly {
          input: { loop_count?: number; conversation_id?: string };
          followup?: string;
        }[];
        cap?: CursorArchitectureCap;
        ticket: string;
        rawPath: string;
        origin?: string;
        configuration: { path: string; bytes: string; after: string };
      };
    }
  | {
      protocol: 'stop-json';
      observation: PolicyObservationBase & {
        decisions: readonly { decision?: string; reason?: string }[];
        ticket: string;
        configuration?: { path: string; bytes: string };
      };
    }
  | {
      protocol: 'permission-json';
      observation: PolicyObservationBase & {
        decision: { permission?: string; user_message?: string; agent_message?: string };
        effect?: string;
        expectedEffect: string;
        afterShellCount?: number;
      };
    }
  | {
      protocol: 'exit-status';
      observation: PolicyObservationBase & {
        observations: readonly { status: number | null; stdout: string; stderr: string }[];
        effect?: string;
        expectedEffect: string;
      };
    };

export interface ArchitectureSetting {
  kind: 'architecture-review';
  options: PropagationArchitectureCase['options'];
}

/** Terminal correction is not a ticket transition or a PreToolUse denial. */
export interface HandoffSetting {
  options: PropagationArchitectureCase['options'];
  currentTool: boolean;
}
export interface HandoffObservation {
  installation: string;
  raw: string;
  configuration: { path: string; bytes: string };
  decisions: readonly { decision?: string; reason?: string }[];
  helper?: { marker: string; origin: string };
}

/** Cursor reports one managed followup and the host's capped automatic reply. */
export interface CursorHandoffObservation {
  helper?: never;
  decisions?: never;
  fileEffect: { path: string; before: string; after: string };
  protocol: 'cursor-stop';
  installation: string;
  raw: string;
  configuration: { path: string; bytes: string; after: string };
  stops: ReturnType<typeof nativeArchitectureStops>;
  cap?: CursorArchitectureCap;
  edit?: ReturnType<typeof nativeHandoffEdit> & { before: string; after: string; expected: string };
}
export type TerminalObservation = HandoffObservation | CursorHandoffObservation;

/** Claude's actual Write PreToolUse JSON; never a Stop decision. */
export interface DesignApprovalObservation {
  protocol: 'pre-tool-json';
  observation: PolicyObservationBase & {
    configuration: { path: string; bytes: string };
    decision: {
      hookSpecificOutput?: {
        hookEventName?: string;
        permissionDecision?: string;
        permissionDecisionReason?: string;
      };
    };
    effect: string;
    before: string;
    expectedEffect: string;
  };
}

/** OpenCode's registered SDK callback invokes the shared PreToolUse dispatcher. */
export interface ExitStatusDesignApprovalObservation {
  protocol: 'exit-status';
  observation: PolicyObservationBase & {
    configuration: { path: string; bytes: string };
    observations: readonly { status: number | null; stdout: string; stderr: string }[];
    effect: string;
    before: string;
    expectedEffect: string;
  };
}
export type DesignSettingObservation =
  | DesignApprovalObservation
  | ExitStatusDesignApprovalObservation
  | CursorDesignApprovalObservation
  | CodexDesignApprovalObservation;

/** Actual Codex PreToolUse JSON, with turn configuration captured on both sides. */
export interface CodexDesignApprovalObservation {
  protocol: 'codex-pre-tool-json';
  observation: DesignApprovalObservation['observation'] & {
    configuration: { path: string; bytes: string; after: string };
  };
}

/** Cursor's real preToolUse permission JSON, distinct from Claude's hook JSON. */
export interface CursorDesignApprovalObservation {
  protocol: 'permission-json';
  observation: PolicyObservationBase & {
    configuration: { path: string; bytes: string; after: string };
    decision: { permission?: string; user_message?: string; agent_message?: string };
    before: string;
    effect: string;
    expectedEffect: string;
  };
}

export interface RetainedPolicyActor extends RetainedResourceActor {
  observeContinuation?: () => Promise<{ installation: string; raw: string }>;
  assertContinuation?: () => void;
  handoffProtocol?: 'cursor-stop';
  observeDesignApproval?(
    options: ArchitectureSetting['options'],
  ): Promise<DesignSettingObservation>;
  observeHandoff?(setting: HandoffSetting): Promise<TerminalObservation>;
  observeVerification(
    evidence: string,
    validSetupEvidence: string,
    setting?: ArchitectureSetting,
  ): Promise<PolicyObservation>;
  fingerprint(): { resources: string[]; policy: string };
}

async function refreshActors(
  actors: Map<string, RetainedResourceActor>,
  inputs: CanonicalCatalogueInputs,
  except?: string,
) {
  for (const [id, actor] of actors) if (id !== except) await actor.refreshResources(inputs);
}

function closeActors(actors: Map<string, RetainedResourceActor>) {
  for (const actor of actors.values()) actor.close?.();
}

function requireStaleControl(actual: PropagationGrade, lane: string) {
  if (actual.exit === 3) requireGrade(actual);
  const expected = { exit: 2, failures: [`PROPAGATION_RESOURCE_STALE:${lane}`] };
  requireGrade({
    exit: JSON.stringify(actual) === JSON.stringify(expected) ? 0 : 2,
    failures: ['STALE_PROPAGATION_LANE_ACCEPTED', ...actual.failures],
  });
}

function propagationFailure(
  error: unknown,
  policyRun: RetainedPolicyPhases | undefined,
  required: PropagationLane[],
  resources: {
    baseline: ResourceObservation[];
    held_back: ResourceObservation[];
    repaired: ResourceObservation[];
  },
) {
  if (!policyRun) throw error;
  const grade =
    error instanceof PropagationOutcomeError ? error.grade : { exit: 3, failures: [String(error)] };
  return {
    purpose: 'diagnostic-only',
    admission_eligible: false,
    required,
    policy: policyRun.observations,
    scope: 'native-policy-resource-propagation-only',
    ...resources,
    rejected: undefined,
    ...grade,
  };
}

function assertObservedContinuation(actor: RetainedPolicyActor) {
  try {
    actor.assertContinuation?.();
  } catch (error) {
    const message = String(error);
    if (
      !message.includes('HOST_CONTRACT_PROOF_UNAVAILABLE') &&
      (error instanceof assert.AssertionError ||
        message.includes('HOST_CONTINUATION_MISSING') ||
        message.includes('CONTINUATION_BOUND_EXCEEDED'))
    )
      throw new PropagationOutcomeError({ exit: 2, failures: [message] });
    throw error;
  }
}

async function retainedContinuation(
  agent: 'codex' | 'claude',
  lanes: PropagationLane[],
  actors: Map<string, RetainedResourceActor>,
  identities: Map<string, string>,
) {
  const lane = lanes.find(row => row.agent === agent);
  assert.ok(lane, `HOST_CONTRACT_PROOF_UNAVAILABLE: ${agent} lane missing`);
  const actor = actors.get(lane.id) as RetainedPolicyActor | undefined;
  assert.ok(
    actor?.observeContinuation && actor.assertContinuation,
    `HOST_CONTRACT_PROOF_UNAVAILABLE: retained ${agent === 'codex' ? 'Codex' : 'Claude'} continuation missing`,
  );
  const continuation = await actor.observeContinuation();
  requireGrade({
    exit: continuation.installation === identities.get(lane.id) ? 0 : 2,
    failures: [`PROPAGATION_INSTALLATION_REPLACED:${lane.id}`],
  });
  assertObservedContinuation(actor);
  return continuation;
}

export type RetainedDiagnostic = {
  retainedSettings: true;
  headless?: true;
  retainedCodexContinuation?: true;
  retainedClaudeContinuation?: true;
  retainedCursorContinuation?: true;
};

async function retainedCursorContinuations(
  lanes: PropagationLane[],
  actors: Map<string, RetainedResourceActor>,
  identities: Map<string, string>,
  evidence: string,
  settings: Awaited<ReturnType<typeof runRetainedSettings>>,
) {
  const targets = lanes.filter(row => row.agent === 'cursor' && row.runtime === 'IDE');
  assert.deepEqual(
    targets.map(row => row.delivery).toSorted((a, b) => a.localeCompare(b)),
    ['native', 'project-hooks'],
  );
  const results = [];
  for (const lane of targets) {
    const actor = actors.get(lane.id) as RetainedPolicyActor | undefined;
    assert.ok(actor, 'HOST_CONTRACT_PROOF_UNAVAILABLE: Cursor actor missing');
    const observation = await runCursorRetainedContinuation(actor, evidence);
    const prior = settings
      .find(row => row.lane === lane.id)
      ?.architecture?.observations.find(row => row.protocol === 'cursor-stop');
    const origin = prior?.observation.origin;
    assert.ok(
      origin && observation.origin,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: Cursor origin missing',
    );
    requireGrade({
      exit: observation.origin === origin ? 0 : 2,
      failures: [`CURSOR_CONTINUATION_ORIGIN:${lane.id}`],
    });
    requireGrade({
      exit: observation.installation === identities.get(lane.id) ? 0 : 2,
      failures: [`PROPAGATION_INSTALLATION_REPLACED:${lane.id}`],
    });
    results.push({ lane: lane.id, installation: observation.installation, observation });
  }
  return results;
}

async function retainedSettingsOption(
  options: RetainedDiagnostic | undefined,
  policy: { inputs: CanonicalCatalogueInputs; marker: string } | undefined,
  lanes: PropagationLane[],
  actors: Map<string, RetainedResourceActor>,
  identities: Map<string, string>,
) {
  if (!options) return {};
  if (!policy) throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: settings policy missing');
  const evidence = `**PR Scope:** ✅ Synthetic fixture matches its scope\n\n${policy.marker}\n`;
  const settings = await runRetainedSettings(lanes, actors, identities, evidence);
  const continuation = options.retainedCodexContinuation
    ? await retainedContinuation('codex', lanes, actors, identities)
    : undefined;
  const claudeContinuation = options.retainedClaudeContinuation
    ? await retainedContinuation('claude', lanes, actors, identities)
    : undefined;
  const cursorContinuation = options.retainedCursorContinuation
    ? await retainedCursorContinuations(lanes, actors, identities, evidence, settings)
    : undefined;
  return {
    settings,
    ...(continuation && { continuation }),
    ...(claudeContinuation && { claudeContinuation }),
    ...(cursorContinuation && { cursorContinuation }),
  };
}

export async function runResourcePropagation(
  previous: CanonicalCatalogueInputs,
  current: CanonicalCatalogueInputs,
  prepare: (
    lane: PropagationLane,
    inputs: CanonicalCatalogueInputs,
  ) => Promise<RetainedResourceActor>,
  policy?: { inputs: CanonicalCatalogueInputs; marker: string },
  options?: RetainedDiagnostic,
) {
  const required = propagationLanes(options);
  assert.equal(new Set(required.map(row => row.id)).size, required.length);
  const actors = new Map<string, RetainedResourceActor>();
  const identities = new Map<string, string>();
  const resources = {
    baseline: [] as ResourceObservation[],
    held_back: [] as ResourceObservation[],
    repaired: [] as ResourceObservation[],
  };
  const policyRun = policy
    ? new RetainedPolicyPhases(required, actors, identities, policy)
    : undefined;
  const observe = async (lane: PropagationLane): Promise<ResourceObservation> => {
    const actor = actors.get(lane.id);
    assert.ok(actor);
    const result = await actor.observe();
    assert.ok(
      result.raw && result.installation,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: resource observation missing',
    );
    assert.ok(
      Object.values(result.markers).every(value => typeof value === 'string' && value.length > 0),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: resource markers missing',
    );
    const initial = identities.get(lane.id);
    if (initial === undefined) identities.set(lane.id, result.installation);
    else
      requireGrade({
        exit: result.installation === initial ? 0 : 2,
        failures: [`PROPAGATION_INSTALLATION_REPLACED:${lane.id}`],
      });
    return { lane: lane.id, ...result };
  };
  const all = async () => {
    const rows: ResourceObservation[] = [];
    for (const lane of required) rows.push(await observe(lane));
    return rows;
  };
  try {
    const baseline = resources.baseline;
    for (const lane of required) {
      actors.set(lane.id, await prepare(lane, previous));
      baseline.push(await observe(lane));
    }
    requireGrade(resourceCompletion(required, previous, baseline));
    await policyRun?.start();
    const staleLane = required.at(-1);
    assert.ok(staleLane);
    // Actually omit one refresh. Do not rebuild an old package in a new installation.
    await refreshActors(actors, current, staleLane.id);
    const heldBack = await all();
    resources.held_back = heldBack;
    const rejected = resourceCompletion(required, current, heldBack);
    requireStaleControl(rejected, staleLane.id);
    await refreshActors(actors, current);
    const repaired = await all();
    resources.repaired = repaired;
    requireGrade(resourceCompletion(required, current, repaired));
    await policyRun?.finish();
    const settings = await retainedSettingsOption(options, policy, required, actors, identities);
    return {
      exit: 0,
      failures: [] as string[],
      policy: policyRun?.observations,
      ...settings,
      purpose: 'diagnostic-only',
      admission_eligible: false,
      scope: policyRun
        ? 'native-policy-resource-propagation-only'
        : 'native-resource-propagation-only',
      required,
      baseline,
      held_back: heldBack,
      rejected,
      repaired,
    };
  } catch (error) {
    return propagationFailure(error, policyRun, required, resources);
  } finally {
    closeActors(actors);
  }
}
