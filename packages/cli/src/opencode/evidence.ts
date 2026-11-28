import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import {
  publishConformanceAttempt,
  readConformanceAttempts,
} from '../host-contract/conformance-run.js';
import { CONFORMANCE_RUN_LAYOUT } from '../schema.js';
import { VERSION } from '../version.js';
import type { OpenCodeV2Capture } from './conformance-fixture.js';
import { isSha256 } from './records.js';
import {
  type OpenCodeV2Enrollment,
  openCodeV2NativeBinding,
  openCodeV2NativeStore,
} from './v2-enrollment.js';

const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

export function openCodeV2ConformanceIdentity(
  enrollment: OpenCodeV2Enrollment,
  hostVersion: string,
  runtime: 'CLI' | 'TUI',
  fixtureDigest: string,
  controllerDigest: string,
) {
  const ownerDigest = hash(readFileSync(import.meta.filename));
  return {
    ...openCodeV2NativeBinding(enrollment, hostVersion),
    host_version: hostVersion,
    runtime,
    method: 'automated',
    platform: process.platform,
    arch: process.arch,
    safeword_version: VERSION,
    trust_class: 'explicit-owned-local-fixture',
    // Content revision of the executing owner, never an enclosing customer's Git HEAD.
    source_revision: `sha256:${hash(JSON.stringify([controllerDigest, fixtureDigest, ownerDigest]))}`,
    controller_sha256: controllerDigest,
    contract: 'opencode-registration-v1',
    fixture_sha256: fixtureDigest,
  };
}

export function publishOpenCodeV2Attempt(
  identity: ReturnType<typeof openCodeV2ConformanceIdentity>,
  capture: Readonly<Record<string, unknown>>,
) {
  return publishConformanceAttempt(openCodeV2Store(identity), {
    identity,
    kind: 'conformance',
    observed_at: new Date().toISOString(),
    outcome: capture.outcome,
    observations: capture,
  });
}

export function openCodeV2Store(identity: ReturnType<typeof openCodeV2ConformanceIdentity>) {
  const bucket = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  return {
    directory: nodePath.join(identity.project_directory, CONFORMANCE_RUN_LAYOUT.directory, bucket),
    keyFile: nodePath.join(identity.profile_directory, CONFORMANCE_RUN_LAYOUT.key),
    headFile: nodePath.join(
      identity.profile_directory,
      CONFORMANCE_RUN_LAYOUT.heads,
      `${bucket}.json`,
    ),
  };
}

type V2Identity = ReturnType<typeof openCodeV2ConformanceIdentity>;
function currentAttempt(identity: V2Identity) {
  const record = readConformanceAttempts(openCodeV2Store(identity))?.at(-1);
  return record && isDeepStrictEqual(record.payload.identity, identity) ? record : undefined;
}
function matchingProof(
  record: ReturnType<typeof currentAttempt>,
  capture: OpenCodeV2Capture | undefined,
): boolean {
  return (
    record?.payload.kind === 'conformance' &&
    record.payload.outcome === 'passed' &&
    passingCapture(capture)
  );
}
function passingCapture(capture: OpenCodeV2Capture | undefined): boolean {
  return (
    capture?.outcome === 'passed' &&
    capture.guarantees?.some(row => row.id === 'reject_action' && row.state === 'proved') === true
  );
}
function freshActivation(identity: V2Identity, now: number): boolean {
  const binding = openCodeV2NativeBinding(identity, identity.host_version);
  const history = readConformanceAttempts(
    openCodeV2NativeStore(binding, CONFORMANCE_RUN_LAYOUT.activation),
  );
  const record = history?.findLast(
    row =>
      row.payload.runtime === identity.runtime ||
      !['CLI', 'TUI'].includes(String(row.payload.runtime)),
  );
  if (!record) return false;
  const age = now - Date.parse(String(record.payload.observed_at));
  return (
    record.payload.outcome === 'observed' &&
    record.payload.runtime === identity.runtime &&
    isDeepStrictEqual(record.payload.identity, binding) &&
    record.payload.event === 'pre_tool' &&
    isSha256(record.payload.session_id_sha256) &&
    isSha256(record.payload.origin_sha256) &&
    age >= 0 &&
    age <= 7 * 86_400_000
  );
}
function guaranteeState(active: boolean, outcome: unknown): string {
  if (active) return 'active';
  if (outcome === 'passed' || outcome === 'failed') return 'unavailable';
  return 'unproved';
}
function rejectionCause(capture: OpenCodeV2Capture | undefined) {
  return (
    capture?.registrations?.find(row => row.required && row.state === 'rejected')?.cause ??
    capture?.error
  );
}
/** Current native status reads only; keys and observations are never minted here. */
export function readOpenCodeV2Lane(identity: V2Identity, now: number) {
  const current = currentAttempt(identity);
  if (!current)
    return {
      activated: false,
      conformant: false,
      registrations: [],
      guarantees: [{ id: 'reject_action', state: 'unproved' }],
    };
  const capture = current.payload.observations as OpenCodeV2Capture | undefined;
  const conformant = matchingProof(current, capture);
  const activated = conformant && freshActivation(identity, now);
  const cause = rejectionCause(capture);
  const state = guaranteeState(activated, current.payload.outcome);
  return {
    activated,
    conformant,
    registrations: capture?.registrations ?? [],
    guarantees: [
      {
        id: 'reject_action',
        state,
        ...(cause && { cause }),
        ...(conformant && { proof_id: current.id }),
      },
    ],
  };
}
