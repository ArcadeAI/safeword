import combinations from '../../tests/fixtures/host-contract/documented-option-composition.json';
import { requireGrade } from './propagation-policy-phases.js';
import type {
  ArchitectureSetting,
  DesignApprovalObservation,
  DesignSettingObservation,
  HandoffObservation,
  HandoffSetting,
  PolicyObservation,
  PropagationLane,
  RetainedPolicyActor,
  RetainedResourceActor,
  TerminalObservation,
} from './resource-propagation.js';

const designProtocols: Record<string, DesignSettingObservation['protocol']> = {
  claude: 'pre-tool-json',
  codex: 'codex-pre-tool-json',
  cursor: 'permission-json',
  opencode: 'exit-status',
};

/** Join the existing graders on the controller's retained actors and identities. */
export async function runRetainedSettings(
  lanes: PropagationLane[],
  actors: Map<string, RetainedResourceActor>,
  identities: Map<string, string>,
  evidence: string,
) {
  const rows = [];
  for (const lane of lanes)
    rows.push(await retainedSettingsLane(lane, actors, identities, evidence));
  return rows;
}

async function retainedSettingsLane(
  lane: PropagationLane,
  actors: Map<string, RetainedResourceActor>,
  identities: Map<string, string>,
  evidence: string,
) {
  const actor = actors.get(lane.id) as RetainedPolicyActor | undefined;
  const installation = identities.get(lane.id);
  if (!actor || !installation || !Object.hasOwn(designProtocols, lane.agent))
    throw new Error(`HOST_CONTRACT_PROOF_UNAVAILABLE: settings actor ${lane.id}`);
  const supportsStop = settingsStopSupported(lane);
  const architecture = supportsStop ? await runArchitectureSettings(actor, evidence) : undefined;
  const handoff = supportsStop ? await runHandoffSettings(actor) : undefined;
  const design = await runDesignApprovalSettings(actor);
  requireSettingsBinding(lane, installation, {
    architecture: architecture?.observations ?? [],
    handoff: handoff?.observations ?? [],
    design: design.observations,
  });
  requireSettingsGrades(lane, [architecture, handoff, design]);
  return { lane: lane.id, installation, architecture, handoff, design };
}

function requireSettingsGrades(
  lane: PropagationLane,
  grades: ({ exit: number; failures: string[] } | undefined)[],
) {
  for (const grade of grades)
    if (grade)
      requireGrade({ ...grade, failures: grade.failures.map(failure => `${lane.id}:${failure}`) });
}

function settingsStopSupported(lane: PropagationLane) {
  return lane.agent !== 'opencode' && (lane.agent !== 'cursor' || lane.runtime === 'IDE');
}

function requireSettingsBinding(
  lane: PropagationLane,
  installation: string,
  observations: {
    architecture: PolicyObservation[];
    handoff: TerminalObservation[];
    design: DesignSettingObservation[];
  },
) {
  const expectedStop = lane.agent === 'cursor' ? 'cursor-stop' : 'stop-json';
  const protocolMatches =
    observations.architecture.every(row => row.protocol === expectedStop) &&
    observations.handoff.every(
      row => ('protocol' in row && row.protocol === 'cursor-stop') === (lane.agent === 'cursor'),
    ) &&
    observations.design.every(row => row.protocol === designProtocols[lane.agent]);
  requireGrade({
    exit: protocolMatches ? 0 : 2,
    failures: [`PROPAGATION_SETTINGS_PROTOCOL:${lane.id}`],
  });
  const identities = [
    ...observations.architecture.map(row => row.observation.installation),
    ...observations.handoff.map(row => row.installation),
    ...observations.design.map(row => row.observation.installation),
  ];
  requireGrade({
    exit: identities.every(Boolean) ? 0 : 3,
    failures: [`PROPAGATION_SETTINGS_IDENTITY_UNOBSERVED:${lane.id}`],
  });
  requireGrade({
    exit: identities.every(value => value === installation) ? 0 : 2,
    failures: [`PROPAGATION_INSTALLATION_REPLACED:${lane.id}`],
  });
}

