import path from 'node:path';

import { balancedFenceBodyLines } from '../../templates/hooks/lib/checkbox-transitions.js';
import { frontmatterOf } from '../../templates/hooks/lib/phase-provenance.js';
import { approvedRetrospectiveReview } from './job.js';
import { parseRetrospectiveAnnotation } from './retrospective-annotation.js';
import type { BaselineBlobClaim } from './retrospective-baseline.js';
import { parseElectronProofRequest } from './retrospective-electron-request.js';
import type { RetrospectiveGateRequest } from './retrospective-gate.js';
import { SOULLESS_RETROSPECTIVE_POLICY as policy } from './retrospective-policy.js';
import { checkRetrospectivePrerequisites } from './retrospective-prerequisites.js';
import { currentProofCommit, proofGit, readProofInput } from './retrospective-proof.js';
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

export function requireElectronRow(request: RetrospectiveGateRequest): void {
  if (
    request.ticketId !== policy.ticketId ||
    request.ledger !== policy.ledger ||
    !([...policy.scenarios] as string[]).includes(request.scenario)
  )
    throw new Error('The requested row is outside the approved Electron migration boundary.');
  if (request.eligibilityId === request.proofId)
    throw new Error('Eligibility and proof must use separate review receipts.');
}

export function committedElectronInput(root: string, relative: string): Buffer {
  const bytes = readProofInput(root, relative);
  if (!bytes.equals(proofGit(root, ['show', `HEAD:${relative}`])))
    throw new Error(`Electron admission input is not the committed view: ${relative}`);
  return bytes;
}

export function electronReviewTargets(
  root: string,
  id: string,
  kind: 'retrospective-eligibility' | 'retrospective-proof',
  count: number,
): string[] {
  const targets = approvedRetrospectiveReview(root, id, kind);
  if (targets?.length !== count)
    throw new Error(
      `Both current, independent review receipts are required: ${kind} review ${id} is missing, stale, or not independent.`,
    );
  return targets.map(target => {
    const relative = path.relative(root, path.resolve(root, target)).split(path.sep).join('/');
    if (!relative.endsWith('.json'))
      throw new Error('Electron review targets must be JSON inputs.');
    committedElectronInput(root, relative);
    return relative;
  });
}

