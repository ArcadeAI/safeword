import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';

import { parseDocument } from 'yaml';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { reviewJobStatus, withFileLock } from '../review/job.js';
import { acceptedBoundaryDigest } from '../review/planning-accepted-boundary.js';
import { resolveTicketDirectory } from '../utils/product-plan-contract.js';
import { parseTicketMetadata } from '../utils/ticket-metadata.js';

const command = 'ticket record-review-disposition';
type PlanningReviewKind = 'quality-review' | 'plan-implementation' | 'plan-execution';

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
  finding: { readonly severity: 'info' | 'warning'; readonly message: string },
): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'REVIEW_DISPOSITION_PENDING',
        message: `Declining this ${finding.severity} finding requires interactive confirmation: ${finding.message}`,
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
    },
  });
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
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
  finding: { readonly severity: 'info' | 'warning'; readonly message: string },
  boundaryDigest: string,
): string {
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/u.exec(content);
  if (match === null) throw new Error('The ticket has no valid frontmatter.');
  const document = parseDocument(match[2] ?? '', { uniqueKeys: true });
  if (document.errors.length > 0) throw new Error('The ticket has invalid frontmatter.');
  const existing: unknown = document.get('review_dispositions');
  if (existing !== undefined && !Array.isArray(existing))
    throw new Error('The ticket review dispositions are invalid.');
  const records = Array.isArray(existing) ? existing : [];
  document.set('review_dispositions', [
    ...records,
    {
      version: 1,
      review_id: request.reviewId,
      review_kind: kind,
      finding_fingerprint: digest(JSON.stringify(finding)),
      finding_severity: finding.severity,
      finding_message: finding.message,
      accepted_boundary_digest: boundaryDigest,
      disposition: 'declined',
      reason: request.reason,
    },
  ]);
  return `${match[1]}${String(document).trimEnd()}${match[3]}${content.slice(match[0].length)}`;
}

async function confirm(
  finding: { readonly severity: 'info' | 'warning'; readonly message: string },
  boundaryDigest: string,
  reason: string,
): Promise<boolean> {
  process.stderr.write(
    `Finding (${finding.severity}): ${finding.message}\nAccepted boundary: ${boundaryDigest}\nDecline reason: ${reason}\n`,
  );
  const prompt = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await prompt.question('Record this decline in the ticket? [y/N] ');
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    prompt.close();
  }
}

type Finding = { readonly severity: 'info' | 'warning'; readonly message: string };

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
): CliResult {
  const lockPath = `${ticketPath}.review-disposition.lock`;
  try {
    return withFileLock(lockPath, () => {
      if (
        readFileSync(ticketPath, 'utf8') !== before ||
        currentBoundaryDigest(request.cwd, ticketPath, before) !== boundaryDigest ||
        currentReview(request.cwd, request.reviewId) === undefined
      )
        return pending(request, kind, finding);
      const next = addDisposition(before, request, kind, finding, boundaryDigest);
      const temporary = `${ticketPath}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temporary, next, { flag: 'wx', mode: statSync(ticketPath).mode & 0o777 });
        renameSync(temporary, ticketPath);
      } finally {
        if (existsSync(temporary)) unlinkSync(temporary);
      }
      return createResult({
        state: 'changed',
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
        data: {
          command,
          status: 'recorded',
          ticket_id: request.ticketId,
          review_id: request.reviewId,
        },
      });
    });
  } catch {
    return writeUnavailable(
      'The ticket or lock could not be updated atomically. Check the ticket before retrying.',
    );
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
  const expectedTarget = nodePath.relative(
    request.cwd,
    nodePath.join(nodePath.dirname(ticketPath), targetName ?? ''),
  );
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
  if (request.noInput || !process.stdin.isTTY || !process.stderr.isTTY)
    return pending(request, kind, selected);
  const before = readFileSync(ticketPath, 'utf8');
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
  if (!(await confirm(selected, boundaryDigest, request.reason)))
    return pending(request, kind, selected);
  return writeDisposition(request, ticketPath, kind, selected, before, boundaryDigest);
}