/** Architecture outcome only: an earlier citation failure does not prove cross-model selection. */
export async function runArchitectureSettings(actor: RetainedPolicyActor, evidence: string) {
  const observations: PolicyObservation[] = [];
  const failures: string[] = [];
  let unavailable = false;
  let installation: string | undefined;
  for (const [index, options] of combinations.entries()) {
    const observed = await actor.observeVerification(evidence, evidence, {
      kind: 'architecture-review',
      options: { ...options },
    });
    observations.push(observed); // Preserve the concrete object and raw provenance.
    const prefix = `PROPAGATION_ARCHITECTURE_SETTING:${index}`;
    if (!observedStop(observed)) {
      unavailable = true;
      failures.push(`${prefix}:UNOBSERVED`);
      continue;
    }
    const actual = observed.observation;
    const config = actual.configuration;
    if (!config) {
      unavailable = true;
      failures.push(`${prefix}:CONFIGURATION_UNOBSERVED`);
      continue;
    }
    failures.push(
      ...architectureConfigFailures(observed, options).map(fault => `${prefix}:${fault}`),
    );
    installation ??= actual.installation;
    if (installation !== actual.installation) failures.push(`${prefix}:INSTALLATION_REPLACED`);

    if (!architectureOutcome(observed, options.architectureReviewGate))
      failures.push(`${prefix}:OUTCOME_MISMATCH`);
  }
  return {
    exit: unavailable ? 3 : Number(failures.length > 0) * 2,
    failures,
    observations,
    scope: 'stop-architecture-option-composition-only',
    admission_eligible: false,
  };
}

type ArchitectureObservation = Extract<
  PolicyObservation,
  { protocol: 'stop-json' | 'cursor-stop' }
>;

function architectureOutcome(observed: ArchitectureObservation, enabled: boolean) {
  const actual = observed.observation;
  // Feature/verify completion is not the task/done transition used by marker cases.
  if (!/^type: feature$/mu.test(actual.ticket) || !/^phase: verify$/mu.test(actual.ticket))
    return false;
  if (observed.protocol === 'cursor-stop') return cursorArchitectureOutcome(observed, enabled);
  return enabled
    ? observed.observation.decisions.some(
        row => row.decision === 'block' && row.reason?.includes('cited evidence'),
      )
    : observed.observation.decisions.every(row => !row.decision);
}

function architectureConfigFailures(
  observed: ArchitectureObservation,
  options: ArchitectureSetting['options'],
) {
  const config = observed.observation.configuration;
  const configured = JSON.parse(config?.bytes ?? '{}') as Record<string, unknown>;
  const failures = [];
  if (Object.entries(options).some(([key, value]) => configured[key] !== value))
    failures.push('CONFIGURATION_MISMATCH');
  if (
    observed.protocol === 'cursor-stop' &&
    observed.observation.configuration.after !== config?.bytes
  )
    failures.push('CONFIGURATION_CHANGED');
  return failures;
}
function cursorArchitectureOutcome(
  observed: Extract<PolicyObservation, { protocol: 'cursor-stop' }>,
  enabled: boolean,
) {
  const { stops: rows, cap } = observed.observation;
  if (rows.length !== 1 || rows[0]?.input.loop_count !== 0) return false;
  if (!enabled) return !rows[0].followup && !cap;
  return !!rows[0].followup?.includes('cited evidence') && cursorHostCapComplete(cap);
}

function cursorHostCapComplete(
  cap: Extract<PolicyObservation, { protocol: 'cursor-stop' }>['observation']['cap'],
) {
  return (
    !!cap &&
    cap.binding.loopLimit === 1 &&
    cap.skip.loop === 1 &&
    cap.skip.limit === 1 &&
    cap.response.input.hook_event_name === 'afterAgentResponse' &&
    !!cap.response.input.text?.trim()
  );
}

function observedStop(observed: PolicyObservation): observed is ArchitectureObservation {
  return (
    (observed.protocol === 'stop-json' || observed.protocol === 'cursor-stop') &&
    !!observed.observation.installation &&
    !!observed.observation.raw.trim() &&
    (observed.protocol === 'stop-json'
      ? observed.observation.decisions.length > 0
      : observed.observation.stops.length > 0 &&
        typeof observed.observation.configuration.after === 'string') &&
    !!observed.observation.configuration?.path &&
    !!observed.observation.configuration.bytes
  );
}