/** Preserve the original ledger bytes; only separate enrolled VERIFIED lines may be added. */
export function electronLedgerClaims(root: string): RetrospectiveGateRequest[] {
  const current = committedElectronInput(root, policy.ledger).toString('utf8');
  const baseline = proofGit(root, ['show', `${policy.cutoff}:${policy.ledger}`]).toString('utf8');
  const lines = current.split(/(?<=\n)/u);
  const fenced = balancedFenceBodyLines(lines);
  const retained: string[] = [];
  const claims: RetrospectiveGateRequest[] = [];
  const seen = new Set<string>();
  let scenario: string | undefined;
  for (const [index, line] of lines.entries()) {
    if (fenced.has(index)) {
      retained.push(line);
      continue;
    }
    if (/^#{1,6}\s+/u.test(line))
      scenario = /^#{2,6} Scenario: (.+)$/u.exec(line.trimEnd())?.[1]?.trim();
    const claim = ledgerClaim(line, scenario, seen);
    if (claim === undefined) {
      retained.push(line);
      continue;
    }
    seen.add(claim.scenario);
    claims.push(claim);
  }
  if (retained.join('') !== baseline)
    throw new Error('Original Electron history changed; retain every original ledger entry.');
  return claims;
}

function ledgerClaim(
  line: string,
  scenario: string | undefined,
  seen: ReadonlySet<string>,
): RetrospectiveGateRequest | undefined {
  const annotation = parseRetrospectiveAnnotation(line);
  if (annotation === undefined) return undefined;
  if (annotation.kind !== 'claim' || scenario === undefined || seen.has(scenario))
    throw new Error(
      'Electron VERIFIED entries need unique enrolled headings and authentic receipt identities.',
    );
  const claim = {
    ticketId: policy.ticketId,
    ledger: policy.ledger,
    scenario,
    eligibilityId: annotation.eligibilityId,
    proofId: annotation.proofId,
  };
  requireElectronRow(claim);
  return claim;
}

function requireClaimShape(claim: EligibilityClaim): void {
  if (
    claim.ticketId !== policy.ticketId ||
    claim.ledgerPath !== policy.ledger ||
    claim.featurePath !== policy.feature ||
    claim.cutoff !== policy.cutoff ||
    typeof claim.rationale !== 'string' ||
    !Array.isArray(claim.scenarios) ||
    !Array.isArray(claim.blobs)
  )
    throw new Error(
      'Electron eligibility does not match the fixed migration identity and baseline evidence.',
    );
  requireClaimEvidence(claim);
}

function requireClaimEvidence(claim: EligibilityClaim): void {
  if (
    claim.blobs.some(
      blob =>
        typeof blob.currentBlobSha !== 'string' ||
        !Array.isArray(blob.baselineExcerpts) ||
        blob.baselineExcerpts.length === 0,
    )
  )
    throw new Error('Electron eligibility needs current blob digests and baseline excerpts.');
  const headings = claim.scenarios.map(item => item.heading);
  if (
    headings.length === 0 ||
    new Set(headings).size !== headings.length ||
    headings.some(heading => !([...policy.scenarios] as string[]).includes(heading))
  )
    throw new Error('Electron eligibility scenarios must be distinct enrolled headings.');
}

function requireOptIn(root: string, claimPath: string): void {
  const ticketPath = path.posix.join(path.posix.dirname(policy.ledger), 'ticket.md');
  const ticket = frontmatterOf(committedElectronInput(root, ticketPath).toString('utf8'));
  if (
    ticket?.id !== policy.ticketId ||
    typeof ticket.retrospective_claim !== 'string' ||
    (ticket.retrospective_claim !== claimPath &&
      !(
        Array.isArray(ticket.retrospective_claims) &&
        ticket.retrospective_claims.includes(claimPath)
      ))
  )
    throw new Error(
      'The committed Electron ticket does not opt into this reviewed eligibility claim.',
    );
}

export function prepareElectronAdmission(root: string, request: RetrospectiveGateRequest) {
  requireElectronRow(request);
  const [eligibilityPath = ''] = electronReviewTargets(
    root,
    request.eligibilityId,
    'retrospective-eligibility',
    1,
  );
  const [requestPath = '', observationPath = ''] = electronReviewTargets(
    root,
    request.proofId,
    'retrospective-proof',
    2,
  );
  const commit = currentProofCommit(root);
  requireOptIn(root, eligibilityPath);
  electronLedgerClaims(root);
  const eligibility = JSON.parse(
    committedElectronInput(root, eligibilityPath).toString('utf8'),
  ) as EligibilityClaim;
  requireClaimShape(eligibility);
  const history = checkRetrospectivePrerequisites(root, eligibility, eligibility.blobs);
  if (!history.eligibleForReview)
    throw new Error(`Electron eligibility is invalid: ${history.reason}`);
  requireScenarioBody(root, eligibility, request.scenario);
  const proof = parseElectronProofRequest(
    JSON.parse(committedElectronInput(root, requestPath).toString('utf8')),
  );
  if (
    proof.scenario !== request.scenario ||
    eligibility.blobs.every(blob => blob.currentPath !== proof.implementationPath)
  )
    throw new Error(
      'The Electron proof does not match the reviewed eligibility and requested row.',
    );
  return { commit, eligibilityPath, requestPath, observationPath, proof };
}

function requireScenarioBody(root: string, eligibility: EligibilityClaim, heading: string): void {
  const scenario = eligibility.scenarios.find(item => item.heading === heading);
  const current = committedElectronInput(root, policy.feature).toString('utf8');
  const baseline = proofGit(root, ['show', `${policy.cutoff}:${policy.feature}`]).toString('utf8');
  if (
    scenario === undefined ||
    !/^[a-f\d]{64}$/u.test(scenario.bodySha256) ||
    scenarioBodyDigest(current, heading) !== scenario.bodySha256 ||
    scenarioBodyDigest(baseline, heading) !== scenario.bodySha256
  )
    throw new Error('The reviewed Electron scenario no longer matches its historical body.');
}
