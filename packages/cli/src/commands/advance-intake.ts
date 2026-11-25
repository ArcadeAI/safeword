import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import {
  evaluateFeatureTicketReadiness,
  formatFeatureTicketReadiness,
  getTicketInfo,
} from '../../templates/hooks/lib/active-ticket.js';
import { evaluateBlockedOnGate } from '../../templates/hooks/lib/blocked-on-gate.js';
import { evaluateTicketWrite } from '../../templates/hooks/lib/phase-provenance.js';
import { evaluateParentContract } from '../../templates/hooks/lib/product-plan-contract.js';
import {
  formatReviewStamp,
  hashArtifact,
  reviewScope,
} from '../../templates/hooks/lib/review-ledger.js';
import { appendWorkLogEntry } from '../../templates/hooks/lib/work-log-stamp.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import {
  type IntakeReceipt,
  intakeReceipt,
  needsIndependentIntakeReview,
} from '../review/intake-receipt.js';
import { reviewJobStatus, withFileLock } from '../review/job.js';
import { parseTicketMetadata } from '../utils/ticket-metadata.js';

const COMMAND = 'review advance-intake';

function blocked(id: string, message: string, changedFiles: string[] = []): CliResult {
  return createResult({
    state: 'action_required',
    changed: changedFiles.length > 0,
    findings: [{ code: 'INTAKE_HANDOFF_BLOCKED', message, severity: 'warning' }],
    effects: {
      files: changedFiles.map(target => ({ kind: 'update', target, operation: 'write' })),
    },
    data: { command: COMMAND, review_id: id, status: 'blocked' },
  });
}

function completed(id: string, ticket: string, changedFiles: string[]): CliResult {
  return createResult({
    state: changedFiles.length > 0 ? 'changed' : 'healthy',
    changed: changedFiles.length > 0,
    findings: [
      {
        code: 'INTAKE_HANDOFF_RECORDED',
        message: `${ticket} is ready for scenario definition.`,
        severity: 'info',
      },
    ],
    effects: {
      files: changedFiles.map(target => ({ kind: 'update', target, operation: 'write' })),
    },
    data: { command: COMMAND, review_id: id, ticket_id: ticket, phase: 'define-behavior' },
  });
}

function intakeBlocker(
  cwd: string,
  folder: string,
  ticket: string,
  proposed: string,
): string | undefined {
  const phase = evaluateTicketWrite(ticket, proposed);
  if (!phase.ok) return `${phase.reason} ${phase.remediation}`;
  const parent = evaluateParentContract(cwd, proposed, ticket);
  if (!parent.ok) return `${parent.reason}. Reconcile the parent Product Plan before retrying.`;
  const readiness = evaluateFeatureTicketReadiness(cwd, folder, { ticketContent: proposed });
  if (!readiness.ok) return formatFeatureTicketReadiness(readiness);
  const blocker = evaluateBlockedOnGate(ticket, proposed, id => {
    const ticketInfo = getTicketInfo(cwd, id);
    return { found: ticketInfo.folder !== undefined, status: ticketInfo.status };
  });
  return blocker === undefined ? undefined : `${blocker.reason}. ${blocker.remedy}`;
}

function missingReviewStamps(receipt: IntakeReceipt, existing: string): string[] {
  const { id, ticketPath, ticketFolder, author, reviewer, model, independence } = receipt;
  const spec = readFileSync(nodePath.join(nodePath.dirname(ticketPath), 'spec.md'), 'utf8');
  const scopes = [
    reviewScope(ticketFolder, 'spec', hashArtifact(spec)),
    reviewScope(ticketFolder, 'phase', 'intake'),
  ];
  const recorded = new Set(
    existing.split(/\r?\n/u).map(line => line.split(' ').slice(2).join(' ')),
  );
  return scopes
    .map(scope => formatReviewStamp(scope, undefined, model, author, reviewer, independence, id))
    .filter(stamp => !recorded.has(stamp));
}