/** A fresh bounded trial on the retained Cursor actor, graded by the existing setting owner. */
export async function runCursorRetainedContinuation(actor: RetainedPolicyActor, evidence: string) {
  const options = combinations.find(row => row.architectureReviewGate && !row.crossModelReview);
  if (!options)
    throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: Cursor continuation options missing');
  const observed = await actor.observeVerification(evidence, evidence, {
    kind: 'architecture-review',
    options: { ...options },
  });
  if (!observedStop(observed) || observed.protocol !== 'cursor-stop')
    throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: Cursor continuation missing');
  if (!observed.observation.cap)
    throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: Cursor cap missing');
  const failures = architectureConfigFailures(observed, options);
  if (
    observed.observation.cap.response.input.conversation_id !==
    observed.observation.stops[0]?.input.conversation_id
  )
    failures.push('CURSOR_CONTINUATION_CONVERSATION');
  if (!architectureOutcome(observed, true)) failures.push('OUTCOME_MISMATCH');
  requireGrade({ exit: failures.length > 0 ? 2 : 0, failures });
  return observed.observation;
}

/** Existing native terminal path, six documented combinations then a history-isolation control. */
export async function runHandoffSettings(actor: RetainedPolicyActor) {
  if (!actor.observeHandoff)
    throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: terminal setting observation missing');
  const enabled = combinations.find(options => options.terminalHandoffCorrection);
  if (!enabled)
    throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: enabled terminal fixture missing');
  const cases = handoffCases(actor.handoffProtocol, enabled);
  const observations: TerminalObservation[] = [];
  const failures: string[] = [];
  let installation: string | undefined;
  let unavailable = false;
  for (const setting of cases) {
    const { index } = setting;
    const actual = await actor.observeHandoff({
      currentTool: setting.currentTool,
      options: { ...setting.options },
    });
    observations.push(actual);
    const grade = setting.currentTool
      ? handoffCompletion(actual, setting, installation)
      : Math.max(
          handoffCompletion(actual, setting, installation),
          cursorHandoffHistory(actual, observations.at(-2)),
        );
    if (grade === 3) unavailable = true;
    if (grade !== 0)
      failures.push(
        `PROPAGATION_HANDOFF_SETTING:${index}:${grade === 3 ? 'UNOBSERVED' : 'MISMATCH'}`,
      );
    installation ??= actual.installation;
  }
  return {
    exit: unavailable ? 3 : Number(failures.length > 0) * 2,
    failures,
    observations,
    caseIndices: cases.map(row => row.index),
    scope: 'terminal-correction-setting-component-only',
    admission_eligible: false,
  };
}

function handoffCases(protocol: 'cursor-stop' | undefined, enabled: HandoffSetting['options']) {
  const cases = combinations.map((options, index) => ({ options, index, currentTool: true }));
  // Cursor's cap skips Stop1, so the retained-history control must follow a correction-on edit.
  // Keep the original fixture indices and every combination; legacy host ordering is unchanged.
  if (protocol === 'cursor-stop') {
    const lastEnabled = cases.findLastIndex(row => row.options.terminalHandoffCorrection);
    const [correction] = cases.splice(lastEnabled, 1);
    if (correction) cases.push(correction);
  }
  cases.push({ options: enabled, index: combinations.length, currentTool: false });
  return cases;
}

function handoffCompletion(
  actual: TerminalObservation,
  setting: HandoffSetting,
  installation?: string,
) {
  if ('protocol' in actual) return cursorHandoffCompletion(actual, setting, installation);
  if (!handoffObserved(actual)) return 3;
  if (setting.currentTool !== Boolean(actual.helper)) return setting.currentTool ? 3 : 2;
  const config = JSON.parse(actual.configuration.bytes) as Record<string, unknown>;
  if (Object.entries(setting.options).some(([key, value]) => config[key] !== value)) return 2;
  if (installation && installation !== actual.installation) return 2;

  return correctHandoffDecisions(
    actual.decisions,
    setting.options.terminalHandoffCorrection && setting.currentTool,
  )
    ? 0
    : 2;
}

