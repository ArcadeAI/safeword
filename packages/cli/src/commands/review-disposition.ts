import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';

import { parseDocument } from 'yaml';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { terminalSafeReviewerText } from '../review/coordinator.js';
import { reviewJobStatus, withFileLock } from '../review/job.js';
import { toReviewPath } from '../review/packet.js';
import {
  acceptedBoundaryDigest,
  isPendingReviewDecision,
  type PendingReviewDecision,
  reviewDispositionFindingFingerprint,
} from '../review/planning-accepted-boundary.js';
import { resolveTicketDirectory } from '../utils/product-plan-contract.js';
import { parseTicketMetadata } from '../utils/ticket-metadata.js';

const command = 'ticket record-review-disposition';
type PlanningReviewKind = 'quality-review' | 'plan-implementation' | 'plan-execution';
type Finding = { readonly severity: 'info' | 'warning'; readonly message: string };

export interface RecordReviewDispositionRequest {
  readonly cwd: string;
  readonly ticketId: string;
  readonly reviewId: string;
  readonly findingNumber: string;
  readonly reason: string;
  readonly noInput: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPlanningKind(value: unknown): value is PlanningReviewKind {
  return ['quality-review', 'plan-implementation', 'plan-execution'].includes(String(value));
}

function pending(
  request: RecordReviewDispositionRequest,
  kind: PlanningReviewKind,
  finding: Finding,
  decision?: PendingReviewDecision,
): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'REVIEW_DISPOSITION_PENDING',
        message: `Declining this ${finding.severity} finding requires interactive confirmation: ${terminalSafeReviewerText(finding.message)}`,
        severity: 'warning',
      },
    ],
    data: {
      command,
      status: 'pending',
      ticket_id: request.ticketId,
      review_id: request.reviewId,
      review_kind: kind,
      finding: finding.message,
      reason: request.reason,
      ...(decision !== undefined && {
        disposition: decision.disposition,
        question: decision.question,
        action: decision.action,
      }),
    },
  });
}

function currentBoundaryDigest(cwd: string, ticketPath: string, content: string): string {
  const { metadata } = parseTicketMetadata(content);
  const parent =
    typeof metadata.parent === 'string' ? resolveTicketDirectory(cwd, metadata.parent) : undefined;
  if (metadata.parent !== undefined && parent === undefined)
    throw new Error('The declared parent Product Plan does not resolve.');
  const specPath = nodePath.join(parent ?? nodePath.dirname(ticketPath), 'spec.md');
  return acceptedBoundaryDigest(content, readFileSync(specPath, 'utf8'));
}

function addDisposition(
  content: string,
  request: RecordReviewDispositionRequest,
  kind: PlanningReviewKind,
  finding: Finding,
  boundary: { readonly digest: string; readonly decision?: PendingReviewDecision },
): string {
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/u.exec(content);
  if (match === null) throw new Error('The ticket has no valid frontmatter.');
  const document = parseDocument(match[2] ?? '', { uniqueKeys: true });
  if (document.errors.length > 0) throw new Error('The ticket has invalid frontmatter.');
  const metadata: unknown = document.toJS();
  if (!isRecord(metadata)) throw new Error('The ticket has invalid frontmatter.');
  const existing = metadata.review_dispositions;
  if (existing !== undefined && !Array.isArray(existing))
    throw new Error('The ticket review dispositions are invalid.');
  const records = Array.isArray(existing) ? existing : [];
  document.set('review_dispositions', [
    ...records,
    boundary.decision ?? {
      version: 1,
      review_id: request.reviewId,
      review_kind: kind,
      finding_fingerprint: reviewDispositionFindingFingerprint(finding.severity, finding.message),
      finding_severity: finding.severity,
      finding_message: finding.message,
      accepted_boundary_digest: boundary.digest,
      disposition: 'declined',
      reason: request.reason,
    },
  ]);
  return `${match[1]}${document.toString({ lineWidth: 0 }).trimEnd()}${match[3]}${content.slice(match[0].length)}`;
}

async function confirm(finding: Finding, boundaryDigest: string, reason: string): Promise<boolean> {
  process.stderr.write(
    `Finding (${finding.severity}): ${terminalSafeReviewerText(finding.message)}\nAccepted boundary: ${boundaryDigest}\nDecline reason: ${reason}\n`,
  );
  const prompt = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await prompt.question('Record this decline in the ticket? [y/N] ');
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    prompt.close();
  }
}

