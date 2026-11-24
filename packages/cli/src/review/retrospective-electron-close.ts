import { readFileSync } from 'node:fs';
import path from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { writeDurableFile } from '../codex-plugin/durable-write.js';
import { retrospectiveCloseTag, validRetrospectiveCloseTag } from './job.js';
import { electronLedgerClaims } from './retrospective-electron-admission.js';
import {
  attestElectronRetrospectiveRow,
  prepareElectronRow,
  requireElectronRowAuthorization,
} from './retrospective-electron-gate.js';
import type { RetrospectiveGateRequest } from './retrospective-gate.js';
import { SOULLESS_RETROSPECTIVE_POLICY as policy } from './retrospective-policy.js';
import { currentProofCommit, proofSha256, readProofInput } from './retrospective-proof.js';

const RECORD_PATH = '.safeword/state/reviews/electron-retrospective-close-v1.json';

interface ClosingView {
  readonly schema_version: 1;
  readonly policyId: string;
  readonly policySha256: string;
  readonly ticketId: string;
  readonly ledger: string;
  readonly sourceCommit: string;
  readonly claims: readonly RetrospectiveGateRequest[];
  readonly inputs: Readonly<Record<string, string>>;
}

function result(replay: boolean, reason?: string): CliResult {
  const approved = reason === undefined;
  let state: CliResult['state'] = 'action_required';
  if (approved) state = replay ? 'changed' : 'healthy';
  return createResult({
    state,
    findings: [
      {
        code: approved ? 'RETROSPECTIVE_CLOSE_APPROVED' : 'RETROSPECTIVE_CLOSE_BLOCKED',
        message: reason ?? 'Current Electron closing proof covers all 17 enrolled VERIFIED rows.',
        severity: approved ? 'info' : 'warning',
      },
    ],
    effects:
      approved && replay
        ? { files: [{ kind: 'review-record', target: RECORD_PATH, operation: 'write' }] }
        : undefined,
    data: {
      command: `review ${replay ? 'attest' : 'gate'} retrospective-close`,
      status: approved ? 'approved' : 'blocked',
      ticketId: policy.ticketId,
      ledger: policy.ledger,
    },
  });
}

function requireMigration(ticketId: string, ledger: string): void {
  if (ticketId !== policy.ticketId || ledger !== policy.ledger)
    throw new Error('Electron closing requires the exact enrolled ticket and ledger.');
}

function exactClaims(root: string): RetrospectiveGateRequest[] {
  const claims = electronLedgerClaims(root);
  const headings = new Set(claims.map(claim => claim.scenario));
  for (const heading of policy.scenarios) {
    if (!headings.has(heading))
      throw new Error(`Missing required Electron VERIFIED row: ${heading}`);
  }
  if (claims.length !== policy.scenarios.length || headings.size !== policy.scenarios.length)
    throw new Error('Electron closing requires the exact 17 distinct enrolled VERIFIED rows.');
  return claims;
}

function closingView(root: string) {
  const sourceCommit = currentProofCommit(root);
  const claims = exactClaims(root);
  const rows: {
    claim: RetrospectiveGateRequest;
    prepared: ReturnType<typeof prepareElectronRow>;
  }[] = [];
  const paths = new Set<string>([
    policy.ledger,
    policy.feature,
    path.posix.join(path.posix.dirname(policy.ledger), 'ticket.md'),
  ]);
  for (const claim of claims) {
    const row = prepareElectronRow(root, claim);
    rows.push({ claim, prepared: row });
    for (const input of [
      row.eligibilityPath,
      row.requestPath,
      row.observationPath,
      `.safeword/state/reviews/${claim.eligibilityId}.json`,
      `.safeword/state/reviews/${claim.proofId}.json`,
    ])
      paths.add(input);
    for (const input of Object.keys(row.observation.supportSha256)) paths.add(input);
  }
  const sorted = [...paths].toSorted((left, right) => left.localeCompare(right, 'en'));
  const inputs = Object.fromEntries(
    sorted.map(input => [input, proofSha256(readProofInput(root, input))]),
  );
  if (currentProofCommit(root) !== sourceCommit)
    throw new Error('Electron closing view changed during verification.');
  const view: ClosingView = {
    schema_version: 1,
    policyId: policy.id,
    policySha256: proofSha256(JSON.stringify(policy)),
    ticketId: policy.ticketId,
    ledger: policy.ledger,
    sourceCommit,
    claims,
    inputs,
  };
  return { view, rows };
}

function requireCurrentRows(root: string, closing: ReturnType<typeof closingView>): void {
  for (const { claim, prepared } of closing.rows) {
    try {
      requireElectronRowAuthorization(root, claim, prepared);
    } catch (error: unknown) {
      throw new Error(`Electron closing row ${claim.scenario} is not current.`, { cause: error });
    }
  }
  for (const [input, digest] of Object.entries(closing.view.inputs))
    if (proofSha256(readProofInput(root, input)) !== digest)
      throw new Error(`Electron closing input changed: ${input}`);
}

/** Every required row executes at the same final committed view before aggregate publication. */
export async function attestElectronRetrospectiveClose(
  root: string,
  ticketId: string,
  ledger: string,
): Promise<CliResult> {
  try {
    requireMigration(ticketId, ledger);
    const before = closingView(root);
    for (const claim of before.view.claims) {
      const replay = await attestElectronRetrospectiveRow(root, claim);
      if (replay.state !== 'changed')
        throw new Error(`Electron closing row ${claim.scenario}: ${replay.findings[0]?.message}`);
    }
    const after = closingView(root);
    if (JSON.stringify(before.view) !== JSON.stringify(after.view))
      throw new Error('Electron closing inputs changed during all-row replay.');
    requireCurrentRows(root, after);
    const content = JSON.stringify(after.view);
    const integrity = retrospectiveCloseTag(root, `electron-close-v1\0${content}`);
    writeDurableFile(
      path.join(root, RECORD_PATH),
      `${JSON.stringify({ view: after.view, integrity })}\n`,
      { mode: 0o600 },
    );
    return result(true);
  } catch (error: unknown) {
    return result(true, error instanceof Error ? error.message : 'Electron closing replay failed.');
  }
}

/** A later failed/pending row replay invalidates even a previously signed same-HEAD aggregate. */
export function electronRetrospectiveCloseGate(
  root: string,
  ticketId: string,
  ledger: string,
): CliResult {
  try {
    requireMigration(ticketId, ledger);
    const record = JSON.parse(readFileSync(path.join(root, RECORD_PATH), 'utf8')) as {
      view: ClosingView;
      integrity: string;
    };
    if (
      !validRetrospectiveCloseTag(
        root,
        `electron-close-v1\0${JSON.stringify(record.view)}`,
        record.integrity,
      )
    )
      throw new Error('Electron closing record is missing an authentic signature.');
    const current = closingView(root);
    if (JSON.stringify(record.view) !== JSON.stringify(current.view))
      throw new Error(
        'Electron closing record does not bind the current committed view and reviews.',
      );
    requireCurrentRows(root, current);
    return result(false);
  } catch (error: unknown) {
    return result(
      false,
      error instanceof Error ? error.message : 'Electron closing proof is invalid.',
    );
  }
}
