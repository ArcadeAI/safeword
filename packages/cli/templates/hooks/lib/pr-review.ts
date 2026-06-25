// Safeword: eng-review-on-green-PRs decision core (ticket Y9WX8R). Pure, no I/O.
// The skill and the merge gate wire these to the real review ledger; this module
// only decides. Mirrors review-ledger.ts conventions (manual type guards, no
// schema lib; `.js` specifiers so tsc resolves the .ts source under test).

import { isValidSkipReason } from './parse-annotation.js';
import { type GateVerdict, modelsMatch } from './review-ledger.js';

export const VERDICTS = ['APPROVE', 'REQUEST-CHANGES', 'NEEDS-DISCUSSION'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const SEVERITIES = ['blocker', 'should-fix', 'nit'] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface Finding {
  /** `path:line` of the concrete failure — never a bare adjective. */
  location: string;
  /** Non-empty description of the specific failure mode. */
  failureMode: string;
  severity: Severity;
}

export interface ReviewResult {
  verdict: Verdict;
  findings: Finding[];
  /** Required (non-empty) when the verdict is not APPROVE. */
  nextAction?: string;
}

export type ReviewResultValidation =
  | { ok: true; data: ReviewResult }
  | { ok: false; reason: string };

/**
 * `path:line` — a path with no whitespace or colon, a colon, a line number.
 * Excluding whitespace keeps a prose blob like "looks fragile here:99" from
 * masquerading as a location; excluding colon from the path segment keeps the
 * two quantifiers disjoint and non-backtracking (no ReDoS surface).
 */
const LOCATION = /^[^\s:]+:\d+$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateFinding(value: unknown, index: number): { reason: string } | undefined {
  if (typeof value !== 'object' || value === null) {
    return { reason: `findings[${index}] must be an object` };
  }
  const finding = value as Record<string, unknown>;
  if (typeof finding.location !== 'string' || !LOCATION.test(finding.location)) {
    return { reason: `findings[${index}] is missing a file:line location` };
  }
  if (!isNonEmptyString(finding.failureMode)) {
    return { reason: `findings[${index}] must name a concrete failure mode` };
  }
  if (!SEVERITIES.includes(finding.severity as Severity)) {
    return { reason: `findings[${index}].severity must be one of: ${SEVERITIES.join(', ')}` };
  }
  return undefined;
}

/**
 * Validate an already-parsed review result against the contract: a known
 * verdict, well-formed findings (file:line + concrete failure mode + known
 * severity), and a next action whenever the verdict is not APPROVE. Returns the
 * narrowed result on success, a human reason on failure — never throws.
 */
/** Validate the findings array — every entry well-formed — or return a reason. */
function validateFindings(value: unknown): { findings: Finding[] } | { reason: string } {
  if (!Array.isArray(value)) return { reason: 'findings must be an array' };
  for (const [index, finding] of value.entries()) {
    const failure = validateFinding(finding, index);
    if (failure !== undefined) return { reason: failure.reason };
  }
  return { findings: value as Finding[] };
}

export function validateReviewResult(data: unknown): ReviewResultValidation {
  if (typeof data !== 'object' || data === null) {
    return { ok: false, reason: 'review result must be an object' };
  }
  const object = data as Record<string, unknown>;

  if (!VERDICTS.includes(object.verdict as Verdict)) {
    return { ok: false, reason: `verdict must be one of: ${VERDICTS.join(', ')}` };
  }

  const findingsResult = validateFindings(object.findings);
  if ('reason' in findingsResult) return { ok: false, reason: findingsResult.reason };

  if (object.verdict === 'APPROVE' && findingsResult.findings.some(f => f.severity === 'blocker')) {
    return {
      ok: false,
      reason: 'an APPROVE verdict cannot carry a blocker finding — a blocker means do not merge',
    };
  }

  if (object.verdict !== 'APPROVE' && !isNonEmptyString(object.nextAction)) {
    return { ok: false, reason: 'a non-approving verdict must state a next action' };
  }

  return { ok: true, data: object as unknown as ReviewResult };
}

/**
 * Parse raw review output as JSON, then validate it. Output that does not parse
 * is rejected as malformed — the gate fails closed rather than treating
 * unparseable output as a pass.
 */
export function parseReviewResult(raw: string): ReviewResultValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      reason: 'review output is malformed: not parseable as a structured result',
    };
  }
  return validateReviewResult(parsed);
}

