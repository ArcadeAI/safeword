import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { getTicketInfo } from './active-ticket.js';
import { checkVerifyArtifact } from './done-gate.js';
import { atomicWriteFile } from './jsonl-spool.js';
import { resolveNamespaceRoot } from './namespace-root.js';
import { ensureTransientStateIgnore } from './project-state.js';
import { readSessionState } from './quality-state.js';
import { commandWords, splitShellSegments } from './shell-segments.js';

/** Classification for local pull-request readiness mutations. */
export type PrReadinessCommand = 'ready' | 'draft' | 'other';

function classifyArguments(words: string[]): PrReadinessCommand {
  if (nodePath.basename(words[0] ?? '') !== 'gh') return 'other';
  if (words[1] !== 'pr') return 'other';

  const operation = words[2];
  const arguments_ = words.slice(3);
  if (operation === 'ready') return arguments_.includes('--undo') ? 'draft' : 'ready';
  if (operation !== 'create') return 'other';
  return arguments_.some(argument => argument === '--draft' || argument === '-d')
    ? 'draft'
    : 'ready';
}

export function classifyPrReadinessCommand(command: string): PrReadinessCommand {
  let classification: PrReadinessCommand = 'other';
  for (const segment of splitShellSegments(command)) {
    const segmentClassification = classifyArguments(commandWords(segment));
    if (segmentClassification === 'ready') return 'ready';
    if (segmentClassification === 'draft') classification = 'draft';
  }
  return classification;
}

export interface PrReadinessVerdict {
  ok: boolean;
  reason?: string;
}

interface ReadinessReceipt {
  schema_version: 1;
  ticket_id: string;
  head_sha: string;
}

function readReceipt(projectDirectory: string): ReadinessReceipt | undefined {
  try {
    const parsed = JSON.parse(
      readFileSync(
        nodePath.join(resolveNamespaceRoot(projectDirectory), 'readiness-ticket.json'),
        'utf8',
      ),
    ) as Partial<ReadinessReceipt>;
    return parsed.schema_version === 1 &&
      typeof parsed.ticket_id === 'string' &&
      parsed.ticket_id.length > 0 &&
      typeof parsed.head_sha === 'string' &&
      parsed.head_sha.length > 0
      ? (parsed as ReadinessReceipt)
      : undefined;
  } catch {
    return undefined;
  }
}

function currentHead(projectDirectory: string): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: projectDirectory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

/** Publish exact-HEAD readiness evidence after verified ticket completion. */
export function finalizeReadinessReceipt(projectDirectory: string, ticketId: string): boolean {
  const ticket = getTicketInfo(projectDirectory, ticketId);
  if (!ticket.folder || ticket.status !== 'done') return false;
  const verifyPath = nodePath.join(
    resolveNamespaceRoot(projectDirectory),
    'tickets',
    ticket.folder,
    'verify.md',
  );
  let verifyContent: string;
  try {
    verifyContent = readFileSync(verifyPath, 'utf8');
  } catch {
    return false;
  }
  if (!checkVerifyArtifact(verifyContent).ok) return false;
  const head = currentHead(projectDirectory);
  if (!head) return false;

  const receiptPath = nodePath.join(
    resolveNamespaceRoot(projectDirectory),
    'readiness-ticket.json',
  );
  try {
    ensureTransientStateIgnore(projectDirectory, 'readiness-ticket.json');
    atomicWriteFile(
      receiptPath,
      `${JSON.stringify({ schema_version: 1, ticket_id: ticketId, head_sha: head })}\n`,
    );
    return true;
  } catch {
    return false;
  }
}

function unfinished(reason: string): PrReadinessVerdict {
  return { ok: false, reason: `This change is not finished. ${reason}` };
}

function evaluateTicket(
  projectDirectory: string,
  ticketId: string,
  receipt: ReadinessReceipt | undefined,
): PrReadinessVerdict {
  const ticket = getTicketInfo(projectDirectory, ticketId);
  if (!ticket.folder) {
    return unfinished(`Repair ticket ${ticketId} so Safeword can read it, then retry.`);
  }
  if (!ticket.phase || !ticket.status) {
    return unfinished(
      `repair the ticket state for ${ticketId}, then retry making the pull request Ready.`,
    );
  }

  if (ticket.status !== 'done') {
    if (ticket.phase === 'done') {
      return unfinished(
        `Ticket ${ticketId} is at ticket closure; close the verified ticket before making the pull request Ready.`,
      );
    }
    const phaseLabel = ticket.phase === 'implement' ? 'implementation' : ticket.phase;
    const nextAction =
      ticket.phase === 'implement' ? 'complete the current scenario' : `finish ${ticket.phase}`;
    return unfinished(
      `Ticket ${ticketId} is at ${phaseLabel}; ${nextAction} before making the pull request Ready.`,
    );
  }

  const verifyPath = nodePath.join(
    resolveNamespaceRoot(projectDirectory),
    'tickets',
    ticket.folder,
    'verify.md',
  );
  if (!existsSync(verifyPath)) {
    return unfinished(
      `Ticket ${ticketId} has no verification evidence; run verification before making the pull request Ready.`,
    );
  }
  let verifyContent: string;
  try {
    verifyContent = readFileSync(verifyPath, 'utf8');
  } catch {
    return unfinished(
      `Ticket ${ticketId} verification evidence cannot be read; restore verify.md, then run verification again.`,
    );
  }
  if (!checkVerifyArtifact(verifyContent).ok) {
    return unfinished(
      `Ticket ${ticketId} has invalid verification evidence; run verification again before making the pull request Ready.`,
    );
  }

  const head = currentHead(projectDirectory);
  if (!receipt || receipt.ticket_id !== ticketId || !head || receipt.head_sha !== head) {
    return unfinished(
      `Ticket ${ticketId} is verified, but ticket closure is not recorded at the current commit; close the verified ticket or run verification again.`,
    );
  }
  return unfinished(`Ticket ${ticketId} is verified, but verified Ready promotion is not enabled.`);
}

export function evaluatePrReadiness(
  projectDirectory: string,
  sessionId: string | undefined,
): PrReadinessVerdict {
  const state = readSessionState(projectDirectory, sessionId);
  const receipt = readReceipt(projectDirectory);
  const ticketId = state?.activeTicket ?? state?.recentCompletedTicket ?? receipt?.ticket_id;
  if (!ticketId) {
    return {
      ok: false,
      reason:
        'This change is not finished. Open or resume the delivery ticket, then complete its next action before making the pull request Ready.',
    };
  }
  return evaluateTicket(projectDirectory, ticketId, receipt);
}