type CursorHandoff = Extract<TerminalObservation, { protocol: 'cursor-stop' }>;
function cursorHandoffCompletion(
  actual: CursorHandoff,
  setting: HandoffSetting,
  installation?: string,
) {
  if (!cursorHandoffObserved(actual)) return 3;
  if (!cursorHandoffConfig(actual, setting, installation)) return 2;
  const editGrade = cursorEditCompletion(actual, setting.currentTool);
  if (editGrade !== 0) return editGrade;
  return cursorHandoffOutcome(
    actual,
    setting.options.terminalHandoffCorrection && setting.currentTool,
  );
}
function cursorHandoffOutcome(actual: CursorHandoff, correction: boolean) {
  const first = actual.stops[0];
  if (actual.stops.length !== 1 || first?.input.loop_count !== 0) return 2;
  if (!correction) return !first.followup && !actual.cap ? 0 : 2;
  if (!isTerminalCorrection(first.followup)) return 2;
  if (!actual.cap) return 3;
  return cursorHandoffCap(actual) ? 0 : 2;
}
function isTerminalCorrection(message: string | undefined) {
  return !!message?.includes('terminal-handoff/v1 correction');
}
function cursorHandoffConfig(
  actual: CursorHandoff,
  setting: HandoffSetting,
  installation?: string,
) {
  const configured = JSON.parse(actual.configuration.bytes) as Record<string, unknown>;
  return (
    Object.entries(setting.options).every(([key, value]) => configured[key] === value) &&
    actual.configuration.after === actual.configuration.bytes &&
    (!installation || installation === actual.installation)
  );
}
function cursorHandoffObserved(actual: CursorHandoff) {
  const first = actual.stops[0];
  return (
    !!actual.raw.trim() &&
    !!actual.installation &&
    !!actual.configuration?.path &&
    !!actual.configuration.bytes &&
    !!first?.input.conversation_id &&
    !!first.input.generation_id
  );
}
function cursorEditCompletion(actual: CursorHandoff, current: boolean) {
  const edit = actual.edit;
  if (!current) return edit || actual.fileEffect.before !== actual.fileEffect.after ? 2 : 0;
  if (!edit) return 3;
  if (!cursorEditBound(actual, edit)) return 3;
  return edit.before !== edit.after && edit.after === edit.expected ? 0 : 2;
}
function cursorEditBound(actual: CursorHandoff, edit: NonNullable<CursorHandoff['edit']>) {
  const first = actual.stops[0];
  return (
    !!first &&
    !!edit.callback.raw &&
    edit.callback.input.conversation_id === first.input.conversation_id &&
    edit.callback.input.generation_id === first.input.generation_id
  );
}
function cursorHandoffCap(actual: CursorHandoff) {
  const cap = actual.cap;
  return (
    cursorHostCapComplete(cap) && !!cap?.window && !!cap.skip.raw && cursorAutomaticReply(actual)
  );
}
function cursorAutomaticReply(actual: CursorHandoff) {
  const first = actual.stops[0],
    response = actual.cap?.response;
  if (!first || !response) return false;
  return (
    response.exit === 0 &&
    response.input.conversation_id === first.input.conversation_id &&
    !!response.input.generation_id &&
    response.input.generation_id !== first.input.generation_id &&
    response.input.cursor_version === first.input.cursor_version &&
    JSON.stringify(response.input.workspace_roots) === JSON.stringify(first.input.workspace_roots)
  );
}
function cursorHandoffHistory(
  actual: TerminalObservation,
  previous: TerminalObservation | undefined,
) {
  if (!('protocol' in actual)) return 0;
  if (!previous || !('protocol' in previous) || !previous.edit) return 3;
  if (!cursorHandoffOutcome(previous, true) && previous.cap)
    return sameHistoryTurn(actual.stops[0], previous.stops[0]) ? 0 : 3;
  return 3;
}

function sameHistoryTurn(
  first: CursorHandoff['stops'][number] | undefined,
  prior: CursorHandoff['stops'][number] | undefined,
) {
  if (!first || !prior) return false;
  return (
    first.input.conversation_id === prior.input.conversation_id &&
    first.input.generation_id !== prior.input.generation_id
  );
}

function correctHandoffDecisions(decisions: HandoffObservation['decisions'], correction: boolean) {
  if (!correction) return decisions.length === 1 && Object.keys(decisions[0] ?? {}).length === 0;
  return (
    decisions.length === 2 &&
    decisions[0]?.decision === 'block' &&
    !!decisions[0].reason?.includes('terminal-handoff/v1 correction') &&
    Object.keys(decisions[1] ?? {}).length === 0
  );
}

function handoffObserved(actual: HandoffObservation) {
  return (
    !!actual.installation &&
    !!actual.raw.trim() &&
    !!actual.configuration?.path &&
    !!actual.configuration.bytes &&
    actual.decisions.length > 0 &&
    actual.decisions.every(row => row && typeof row === 'object' && !Array.isArray(row))
  );
}