// The independent provenance and finding checks are one trust boundary.
// eslint-disable-next-line complexity -- Every independent condition authenticates the selected finding.
function selectedFinding(
  data: Record<string, unknown>,
  findingNumber: string,
  expectedTarget: string,
): Finding | undefined {
  const targets = data.review_targets;
  const output = data.reviewer_output;
  const findings = isRecord(output) ? output.findings : undefined;
  const index = Number(findingNumber) - 1;
  const finding: unknown = Array.isArray(findings) ? findings[index] : undefined;
  if (
    !Array.isArray(targets) ||
    targets.length !== 1 ||
    targets[0] !== expectedTarget ||
    !Number.isSafeInteger(index) ||
    !isRecord(finding) ||
    (finding.severity !== 'info' && finding.severity !== 'warning') ||
    typeof finding.message !== 'string' ||
    finding.message.trim() === ''
  )
    return undefined;
  return { severity: finding.severity, message: finding.message };
}

function currentReview(cwd: string, reviewId: string): Record<string, unknown> | undefined {
  const data = reviewJobStatus(cwd, reviewId).data;
  return isRecord(data) &&
    data.status === 'approved' &&
    isPlanningKind(data.review_kind) &&
    isRecord(data.review_identity)
    ? data
    : undefined;
}

function writeUnavailable(message: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [{ code: 'REVIEW_DISPOSITION_WRITE_UNAVAILABLE', message, severity: 'warning' }],
    data: { command, status: 'pending' },
  });
}

