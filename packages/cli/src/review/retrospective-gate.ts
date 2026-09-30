import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { frontmatterOf } from '../../templates/hooks/lib/phase-provenance.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import { approvedRetrospectiveReview } from './job.js';
import { type BaselineBlobClaim } from './retrospective-baseline.js';
import {
  RETROSPECTIVE_CUTOFF,
  RETROSPECTIVE_FEATURE,
  RETROSPECTIVE_LEDGER,
  RETROSPECTIVE_TICKET,
} from './retrospective-history.js';
import { checkRetrospectivePrerequisites } from './retrospective-prerequisites.js';
import {
  type RetrospectiveProofObservation,
  type RetrospectiveProofRequest,
  runRetrospectiveProof,
} from './retrospective-proof.js';
import { scenarioBodyDigest } from './retrospective-scenario-body.js';

interface EligibilityClaim {
  readonly ticketId: string;
  readonly ledgerPath: string;
  readonly featurePath: string;
  readonly cutoff: string;
  readonly baseline: string;
  readonly rationale: string;
  readonly scenarios: readonly { readonly heading: string; readonly bodySha256: string }[];
  readonly blobs: readonly BaselineBlobClaim[];
}

export interface RetrospectiveGateRequest {
  readonly ticketId: string;
  readonly ledger: string;
  readonly scenario: string;
  readonly eligibilityId: string;
  readonly proofId: string;
}

function deny(reason: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [{ code: 'RETROSPECTIVE_GATE_BLOCKED', message: reason, severity: 'warning' }],
    data: { command: 'review gate retrospective', status: 'blocked' },
  });
}

function claimMatchesMigration(claim: EligibilityClaim): boolean {
  return (
    claim.ticketId === RETROSPECTIVE_TICKET &&
    claim.ledgerPath === RETROSPECTIVE_LEDGER &&
    claim.featurePath === RETROSPECTIVE_FEATURE &&
    claim.cutoff === RETROSPECTIVE_CUTOFF &&
    Array.isArray(claim.scenarios) &&
    Array.isArray(claim.blobs) &&
    claim.blobs.every(
      blob =>
        typeof blob.currentBlobSha === 'string' &&
        Array.isArray(blob.baselineExcerpts) &&
        blob.baselineExcerpts.length > 0,
    )
  );
}

function matchingScenario(
  claim: EligibilityClaim,
  heading: string,
): { readonly heading: string; readonly bodySha256: string } | undefined {
  const matches = claim.scenarios.filter(item => item.heading === heading);
  return matches.length === 1 && /^[a-f\d]{64}$/u.test(matches[0]?.bodySha256 ?? '')
    ? matches[0]
    : undefined;
}

function ticketNamesClaim(root: string, claimPath: string): boolean {
  const ticketPath = nodePath.join(root, nodePath.dirname(RETROSPECTIVE_LEDGER), 'ticket.md');
  const ticket = frontmatterOf(readFileSync(ticketPath, 'utf8'));
  return ticket?.id === RETROSPECTIVE_TICKET && ticket.retrospective_claim === claimPath;
}

function soleJsonTarget(targets: readonly string[]): string | undefined {
  const [target] = targets;
  return targets.length === 1 && target?.endsWith('.json') ? target : undefined;
}

function committedFeature(root: string): string | undefined {
  const result = spawnSync(
    'git',
    [
      '--no-replace-objects',
      '-C',
      root,
      'show',
      `${RETROSPECTIVE_CUTOFF}:${RETROSPECTIVE_FEATURE}`,
    ],
    {
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      env: Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
      ),
    },
  );
  return result.status === 0 ? result.stdout : undefined;
}

function verifiedEligibility(
  root: string,
  targets: readonly string[],
  request: RetrospectiveGateRequest,
): EligibilityClaim | undefined {
  const target = soleJsonTarget(targets);
  if (target === undefined || !ticketNamesClaim(root, target)) return undefined;
  const claim = JSON.parse(readFileSync(nodePath.join(root, target), 'utf8')) as EligibilityClaim;
  if (!claimMatchesMigration(claim)) return undefined;
  const prerequisite = checkRetrospectivePrerequisites(root, claim, claim.blobs);
  if (!prerequisite.eligibleForReview) return undefined;
  const member = matchingScenario(claim, request.scenario);
  if (member === undefined) return undefined;
  const current = readFileSync(nodePath.join(root, RETROSPECTIVE_FEATURE), 'utf8');
  const baseline = committedFeature(root);
  if (baseline === undefined) return undefined;
  return scenarioBodyDigest(current, request.scenario) === member.bodySha256 &&
    scenarioBodyDigest(baseline, request.scenario) === member.bodySha256
    ? claim
    : undefined;
}

