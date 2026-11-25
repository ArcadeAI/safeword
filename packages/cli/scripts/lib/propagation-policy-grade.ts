import type { PolicyObservation, PropagationLane } from './resource-propagation.js';

export interface PolicyRow {
  lane: string;
  observed: PolicyObservation;
}
export interface PropagationGrade {
  exit: number;
  failures: string[];
}

function stopDecision(
  rows: readonly { decision?: string; reason?: string }[],
  denied: boolean,
  marker: string,
) {
  if (!denied) return rows.length === 1 && Object.keys(rows[0] ?? {}).length === 0;
  return (
    rows.length <= 2 &&
    rows[0]?.decision === 'block' &&
    rows[0].reason?.includes(marker) &&
    rows.slice(1).every(row => Object.keys(row).length === 0)
  );
}

function stopOutcome(
  observation: Extract<PolicyObservation, { protocol: 'stop-json' }>['observation'],
  denied: boolean,
  marker: string,
) {
  const rows = observation.decisions;
  if (!Array.isArray(rows) || rows.length === 0 || typeof observation.ticket !== 'string') return 3;
  if (rows.some(row => !row || typeof row !== 'object')) return 3;
  const status = denied ? /^status: in_progress$/mu : /^status: done$/mu;
  return stopDecision(rows, denied, marker) && status.test(observation.ticket) ? 0 : 2;
}

function permissionShape(
  value: Extract<PolicyObservation, { protocol: 'permission-json' }>['observation'],
  lane: PropagationLane,
) {
  if (!value.decision || !['allow', 'deny'].includes(value.decision.permission ?? '')) return false;
  return lane.runtime !== 'IDE' || typeof value.afterShellCount === 'number';
}

function permissionOutcome(
  value: Extract<PolicyObservation, { protocol: 'permission-json' }>['observation'],
  denied: boolean,
  lane: PropagationLane,
) {
  if (!permissionShape(value, lane)) return 3;
  if (value.decision.permission !== (denied ? 'deny' : 'allow')) return 2;
  if (
    denied &&
    !(value.decision.user_message ?? value.decision.agent_message ?? '').includes(
      'invalid verification evidence',
    )
  )
    return 2;
  return 0;
}

function exitOutcome(
  value: Extract<PolicyObservation, { protocol: 'exit-status' }>['observation'],
  denied: boolean,
) {
  const rows = value.observations;
  if (!Array.isArray(rows) || !rows[0]) return 3;
  if (![0, 2].includes(rows[0].status as number)) return 3;
  if (typeof rows[0].stderr !== 'string') return 3;
  if (rows.length !== 1 || rows[0].status !== (denied ? 2 : 0)) return 2;
  return denied && !rows[0].stderr.includes('invalid verification evidence') ? 2 : 0;
}

function afterShellMatches(
  observed: Exclude<PolicyObservation, { protocol: 'stop-json' | 'cursor-stop' }>,
  lane: PropagationLane,
  denied: boolean,
) {
  if (lane.runtime !== 'IDE') return true;
  if (observed.protocol !== 'permission-json') return false;
  return observed.observation.afterShellCount === (denied ? 0 : 1);
}

function actionOutcome(
  observed: Exclude<PolicyObservation, { protocol: 'stop-json' | 'cursor-stop' }>,
  denied: boolean,
  lane: PropagationLane,
) {
  const value = observed.observation;
  if (typeof value.expectedEffect !== 'string' || !value.expectedEffect) return 3;
  const decision =
    observed.protocol === 'exit-status'
      ? exitOutcome(observed.observation, denied)
      : permissionOutcome(observed.observation, denied, lane);
  if (decision) return decision;
  const effect = denied ? value.effect === undefined : value.effect === value.expectedEffect;
  const after = afterShellMatches(observed, lane, denied);
  return effect && after ? 0 : 2;
}

function expectedProtocol(lane: PropagationLane) {
  if (lane.agent === 'cursor') return 'permission-json';
  if (lane.agent === 'opencode') return 'exit-status';
  return 'stop-json';
}

function lanePolicyGrade(
  lane: PropagationLane,
  rows: readonly PolicyRow[],
  denied: boolean,
  marker: string,
) {
  const matches = rows.filter(row => row.lane === lane.id);
  const observed = matches[0]?.observed;
  if (matches.length !== 1 || !observed?.observation?.raw || !observed.observation.installation)
    return 3;
  if (observed.protocol === 'cursor-stop' || observed.protocol !== expectedProtocol(lane)) return 3;
  return observed.protocol === 'stop-json'
    ? stopOutcome(observed.observation, denied, marker)
    : actionOutcome(observed, denied, lane);
}

/** Expectations belong here, never in the concrete actor's observation input. */
export function policyCompletion(
  required: readonly PropagationLane[],
  rows: readonly PolicyRow[],
  denied: boolean,
  marker: string,
): PropagationGrade {
  const failures: string[] = [];
  let exit = 0;
  for (const lane of required) {
    const code = lanePolicyGrade(lane, rows, denied, marker);
    if (code)
      failures.push(`PROPAGATION_POLICY_${code === 3 ? 'UNOBSERVED' : 'MISMATCH'}:${lane.id}`);
    exit = Math.max(exit, code);
  }
  if (rows.some(row => required.every(lane => lane.id !== row.lane))) {
    exit = 3;
    failures.push('PROPAGATION_POLICY_EXTRA');
  }
  return { exit, failures };
}
