import { readFileSync } from 'node:fs';
import path from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { writeDurableFile } from '../codex-plugin/durable-write.js';
import { retrospectiveCloseTag, validRetrospectiveCloseTag } from './job.js';
import {
  committedElectronInput,
  prepareElectronAdmission,
} from './retrospective-electron-admission.js';
import { hasPassedElectronReplay, withElectronReplay } from './retrospective-electron-journal.js';
import { type ElectronProofObservation, runElectronProof } from './retrospective-electron-proof.js';
import type { RetrospectiveGateRequest } from './retrospective-gate.js';
import { SOULLESS_RETROSPECTIVE_POLICY as policy } from './retrospective-policy.js';
import {
  currentProofCommit,
  proofGit,
  proofSha256,
  readProofInput,
} from './retrospective-proof.js';

function result(request: RetrospectiveGateRequest, replay: boolean, reason?: string): CliResult {
  const approved = reason === undefined;
  let state: CliResult['state'] = 'action_required';
  if (approved) state = replay ? 'changed' : 'healthy';
  return createResult({
    state,
    findings: [
      {
        code: approved ? 'RETROSPECTIVE_GATE_APPROVED' : 'RETROSPECTIVE_GATE_BLOCKED',
        message: reason ?? `Retrospective proof is current for ${request.scenario}.`,
        severity: approved ? 'info' : 'warning',
      },
    ],
    effects:
      approved && replay
        ? { files: [{ kind: 'review-record', target: rowPath(request), operation: 'write' }] }
        : undefined,
    data: {
      command: `review ${replay ? 'attest' : 'gate'} retrospective`,
      status: approved ? 'approved' : 'blocked',
      ...request,
    },
  });
}

function rowPath(request: RetrospectiveGateRequest): string {
  return `.safeword/state/reviews/electron-row-${proofSha256(rowIdentity(request))}.tag`;
}

function rowIdentity(request: RetrospectiveGateRequest): string {
  return JSON.stringify([
    request.ticketId,
    request.ledger,
    request.scenario,
    request.eligibilityId,
    request.proofId,
  ]);
}

/** Ignore only execution-specific directories/ports and the truthful producing HEAD. */
function stableObservation(observation: ElectronProofObservation): string {
  return JSON.stringify({
    policyId: observation.policyId,
    policySha256: observation.policySha256,
    request: observation.request,
    argv: observation.argv,
    cwd: observation.cwd,
    sourceSha256: observation.sourceSha256,
    mutantSha256: observation.mutantSha256,
    supportSha256: observation.supportSha256,
    mutatedSupportSha256: observation.mutatedSupportSha256,
    passing: observation.passing,
    mutated: { ...observation.mutated, failure: observation.mutated.failure.split('\n', 1)[0] },
  });
}

function requireObservedOutcome(observation: ElectronProofObservation): void {
  const { passing, request } = observation;
  if (
    observation.policyId !== policy.id ||
    observation.policySha256 !== proofSha256(JSON.stringify(policy)) ||
    observation.cwd !== 'packages/desktop' ||
    !/^[a-f\d]{40}$/u.test(observation.commit)
  )
    throw new Error('The reviewed Electron observation belongs to a different policy or view.');
  if (
    passing.exitCode !== 0 ||
    passing.passedTests !== 1 ||
    passing.failedTests !== 0 ||
    passing.test !== request.testFullName
  )
    throw new Error('The reviewed Electron original did not pass exactly one selected test.');
  requireObservedMutation(observation);
}

function requireObservedMutation(observation: ElectronProofObservation): void {
  const { mutated, request } = observation;
  if (
    !Number.isSafeInteger(mutated.exitCode) ||
    mutated.exitCode <= 0 ||
    mutated.passedTests !== 0 ||
    mutated.failedTests !== 1 ||
    mutated.test !== request.testFullName ||
    !mutated.failure.includes(request.mutation.expectedFailure) ||
    !mutated.failure.includes(request.mutation.assertionLocation)
  )
    throw new Error(
      'The reviewed Electron observation does not describe the enrolled discriminating outcome.',
    );
}