// ── Provenance, skip, and the merge gate ────────────────────────────────────

/**
 * Canonical PR review scope: `<pr-number>@<head-sha>`. A receipt satisfies the
 * gate only for the same PR at the same head commit — pushing a new commit
 * changes the sha, so a prior receipt no longer matches (auto-staleness).
 */
export function prReviewScope(prNumber: number, headSha: string): string {
  return `${prNumber}@${headSha}`;
}

export interface PrReceipt {
  prNumber: number;
  headSha: string;
  /** `review` = an actual review; `skip` = a deliberate, audited break-glass bypass. */
  kind: 'review' | 'skip';
  /** Review receipts only: whether any finding is blocker-severity. */
  hasBlocker: boolean;
  /** Skip receipts only: the non-empty justification, retained for audit. */
  skipReason?: string;
  /**
   * The reviewing model, when recorded. Cross-model independence is enforced both
   * at record time ({@link acceptReview}) and again by {@link evaluateMergeGate}
   * when `crossModelRequired` — the gate refuses a same-model review even if
   * recording glue minted one.
   */
  reviewerModel?: string;
}

/** Build a review receipt from a validated result; blocker-ness derives from the findings. */
export function receiptFromResult(
  prNumber: number,
  headSha: string,
  result: ReviewResult,
  reviewerModel?: string,
): PrReceipt {
  const receipt: PrReceipt = {
    prNumber,
    headSha,
    kind: 'review',
    hasBlocker: result.findings.some(f => f.severity === 'blocker'),
  };
  if (reviewerModel !== undefined) receipt.reviewerModel = reviewerModel;
  return receipt;
}

export type SkipResult = { ok: true; receipt: PrReceipt } | { ok: false; reason: string };

/**
 * Record a deliberate skip — a break-glass bypass, recorded as a `skip` (never an
 * approval), retaining its reason for audit. An empty reason is rejected: a
 * deliberate bypass must be attributable.
 */
export function recordSkip(prNumber: number, headSha: string, reason: string): SkipResult {
  if (!isValidSkipReason(reason)) {
    return { ok: false, reason: 'a deliberate bypass must state a reason' };
  }
  return {
    ok: true,
    receipt: { prNumber, headSha, kind: 'skip', hasBlocker: false, skipReason: reason },
  };
}

/** Whether the ledger holds a fresh (head-bound) review approval with no blocker. */
export function hasFreshApproval(
  prNumber: number,
  headSha: string,
  receipts: readonly PrReceipt[],
): boolean {
  const scope = prReviewScope(prNumber, headSha);
  return receipts.some(
    r => prReviewScope(r.prNumber, r.headSha) === scope && r.kind === 'review' && !r.hasBlocker,
  );
}

export interface MergeGateInput {
  gateEnabled: boolean;
  prNumber: number;
  headSha: string;
  receipts: readonly PrReceipt[];
  /** When true, a fresh review must come from a model other than the author. */
  crossModelRequired?: boolean;
  /** The author/main-session model, compared against each review's reviewerModel. */
  authorModel?: string;
}

/**
 * The merge gate (default-off via prReviewGate). When on, merge requires a fresh,
 * head-bound receipt. Precedence is findings-driven, not verdict-driven (the
 * blocker-only design law):
 *
 * 1. A concrete blocker finding at this head always blocks — fail closed, even if
 *    a skip is also present: a blocker contradicts the "review not applicable"
 *    skip premise, so it must win.
 * 2. A deliberate skip then permits (break-glass — a gate people can't bypass
 *    openly gets bypassed secretly), now that no blocker masks it.
 * 3. Otherwise a fresh non-blocker review permits; advisory findings
 *    (should-fix / nit) never block. When cross-model review is required, at
 *    least one such review must be independent (reviewer != author) — enforced
 *    here as defense in depth, not only at record time.
 */