// eslint-disable-next-line max-params -- Keep the captured CAS inputs explicit at the write boundary.
function writeDisposition(
  request: RecordReviewDispositionRequest,
  ticketPath: string,
  kind: PlanningReviewKind,
  finding: Finding,
  before: string,
  boundaryDigest: string,
  decision?: PendingReviewDecision,
): CliResult {
  const lockPath = `${ticketPath}.review-disposition.lock`;
  try {
    return withFileLock(lockPath, () => {
      if (
        readFileSync(ticketPath, 'utf8') !== before ||
        currentBoundaryDigest(request.cwd, ticketPath, before) !== boundaryDigest ||
        currentReview(request.cwd, request.reviewId) === undefined
      )
        return createResult({
          state: 'action_required',
          findings: [
            {
              code: 'REVIEW_DISPOSITION_STALE',
              message:
                'The ticket, accepted boundary, or review changed during confirmation. Refresh the review and confirm the finding again.',
              severity: 'warning',
            },
          ],
          data: { command, status: 'pending', review_id: request.reviewId },
        });
      const next = addDisposition(before, request, kind, finding, {
        digest: boundaryDigest,
        decision,
      });
      const temporary = `${ticketPath}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temporary, next, { flag: 'wx', mode: statSync(ticketPath).mode & 0o777 });
        renameSync(temporary, ticketPath);
      } finally {
        if (existsSync(temporary)) unlinkSync(temporary);
      }
      const result = decision === undefined ? undefined : pending(request, kind, finding, decision);
      return createResult({
        ...result,
        state: decision === undefined ? 'changed' : 'action_required',
        changed: true,
        effects: {
          files: [
            {
              kind: 'update',
              target: nodePath.relative(request.cwd, ticketPath),
              operation: 'write',
            },
          ],
        },
        data: result?.data ?? {
          command,
          status: 'recorded',
          ticket_id: request.ticketId,
          review_id: request.reviewId,
        },
      });
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return writeUnavailable(
      `The ticket or lock could not be updated atomically: ${reason}. Check the ticket before retrying.`,
    );
  }
}

function savedPendingDecision(
  content: string,
  request: RecordReviewDispositionRequest,
): PendingReviewDecision | undefined {
  const { metadata } = parseTicketMetadata(content);
  if (!Array.isArray(metadata.review_dispositions)) return undefined;
  const records: unknown[] = metadata.review_dispositions;
  const index = records.findLastIndex(
    value =>
      isPendingReviewDecision(value) &&
      value.ticket_id === request.ticketId &&
      value.review_id === request.reviewId &&
      value.finding_number === Number(request.findingNumber),
  );
  const record = records[index];
  if (!isPendingReviewDecision(record)) return undefined;
  const declined = records
    .slice(index + 1)
    .some(
      value =>
        isRecord(value) &&
        value.version === 1 &&
        value.disposition === 'declined' &&
        value.review_id === record.review_id &&
        value.finding_fingerprint === record.finding_fingerprint,
    );
  return declined ? undefined : record;
}

// This first persistence slice covers legacy declines in the two planning phases.
// Explicit dispute-class routing is separate work; a saved question grants no authority.
function pendingDecision(
  request: RecordReviewDispositionRequest,
  kind: PlanningReviewKind,
  finding: Finding,
  source: { readonly origin: unknown; readonly plan: string; readonly boundary: string },
): PendingReviewDecision {
  const question = `Decline this suggestion outside accepted scope? ${finding.message}`;
  const record = {
    version: 2 as const,
    ticket_id: request.ticketId,
    review_id: request.reviewId,
    review_kind: kind,
    finding_number: Number(request.findingNumber),
    finding_fingerprint: reviewDispositionFindingFingerprint(finding.severity, finding.message),
    finding_severity: finding.severity,
    finding_message: finding.message,
    origin_agent: source.origin,
    plan_digest: createHash('sha256').update(source.plan).digest('hex'),
    accepted_boundary_digest: source.boundary,
    disposition: 'pending-user-decision' as const,
    dispute_class: 'scope' as const,
    reason: request.reason,
    evidence: request.reason,
    question,
    action: `Ask the user to decide: ${question}`,
  };
  if (!isPendingReviewDecision(record))
    throw new Error('The pending finding lacks valid provenance.');
  return record;
}

function recoveredPending(
  content: string,
  request: RecordReviewDispositionRequest,
): CliResult | undefined {
  const saved = savedPendingDecision(content, request);
  return saved === undefined
    ? undefined
    : pending(
        { ...request, reason: saved.reason },
        saved.review_kind as PlanningReviewKind,
        { severity: saved.finding_severity, message: saved.finding_message },
        saved,
      );
}

function writePendingDecision(
  request: RecordReviewDispositionRequest,
  ticketPath: string,
  source: {
    readonly kind: PlanningReviewKind;
    readonly finding: Finding;
    readonly before: string;
    readonly boundary: string;
    readonly origin: unknown;
    readonly targetPath: string;
  },
): CliResult {
  try {
    const decision = pendingDecision(request, source.kind, source.finding, {
      origin: source.origin,
      plan: readFileSync(source.targetPath, 'utf8'),
      boundary: source.boundary,
    });
    return writeDisposition(
      request,
      ticketPath,
      source.kind,
      source.finding,
      source.before,
      source.boundary,
      decision,
    );
  } catch (error) {
    return writeUnavailable(error instanceof Error ? error.message : String(error));
  }
}

// eslint-disable-next-line complexity -- Preserve distinct pending and failed outcomes at the public command boundary.
export async function recordReviewDisposition(
  request: RecordReviewDispositionRequest,
): Promise<CliResult> {
  if (request.reason.trim() === '') {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'DISPOSITION_REASON_REQUIRED',
          message: 'Give a reason for declining this finding.',
          retryable: false,
        },
      ],
      data: { command },
    });
  }
  const directory = resolveTicketDirectory(request.cwd, request.ticketId);
  const ticketPath = directory === undefined ? undefined : nodePath.join(directory, 'ticket.md');
  if (ticketPath === undefined || !existsSync(ticketPath)) {
    return createResult({
      state: 'failed',
      errors: [
        { code: 'TICKET_NOT_FOUND', message: 'The ticket does not resolve.', retryable: false },
      ],
      data: { command },
    });
  }
  const before = readFileSync(ticketPath, 'utf8');
  const noninteractive = request.noInput || !process.stdin.isTTY || !process.stderr.isTTY;
  const recovered = noninteractive ? recoveredPending(before, request) : undefined;
  if (recovered !== undefined) return recovered;
  const data = currentReview(request.cwd, request.reviewId);
  if (data === undefined) {
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'REVIEW_NOT_CURRENT',
          message: 'The named review is not an authenticated current planning approval.',
          severity: 'warning',
        },
      ],
      data: { command, status: 'pending', review_id: request.reviewId },
    });
  }
  const kind = data.review_kind as PlanningReviewKind;
  const targetName = {
    'quality-review': 'spec.md',
    'plan-implementation': 'impl-plan.md',
    'plan-execution': 'execution-plan.md',
  }[kind];
  const targetPath = nodePath.join(nodePath.dirname(ticketPath), targetName);
  const expectedTarget = toReviewPath(nodePath.relative(request.cwd, targetPath));
  const selected = selectedFinding(data, request.findingNumber, expectedTarget);
  if (selected === undefined) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'INVALID_REVIEW_FINDING',
          message: 'Select one warning or info finding from this ticket’s authenticated review.',
          retryable: false,
        },
      ],
      data: { command },
    });
  }
  const { metadata } = parseTicketMetadata(before);
  const planningPhase = ['plan-implementation', 'plan-execution'].includes(String(metadata.phase));
  if (noninteractive && !planningPhase) return pending(request, kind, selected);
  let boundaryDigest: string;
  try {
    boundaryDigest = currentBoundaryDigest(request.cwd, ticketPath, before);
  } catch {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'REVIEW_DISPOSITION_BOUNDARY_INVALID',
          message:
            'The accepted ticket and Product Plan boundary cannot be read. Repair them before recording a decline.',
          retryable: false,
        },
      ],
      data: { command },
    });
  }
  if (noninteractive) {
    return writePendingDecision(request, ticketPath, {
      kind,
      finding: selected,
      before,
      boundary: boundaryDigest,
      origin: data.actual_reviewer,
      targetPath,
    });
  }
  if (!(await confirm(selected, boundaryDigest, request.reason)))
    return pending(request, kind, selected);
  return writeDisposition(request, ticketPath, kind, selected, before, boundaryDigest);
}