/** Existing native Write transition, six documented combinations; not a Stop path. */
export async function runDesignApprovalSettings(actor: RetainedPolicyActor) {
  if (!actor.observeDesignApproval)
    throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: design setting observation missing');
  const observations: DesignSettingObservation[] = [];
  const failures: string[] = [];
  const fingerprint = JSON.stringify(actor.fingerprint());
  let installation: string | undefined;
  let unavailable = false;
  for (const [index, options] of combinations.entries()) {
    const actual = await actor.observeDesignApproval({ ...options });
    observations.push(actual);
    const grade = designApprovalOutcome(actual, options, installation);
    if (grade === 3) unavailable = true;
    if (grade !== 0)
      failures.push(
        `PROPAGATION_DESIGN_SETTING:${index}:${grade === 3 ? 'UNOBSERVED' : 'MISMATCH'}`,
      );
    if (JSON.stringify(actor.fingerprint()) !== fingerprint)
      failures.push(`PROPAGATION_DESIGN_SETTING:${index}:PAYLOAD_CHANGED`);
    installation ??= actual.observation.installation;
  }
  return {
    exit: unavailable ? 3 : Number(failures.length > 0) * 2,
    failures,
    observations,
    scope: 'pre-action-write-design-setting-component-only',
    admission_eligible: false,
  };
}

function designApprovalOutcome(
  actual: DesignSettingObservation,
  options: ArchitectureSetting['options'],
  installation?: string,
) {
  if (!designObserved(actual)) return 3;
  const observed = actual.observation;
  if (actual.protocol === 'codex-pre-tool-json') {
    const config_ = actual.observation.configuration;
    const outcome = codexConfigOutcome(config_);
    if (outcome) return outcome;
  }
  const config = JSON.parse(observed.configuration.bytes) as Record<string, unknown>;
  if (Object.entries(options).some(([key, value]) => config[key] !== value)) return 2;
  if (installation && installation !== observed.installation) return 2;
  if (actual.protocol === 'permission-json')
    return cursorDesignOutcome(actual.observation, options.designApprovalGate);
  if (actual.protocol === 'exit-status')
    return exitStatusDesignOutcome(actual.observation, options.designApprovalGate);
  return designWriteMatches(actual.observation, options) ? 0 : 2;
}

function codexConfigOutcome(config: { bytes: string; after?: string }) {
  if (typeof config.after !== 'string') return 3;
  return config.after === config.bytes ? 0 : 2;
}

function cursorDesignOutcome(
  o: Extract<DesignSettingObservation, { protocol: 'permission-json' }>['observation'],
  enabled: boolean,
) {
  if (o.configuration.after !== o.configuration.bytes) return 2;
  if (!enabled) return o.decision.permission === 'allow' && o.effect === o.expectedEffect ? 0 : 2;
  const reason = o.decision.user_message ?? o.decision.agent_message ?? '';
  return o.decision.permission === 'deny' &&
    /design approval.*approve-plan/isu.test(reason) &&
    o.effect === o.before
    ? 0
    : 2;
}

function exitStatusDesignOutcome(
  observed: Extract<DesignSettingObservation, { protocol: 'exit-status' }>['observation'],
  enabled: boolean,
) {
  const row = observed.observations[0];
  if (observed.observations.length !== 1 || !row || [0, 2].every(status => status !== row.status))
    return 3;
  if (enabled)
    return row.status === 2 &&
      /design approval.*approve-plan/isu.test(row.stderr) &&
      observed.effect === observed.before
      ? 0
      : 2;
  return row.status === 0 && observed.effect === observed.expectedEffect ? 0 : 2;
}

function designObserved(actual: DesignSettingObservation) {
  const o = actual.observation;
  return (
    ['pre-tool-json', 'codex-pre-tool-json', 'exit-status', 'permission-json'].includes(
      actual.protocol,
    ) &&
    Boolean(
      o.installation &&
      o.raw.trim() &&
      o.configuration?.path &&
      o.configuration.bytes &&
      o.before &&
      o.expectedEffect,
    ) &&
    typeof o.effect === 'string'
  );
}

function designWriteMatches(
  observed: DesignApprovalObservation['observation'],
  options: ArchitectureSetting['options'],
) {
  const decision = observed.decision.hookSpecificOutput;
  if (options.designApprovalGate)
    return (
      decision?.hookEventName === 'PreToolUse' &&
      decision.permissionDecision === 'deny' &&
      /design approval.*approve-plan/isu.test(decision.permissionDecisionReason ?? '') &&
      observed.effect === observed.before
    );
  return (
    [undefined, 'allow'].includes(decision?.permissionDecision) &&
    observed.effect === observed.expectedEffect
  );
}