export function prepareElectronRow(root: string, request: RetrospectiveGateRequest) {
  const admission = prepareElectronAdmission(root, request);
  const observationBytes = committedElectronInput(root, admission.observationPath);
  const observation = JSON.parse(observationBytes.toString('utf8')) as ElectronProofObservation;
  if (JSON.stringify(observation.request) !== JSON.stringify(admission.proof))
    throw new Error('The reviewed Electron observation does not bind the exact proof request.');
  requireObservedOutcome(observation);
  proofGit(root, ['merge-base', '--is-ancestor', observation.commit, 'HEAD']);
  for (const [input, digest] of Object.entries(observation.supportSha256)) {
    // Replay established committed membership; its row tag also binds HEAD.
    // Cheap hook reads verify bytes without spawning Git once per source file.
    if (proofSha256(readProofInput(root, input)) !== digest)
      throw new Error(`Reviewed Electron executable input changed: ${input}`);
  }
  const requestDigest = proofSha256(committedElectronInput(root, admission.requestPath));
  const journal = {
    proofId: request.proofId,
    scenario: request.scenario,
    inputSha256: proofSha256(JSON.stringify([requestDigest, proofSha256(observationBytes)])),
  };
  const content = `electron-row-v1\0${admission.commit}\0${rowIdentity(request)}\0${stableObservation(observation)}`;
  return { ...admission, observation, journal, content };
}

/** Consume only a preparation from this invocation, never a serialized caller value. */
export function requireElectronRowAuthorization(
  root: string,
  request: RetrospectiveGateRequest,
  row: ReturnType<typeof prepareElectronRow>,
): void {
  let tag: string;
  try {
    tag = readFileSync(path.join(root, rowPath(request)), 'utf8').trim();
  } catch (error: unknown) {
    throw new Error(
      'The Electron row has no readable replay tag. Run review attest retrospective.',
      { cause: error },
    );
  }
  if (
    !hasPassedElectronReplay(root, row.journal, row.commit) ||
    !validRetrospectiveCloseTag(root, row.content, tag)
  )
    throw new Error(
      'The Electron row has no current completed replay. Run review attest retrospective.',
    );
  if (currentProofCommit(root) !== row.commit)
    throw new Error('The Electron committed view changed during row verification.');
}

/** Host hooks read authenticated replay state and current review fingerprints without executing tests. */
export function electronRetrospectiveGate(
  root: string,
  request: RetrospectiveGateRequest,
): CliResult {
  try {
    const row = prepareElectronRow(root, request);
    requireElectronRowAuthorization(root, request, row);
    return result(request, false);
  } catch (error: unknown) {
    return result(
      request,
      false,
      error instanceof Error ? error.message : 'Electron row evidence is invalid.',
    );
  }
}

/** Every attestation executes original and mutant again, including metadata-only HEAD changes. */
export async function attestElectronRetrospectiveRow(
  root: string,
  request: RetrospectiveGateRequest,
): Promise<CliResult> {
  try {
    const row = prepareElectronRow(root, request);
    await withElectronReplay(root, row.journal, row.commit, async () => {
      const replay = await runElectronProof(root, row.proof, row.requestPath);
      const after = prepareElectronRow(root, request);
      if (
        replay.commit !== row.commit ||
        currentProofCommit(root) !== row.commit ||
        after.content !== row.content ||
        JSON.stringify(after.journal) !== JSON.stringify(row.journal) ||
        stableObservation(replay) !== stableObservation(row.observation)
      )
        throw new Error(
          `Electron replay did not reproduce the reviewed proof for ${request.scenario}.`,
        );
      // Keep publication inside the pending owner's lock. A tag is unusable
      // until the journal passes; failed publication consumes this proof ID.
      writeDurableFile(
        path.join(root, rowPath(request)),
        `${retrospectiveCloseTag(root, row.content)}\n`,
        { mode: 0o600 },
      );
    });
    return result(request, true);
  } catch (error: unknown) {
    return result(
      request,
      true,
      `Electron row ${request.scenario}: ${error instanceof Error ? error.message : 'proof failed.'}`,
    );
  }
}
