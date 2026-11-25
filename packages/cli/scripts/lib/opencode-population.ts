import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  hostContractFeature,
  nativeCases,
} from '../../tests/fixtures/host-contract/native-contract-cases.js';

type Kind =
  | 'allowed-write'
  | 'denied-write'
  | 'catalogue-helper'
  | 'worker'
  | 'required-worker'
  | 'required-registration'
  | 'optional-registration'
  | 'commands'
  | 'coexistence';
const failureCodes: Record<Kind, string[]> = {
  'allowed-write': ['ALLOWED_SIDE_EFFECT_MISSING', 'NATIVE_OPENCODE_V2_GUARD_MISSING'],
  'denied-write': ['DENIED_SIDE_EFFECT_OBSERVED', 'NATIVE_OPENCODE_V2_GUARD_MISSING'],
  'catalogue-helper': ['NATIVE_OPENCODE_V2_CATALOGUE_MISSING', 'NATIVE_HELPER_ORIGIN_MISMATCH'],
  worker: ['V2_WORKER_CONTEXT_LEAK', 'V2_WORKER_FORBIDDEN_ACTION'],
  'required-worker': ['V2_REQUIRED_REGISTRATION_STILL_ACTIVE'],
  'required-registration': [
    'V2_REQUIRED_HOST_SCHEMA_REJECTION_MISSING',
    'V2_REQUIRED_STATUS_BINDING_MISSING',
  ],
  'optional-registration': [
    'V2_OPTIONAL_FAILURE_HIDES_GUARD',
    'V2_OPTIONAL_STATUS_BINDING_MISSING',
    'NATIVE_REGISTRATION_RESOURCE_ORIGIN_MISMATCH',
  ],
  commands: [
    'NATIVE_OPENCODE_V2_COMMAND_MISSING',
    'NATIVE_COMMAND_ARGUMENT_MISSING',
    'NATIVE_COMMAND_DISPATCH_MISSING',
    'NATIVE_HELPER_ORIGIN_MISMATCH',
  ],
  coexistence: [
    'RETIRED_PLUGIN_EXECUTED_IN_V2',
    'V2_ENROLLED_GUARD_MISSING',
    'V2_FOREIGN_PROJECT_ENROLLED',
    'V2_FOREIGN_PROJECT_DISPATCHED',
  ],
};
export interface OpenCodeCase {
  id: string;
  host: 'OpenCode V2';
  version: string;
  runtime: 'CLI' | 'TUI';
  kind: Kind;
  authority: string;
}
const featureKinds: Record<string, Kind> = {
  'A denied action has no side effect': 'denied-write',
  'An allowed action reaches the side-effect boundary': 'allowed-write',
  'Native delivery exposes the contracted catalogue': 'catalogue-helper',
};
/** PR2 policy supplements expand across independently pinned targets; feature rows stay complete. */
const v2Policy = [
  ['v2-worker-fresh-context', 'worker'],
  ['v2-worker-forbidden-action', 'worker'],
  ['v2-required-worker-registration', 'required-worker'],
  ['v2-required-registration', 'required-registration'],
  ['v2-optional-registration', 'optional-registration'],
  ['commands', 'commands'],
] as const;
export function openCodePopulation(
  source = readFileSync(hostContractFeature, 'utf8'),
): OpenCodeCase[] {
  const result = (['OpenCode V2'] as const).flatMap(host =>
    (['CLI', 'TUI'] as const).flatMap(runtime => laneCases(host, runtime, source)),
  );
  assert.equal(
    new Set(result.map(row => row.id)).size,
    result.length,
    'Duplicate OpenCode case identity',
  );
  return result;
}
function laneCases(
  host: OpenCodeCase['host'],
  runtime: OpenCodeCase['runtime'],
  source: string,
): OpenCodeCase[] {
  const result: OpenCodeCase[] = [];
  const rows = nativeCases(host, runtime, source);
  const version = rows[0]?.version;
  assert.ok(version);
  const prefix = `opencode-v${version.split('.', 1)[0]}-${version}-${runtime.toLowerCase()}`;
  for (const row of rows) {
    const kind = featureKinds[row.scenario];
    assert.ok(kind, `OPENCODE_POPULATION_UNWIRED: ${row.scenario}`);
    result.push({
      id: row.id,
      host,
      version,
      runtime,
      kind,
      authority: `${hostContractFeature}:${row.line}`,
    });
  }
  for (const [suffix, kind] of v2Policy)
    result.push({
      id: `${prefix}-${suffix}`,
      host,
      version,
      runtime,
      kind,
      authority: 'execution-plan.md PR2 tasks2/4',
    });
  for (const kind of ['allowed-write', 'denied-write', 'catalogue-helper'])
    assert.ok(
      result.some(row => row.host === host && row.runtime === runtime && row.kind === kind),
      `OPENCODE_POPULATION_MISSING: ${prefix}/${kind}`,
    );
  if (host === 'OpenCode V2')
    result.push({
      id: `${prefix}-coexistence`,
      host,
      version,
      runtime,
      kind: 'coexistence',
      authority: 'execution-plan.md PR2 task3: both versions in shared profile',
    });
  return result;
}
export interface OpenCodeResult {
  id: string;
  state: 'passed' | 'failed' | 'unavailable';
  error?: string;
}
/** No denominator filtering: absent/extra/duplicate cases fail; setup never becomes a pass. */
export function gradeOpenCodePopulation(
  required: OpenCodeCase[],
  observed: OpenCodeResult[],
): number {
  const ids = new Set(required.map(row => row.id));
  if (
    required.length === 0 ||
    ids.size !== required.length ||
    observed.length !== required.length ||
    new Set(observed.map(row => row.id)).size !== ids.size ||
    observed.some(row => !ids.has(row.id))
  )
    return 2;
  if (observed.some(row => row.state === 'unavailable')) return 3;
  return observed.every(row => row.state === 'passed') ? 0 : 2;
}
export async function runOpenCodePopulation(
  required: OpenCodeCase[],
  invoke: (batch: OpenCodeCase[]) => Promise<void>,
) {
  const batches = new Map<string, OpenCodeCase[]>();
  for (const row of required) {
    const key = `${row.host}/${row.version}/${row.runtime}/${row.kind}/${row.kind === 'worker' ? 'shared' : row.id}`;
    batches.set(key, [...(batches.get(key) ?? []), row]);
  }
  const results: OpenCodeResult[] = [];
  for (const batch of batches.values()) {
    let state: OpenCodeResult['state'] = 'passed',
      error: string | undefined;
    try {
      await invoke(batch);
    } catch (error_) {
      error = String(error_);
      const tokens = new Set(error.split(/[^A-Z0-9_]+/u));
      state =
        !error.includes('HOST_CONTRACT_PROOF_UNAVAILABLE') &&
        batch.some(row => failureCodes[row.kind].some(code => tokens.has(code)))
          ? 'failed'
          : 'unavailable';
    }
    results.push(...batch.map(row => ({ id: row.id, state, ...(error && { error }) })));
  }
  return { exit: gradeOpenCodePopulation(required, results), results };
}