function recordHandoff(
  cwd: string,
  receipt: IntakeReceipt,
  ticket: { id: string; original: string; proposed: string },
  ledger: { path: string; existing: string; missing: string[] },
  changedFiles: string[],
): CliResult {
  const { id, ticketPath } = receipt;
  const now = new Date().toISOString();
  const temporary = `${ticketPath}.${randomUUID()}.tmp`;
  try {
    const updated = appendWorkLogEntry(ticket.proposed, `- ${now} Phase: intake → define-behavior`);
    writeFileSync(temporary, updated, { flag: 'wx', mode: statSync(ticketPath).mode & 0o777 });
    if (
      readFileSync(ticketPath, 'utf8') !== ticket.original ||
      intakeReceipt(cwd, reviewJobStatus(cwd, id).data)?.ticketPath !== ticketPath
    ) {
      return blocked(
        id,
        'The ticket or reviewed sources changed. Check the current review before retrying.',
      );
    }
    if (ledger.missing.length > 0) {
      // Write the receipt first. If the rename fails, the receipt is still current
      // evidence and a retry can reuse it without duplicating either stamp.
      const prefix = ledger.existing !== '' && !ledger.existing.endsWith('\n') ? '\n' : '';
      appendFileSync(
        ledger.path,
        prefix + ledger.missing.map(stamp => `${now} cli-intake-${id} ${stamp}\n`).join(''),
      );
      changedFiles.push(nodePath.relative(cwd, ledger.path));
    }
    renameSync(temporary, ticketPath);
    changedFiles.push(nodePath.relative(cwd, ticketPath));
    return completed(id, ticket.id, changedFiles);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function proposePhaseChange(ticket: string): string {
  const proposed = ticket.replace(/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/u, header =>
    header.replace(/^(phase:[\t ]*)(["']?)intake\2(?=[\t ]*(?:#|$))/mu, '$1$2define-behavior$2'),
  );
  if (proposed === ticket) throw new Error('Safeword could not locate a replaceable phase field.');
  return proposed;
}

function activeFeatureMetadata(ticket: string): Record<string, unknown> {
  const { metadata } = parseTicketMetadata(ticket);
  if (metadata.type !== 'feature' || metadata.status !== 'in_progress')
    throw new Error('The approved spec must belong to an in-progress feature ticket.');
  return metadata;
}

/** Turn the current spec approval into a durable intake handoff. */
export function advanceIntake(cwd: string, id: string): CliResult {
  const changedFiles: string[] = [];
  try {
    const status = reviewJobStatus(cwd, id);
    const receipt = intakeReceipt(cwd, status.data);
    if (receipt === undefined) {
      return blocked(
        id,
        status.findings.find(finding => finding.code === 'REVIEW_STALE')?.message ??
          status.errors[0]?.message ??
          'Use a current approval covering exactly one feature ticket’s spec.md.',
      );
    }

    if (needsIndependentIntakeReview(cwd, receipt)) {
      return {
        ...blocked(
          id,
          'Intake remains open. Run the plan review again when the independent reviewer is available.',
        ),
        nextActions: status.nextActions,
      };
    }

    const { ticketFolder, ticketPath } = receipt;
    const lock = nodePath.join(cwd, '.safeword', 'state', `intake-${ticketFolder}.lock`);
    return withFileLock(lock, () => {
      const original = readFileSync(ticketPath, 'utf8');
      const metadata = activeFeatureMetadata(original);

      const ticketId = typeof metadata.id === 'string' ? metadata.id : ticketFolder;
      const ticketDirectory = nodePath.dirname(ticketPath);
      const ledger = nodePath.join(ticketDirectory, '..', '..', 'skill-invocations.log');
      const existing = existsSync(ledger) ? readFileSync(ledger, 'utf8') : '';
      const missing = missingReviewStamps(receipt, existing);
      if (metadata.phase === 'define-behavior' && missing.length === 0) {
        if (intakeReceipt(cwd, reviewJobStatus(cwd, id).data)?.ticketPath !== ticketPath) {
          return blocked(
            id,
            'The reviewed sources changed. Check the current review before retrying.',
          );
        }
        return completed(id, ticketId, changedFiles);
      }
      if (metadata.phase !== 'intake')
        return blocked(id, 'The ticket must be in intake to record this handoff.');

      const proposed = proposePhaseChange(original);
      const reason = intakeBlocker(cwd, ticketFolder, original, proposed);
      if (reason !== undefined) return blocked(id, reason);

      return recordHandoff(
        cwd,
        receipt,
        { id: ticketId, original, proposed },
        { path: ledger, existing, missing },
        changedFiles,
      );
    });
  } catch (error) {
    return blocked(
      id,
      error instanceof Error ? error.message : 'The intake handoff could not be written.',
      changedFiles,
    );
  }
}