export function evaluateMergeGate(input: MergeGateInput): GateVerdict {
  if (!input.gateEnabled) return { ok: true };
  const scope = prReviewScope(input.prNumber, input.headSha);
  const fresh = input.receipts.filter(r => prReviewScope(r.prNumber, r.headSha) === scope);
  if (fresh.length === 0) {
    return {
      ok: false,
      reason: `no fresh review for ${scope} — review the PR at its current head (or log a skip with a reason) before merge`,
    };
  }
  if (fresh.some(r => r.kind === 'review' && r.hasBlocker)) {
    return {
      ok: false,
      reason: `merge blocked: an unresolved blocker finding remains for ${scope}`,
    };
  }
  if (fresh.some(r => r.kind === 'skip')) return { ok: true };
  if (input.crossModelRequired) {
    const independent = fresh.some(
      r => r.kind === 'review' && !modelsMatch(r.reviewerModel, input.authorModel),
    );
    if (!independent) {
      return {
        ok: false,
        reason: `merge blocked: cross-model review requires an independent reviewer (reviewer != author) for ${scope}`,
      };
    }
  }
  return { ok: true };
}

// ── Independence, finding usefulness, and review depth ──────────────────────

/**
 * Whether a review may be recorded given the cross-model policy. When required,
 * the reviewer model must differ from the author model — a same-model (or
 * indeterminate) review is rejected so the gate fails closed on independence.
 * Reuses {@link modelsMatch} (trimmed, case-insensitive, indeterminate = match).
 */
export function acceptReview(options: {
  crossModelRequired: boolean;
  authorModel?: string;
  reviewerModel?: string;
}): GateVerdict {
  if (options.crossModelRequired && modelsMatch(options.reviewerModel, options.authorModel)) {
    return {
      ok: false,
      reason: 'same-model review rejected: cross-model review requires an independent reviewer',
    };
  }
  return { ok: true };
}

export interface SurfacedFinding {
  location: string;
  /** Whether the developer acted on this finding (vs. dismissed it as noise). */
  actedOn: boolean;
}

/** Record a finding's disposition — whether the developer acted on it. */
export function markActedOn(finding: SurfacedFinding, actedOn: boolean): SurfacedFinding {
  return { ...finding, actedOn };
}

/**
 * The effective false-positive rate (Tricorder's definition): the fraction of
 * surfaced findings the developer did NOT act on — true-but-trivial included.
 * This is the metric that predicts abandonment; the design north-star keeps it
 * under ~10%. An empty set has no signal, so the rate is 0.
 */
export function effectiveFalsePositiveRate(dispositions: readonly { actedOn: boolean }[]): number {
  if (dispositions.length === 0) return 0;
  const notActedOn = dispositions.filter(d => !d.actedOn).length;
  return notActedOn / dispositions.length;
}

export type ReviewDepth = 'lightweight' | 'thorough';

/** Changed-line count above which a diff gets a thorough review by default. */
export const DEFAULT_REVIEW_SIZE_THRESHOLD = 100;

/**
 * Scale review depth to change risk: a sensitive-path diff is always thorough
 * (risk, not line count, escalates depth); otherwise a diff over the size
 * threshold is thorough, and a small low-risk diff is lightweight. Over-
 * reviewing tiny changes is how a reviewer trains people to ignore it.
 */
export function selectReviewDepth(options: {
  changedLines: number;
  touchesSensitivePath: boolean;
  sizeThreshold?: number;
}): ReviewDepth {
  if (options.touchesSensitivePath) return 'thorough';
  const threshold = options.sizeThreshold ?? DEFAULT_REVIEW_SIZE_THRESHOLD;
  return options.changedLines > threshold ? 'thorough' : 'lightweight';
}

export { type GateVerdict } from './review-ledger.js';