function stableObservation(observation: RetrospectiveProofObservation): string {
  return JSON.stringify({
    request: observation.request,
    argv: observation.argv,
    cwd: observation.cwd,
    sourceSha256: observation.sourceSha256,
    mutantSha256: observation.mutantSha256,
    supportSha256: observation.supportSha256,
    mutatedSupportSha256: observation.mutatedSupportSha256,
    passing: observation.passing,
    mutated: {
      exitCode: observation.mutated.exitCode,
      test: observation.mutated.test,
      passedTests: observation.mutated.passedTests,
      failedTests: observation.mutated.failedTests,
      failure: observation.mutated.failure.split('\n', 1)[0],
    },
  });
}

function hasDiscriminatingOutcome(
  observation: RetrospectiveProofObservation,
  testFullName: string,
): boolean {
  const { passing, mutated } = observation;
  return (
    passing.exitCode === 0 &&
    passing.passedTests === 1 &&
    passing.failedTests === 0 &&
    passing.test === testFullName &&
    mutated.exitCode !== 0 &&
    mutated.passedTests === 0 &&
    mutated.failedTests === 1 &&
    mutated.test === testFullName
  );
}

function verifiedProof(
  root: string,
  targets: readonly string[],
  request: RetrospectiveGateRequest,
  eligibility: EligibilityClaim,
): boolean {
  if (targets.length !== 2 || targets.some(path => !path.endsWith('.json'))) return false;
  const proofRequest = JSON.parse(
    readFileSync(nodePath.join(root, targets[0] ?? ''), 'utf8'),
  ) as RetrospectiveProofRequest;
  const reviewed = JSON.parse(
    readFileSync(nodePath.join(root, targets[1] ?? ''), 'utf8'),
  ) as RetrospectiveProofObservation;
  if (
    proofRequest.ticketId !== RETROSPECTIVE_TICKET ||
    proofRequest.scenario !== request.scenario ||
    eligibility.blobs.every(blob => blob.currentPath !== proofRequest.implementationPath) ||
    JSON.stringify(reviewed.request) !== JSON.stringify(proofRequest)
  )
    return false;
  const rerun = runRetrospectiveProof(root, proofRequest);
  return (
    hasDiscriminatingOutcome(rerun, proofRequest.testFullName) &&
    stableObservation(reviewed) === stableObservation(rerun)
  );
}

/** This gate never treats a review verdict or author JSON as execution evidence. */
export function retrospectiveGate(root: string, request: RetrospectiveGateRequest): CliResult {
  if (request.ticketId !== RETROSPECTIVE_TICKET || request.ledger !== RETROSPECTIVE_LEDGER)
    return deny('Only CKWE2D may use retrospective receipts.');
  if (request.eligibilityId === request.proofId)
    return deny('Eligibility and proof must use separate review receipts.');
  try {
    const eligibilityTargets = approvedRetrospectiveReview(
      root,
      request.eligibilityId,
      'retrospective-eligibility',
    );
    const proofTargets = approvedRetrospectiveReview(root, request.proofId, 'retrospective-proof');
    if (eligibilityTargets === undefined || proofTargets === undefined)
      return deny('Both current, independent review receipts are required.');
    const eligibility = verifiedEligibility(root, eligibilityTargets, request);
    if (eligibility === undefined)
      return deny('Historical eligibility no longer matches the cutoff and scenario.');
    if (!verifiedProof(root, proofTargets, request, eligibility))
      return deny('The reviewed passing/mutation proof is stale or does not reproduce.');
    return createResult({
      state: 'healthy',
      findings: [
        {
          code: 'RETROSPECTIVE_GATE_APPROVED',
          message: `Retrospective proof is current for ${request.scenario}.`,
          severity: 'info',
        },
      ],
      data: {
        command: 'review gate retrospective',
        status: 'approved',
        ...request,
      },
    });
  } catch {
    return deny('Retrospective evidence is missing, invalid, or could not be reproduced.');
  }
}
