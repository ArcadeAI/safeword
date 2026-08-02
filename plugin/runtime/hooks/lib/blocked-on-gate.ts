/**
 * MBGQ89 blocked_on hard gate (always-on).
 *
 * On a ticket.md edit that advances `phase:` OUT OF `intake`, deny while any
 * same-repo `blocked_on` target is not `done`. `done` is the only clean
 * auto-unblock; every other non-done state (in_progress, the terminal-but-
 * abandoned cancelled/superseded/wontfix, or an unreadable status that fails
 * safe) opens only via a substantive `blocked_on_override` reason. Unresolvable
 * ids (not in the corpus) never block — they may be cross-repo or live on
 * another branch. One hop: only the ticket's own direct blockers are checked,
 * so a blocked_on cycle simply denies (no graph recursion, no loop).
 *
 * Joins the existing pre-tool-quality phase-gate family. Pure + injected lookup
 * so it is unit-testable without disk.
 */

import { parseFrontmatter } from './hierarchy.ts';
import { detectPhaseAdvance } from './review-ledger.ts';

/** A blocker's resolution: whether it exists in the corpus, and its status. */
export interface BlockerStatus {
  found: boolean;
  status: string | undefined;
}

export type BlockerLookup = (id: string) => BlockerStatus;

export interface GateDenial {
  reason: string;
  additionalContext: string;
}

// Reasons too trivial to count as a real override — rejected like an empty one.
const TRIVIAL_OVERRIDE_REASONS = new Set([
  'proceeding',
  'n/a',
  'na',
  'none',
  'tbd',
  'wip',
  'skip',
  '-',
  'x',
]);

/**
 * Coerce a frontmatter value into ids. `parseFrontmatter` yields the inline
 * scalar (`[A, B]`) as a string and a YAML block list as a string[].
 */
function toIdList(raw: string | string[] | undefined): string[] {
  if (raw === undefined) return [];
  const parts = Array.isArray(raw)
    ? raw
    : raw.trim().replace(/^\[/, '').replace(/\]$/, '').split(',');
  return parts.map(id => id.trim()).filter(id => id.length > 0);
}

/** A non-empty override reason that is not on the trivial denylist. */
function isSubstantiveOverride(raw: string | string[] | undefined): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 && !TRIVIAL_OVERRIDE_REASONS.has(trimmed);
}

/**
 * Evaluate the gate against an edit's prior + proposed ticket content. Returns a
 * denial when the advance must be blocked, or undefined to allow.
 * @param priorContent the on-disk ticket.md content before the edit
 * @param proposedContent the content the edit would produce
 * @param lookup resolves a blocker id to its existence + status
 */
export function evaluateBlockedOnGate(
  priorContent: string,
  proposedContent: string,
  lookup: BlockerLookup,
): GateDenial | undefined {
  // Fire only on the intake → next transition (transition-only + grandfather).
  if (detectPhaseAdvance(priorContent, proposedContent) !== 'intake') return undefined;

  const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(proposedContent);
  if (frontmatterMatch === null) return undefined;
  const fields = parseFrontmatter(frontmatterMatch[1] ?? '');

  const blockers = toIdList(fields['blocked_on']);
  if (blockers.length === 0) return undefined;

  // Resolvable, non-done blockers are blocking. Unresolvable ids never block.
  const blocking = blockers
    .map(id => ({ id, ...lookup(id) }))
    .filter(blocker => blocker.found && blocker.status !== 'done');
  if (blocking.length === 0) return undefined;

  // A substantive override opens the gate past every non-done blocker.
  if (isSubstantiveOverride(fields['blocked_on_override'])) return undefined;

  const [first] = blocking;
  if (first === undefined) return undefined;
  const label = first.status ?? 'unreadable';
  return {
    reason: `BLOCKED on ${first.id} (status: ${label})`,
    additionalContext:
      `Advancing out of intake is denied while a blocked_on target is not done. ` +
      `Finish ${first.id}, or — if it is intentionally abandoned — set ` +
      '`blocked_on_override: <a real reason proceeding is safe>` to override.',
  };
}
