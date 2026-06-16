/**
 * Breakpoint orchestrator (ticket HPQ43R) — decides what happens at a single
 * would-be human-in-the-loop pause, given the axis posture, the always-confirm
 * denylist, and the fail-safe failure handling.
 *
 * This is the decision contract the live-session wiring sits on: the actual
 * tool interception and work-log writes call `resolveBreakpoint` and act on
 * its result. Keeping the decision pure (the `/figure-it-out` runner is
 * injected) makes the whole flow unit-testable without an agent session.
 */

import { decideFailureAction, type Posture, resolveBreakpointAction } from './autonomy-policy.js';

/**
 * Irreversible or outward actions that always confirm with the human,
 * regardless of posture — external side-effects has no autonomous setting.
 * (LOC / done / verify hard gates are enforced separately by safeword's
 * existing hooks; this denylist is the deliberative-pause floor.)
 */
const DENYLIST: ReadonlySet<string> = new Set([
  'git-push',
  'git-force-push',
  'git-reset-hard',
  'branch-delete',
  'send-external-message',
  'delete-outside-ticket',
  'mark-ticket-done',
  'touch-secrets',
]);

export function isDenylisted(action: string): boolean {
  return DENYLIST.has(action);
}

/** Result of one autonomous `/figure-it-out` attempt, injected by the caller. */
export interface FigureItOutAttempt {
  outcome: 'success' | 'transient-error' | 'inconclusive';
  /** The chosen resolution, present only on success. */
  decision?: string;
}

export interface BreakpointInput {
  posture: Posture;
  question: string;
  /** The tool/action about to run, if this breakpoint guards one. */
  action?: string;
  runFigureItOut: () => FigureItOutAttempt;
}

/** A logged autonomous resolution (DEV3.AC3). */
export interface ResolutionRecord {
  question: string;
  decision: string;
}

export type BreakpointResult =
  | { action: 'pause' }
  | { action: 'resolved'; record: ResolutionRecord }
  | { action: 'defer' };

/** Maximum attempts: the first try plus one retry on a transient failure. */
const MAX_ATTEMPTS = 2;

/**
 * Resolve a single breakpoint. A denylisted action always pauses. Otherwise
 * an `ask` axis pauses and an `autonomous` axis runs `/figure-it-out`, with
 * one retry on a transient failure and a fail-safe defer on a repeated error
 * or an inconclusive verdict — never a silent proceed.
 */
export function resolveBreakpoint(input: BreakpointInput): BreakpointResult {
  if (input.action !== undefined && isDenylisted(input.action)) return { action: 'pause' };
  if (resolveBreakpointAction(input.posture) === 'pause') return { action: 'pause' };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = input.runFigureItOut();
    const next = decideFailureAction({ outcome: result.outcome, attempts: attempt });
    if (next === 'proceed') {
      return {
        action: 'resolved',
        record: { question: input.question, decision: result.decision ?? '' },
      };
    }
    if (next === 'defer') return { action: 'defer' };
    // next === 'retry' → loop once more
  }
  return { action: 'defer' };
}
