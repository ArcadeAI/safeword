import nodePath from 'node:path';

import { getTicketInfo } from './active-ticket.js';
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
  for (const segment of splitShellSegments(command)) {
    const classification = classifyArguments(commandWords(segment));
    if (classification !== 'other') return classification;
  }
  return 'other';
}

export interface PrReadinessVerdict {
  ok: boolean;
  reason?: string;
}

export function evaluatePrReadiness(
  projectDirectory: string,
  sessionId: string | undefined,
): PrReadinessVerdict {
  const activeTicket = readSessionState(projectDirectory, sessionId)?.activeTicket;
  if (!activeTicket) {
    return {
      ok: false,
      reason:
        'This change is not finished. Open or resume the delivery ticket, then complete its next action before making the pull request Ready.',
    };
  }

  const ticket = getTicketInfo(projectDirectory, activeTicket);
  if (!ticket.folder) {
    return {
      ok: false,
      reason: `This change is not finished. Repair ticket ${activeTicket} so Safeword can read it, then retry.`,
    };
  }

  if (ticket.status !== 'done') {
    const phase = ticket.phase ?? 'unfinished work';
    const phaseLabel = phase === 'implement' ? 'implementation' : phase;
    const nextAction = phase === 'implement' ? 'complete the current scenario' : `finish ${phase}`;
    return {
      ok: false,
      reason: `This change is not finished. Ticket ${activeTicket} is at ${phaseLabel}; ${nextAction} before making the pull request Ready.`,
    };
  }

  return { ok: true };
}
