// When the reviewer runs (ticket 36EEMY, Rule TB1.R8).
//
// Once per change the author has declared ready AND whose CI is green — not on
// every push, never while red. Reviewing red code wastes the pass: it is still
// changing while the author fixes CI, and its mechanical failures are CI's job,
// not the reviewer's (R1).
//
// The triggering EVENT is only a coarse signal that something finished. The
// authoritative answer comes from reading the head SHA's checks, because a repo
// has several check suites per commit — one per app, plus one per Actions
// workflow run — so no single suite completing means "all required checks are
// green".

import { RECEIPT_CHECK_NAME } from './verdict.js';

export type CiState = 'green' | 'red' | 'pending';

export interface CheckRun {
  name: string;
  /** Absent while the check is still running — GitHub reports a null conclusion. */
  conclusion?:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    // Real GitHub conclusions that are neither pass nor fail. Listed rather than
    // cast away: both mean "not green yet", so they fall through to pending.
    | 'action_required'
    | 'stale';
}

/** Which source answered "what is required here", for the run log. */
type RequiredSetTier = 'rulesets' | 'config' | 'all-checks';

export interface RequiredSetInput {
  /** `required_status_checks` contexts from GET /repos/{o}/{r}/rules/branches/{branch}. */
  rulesetChecks: string[];
  /** `.safeword/config.json` → `prReview.requiredChecks`. */
  configuredChecks: string[];
}

export interface RequiredSet {
  /** The required check names, or `undefined` when none could be determined. */
  checks: string[] | undefined;
  tier: RequiredSetTier;
}

/**
 * Resolve which checks must pass, preferring the source closest to the truth.
 *
 * 1. **rulesets** — `GET /rules/branches/{branch}` needs only Metadata: read, so
 *    an ordinary workflow token can read it. (The classic
 *    `/branches/{branch}/protection/required_status_checks` needs
 *    Administration: read, which a customer's runner will not have.)
 * 2. **config** — the fallback for repos still on classic branch protection,
 *    where the rules endpoint returns nothing. NOT an override: rulesets win
 *    when present, because the repository's own enforced rules are closer to
 *    the truth than a hand-maintained list that drifts.
 * 3. **all-checks** — last resort. Over-strict by design: it can never review
 *    red code, but one flaky optional check suppresses reviews indefinitely,
 *    which reads as "the reviewer is broken". That is why the tier is reported
 *    and logged rather than silently applied.
 */
export function resolveRequiredChecks(input: RequiredSetInput): RequiredSet {
  if (input.rulesetChecks.length > 0) return { checks: input.rulesetChecks, tier: 'rulesets' };
  if (input.configuredChecks.length > 0) return { checks: input.configuredChecks, tier: 'config' };
  return { checks: undefined, tier: 'all-checks' };
}

/**
 * Reduce the head SHA's checks to one state, against the required set.
 *
 * The reviewer's own receipt is always excluded. It is written AFTER the review
 * runs, so counting it would mean CI is never green until the review that is
 * waiting on green has already happened — a self-deadlock. This is why the
 * receipt ships as a NON-required check.
 */
export function computeCiState(checks: CheckRun[], required: string[] | undefined): CiState {
  const observed = checks.filter(check => check.name !== RECEIPT_CHECK_NAME);
  const requiredNames = required?.filter(name => name !== RECEIPT_CHECK_NAME);

  // No known required set (tier 3): every observed check must satisfy.
  if (requiredNames === undefined) {
    // Nothing observed is NOT green. `[].every()` is true, so this has to be
    // explicit — and a repo whose CI reports only through the legacy
    // commit-status API produces zero check runs, which would otherwise read as
    // green and review red code.
    if (observed.length === 0) return 'pending';
    if (observed.some(check => isFailure(check))) return 'red';
    return observed.every(check => isSatisfied(check)) ? 'green' : 'pending';
  }

  // Same fail-closed rule once the receipt is excluded: an empty required set
  // means we learned nothing, not that everything passed.
  if (requiredNames.length === 0) return 'pending';

  const states = requiredNames.map(name => observed.find(check => check.name === name));
  if (states.some(check => check !== undefined && isFailure(check))) return 'red';
  // A required check that has not reported at all is pending, never green.
  return states.every(check => isSatisfied(check)) ? 'green' : 'pending';
}

/** Conclusions that mean the check did not pass. `neutral`/`skipped` are not failures. */
const FAILING_CONCLUSIONS: ReadonlySet<CheckRun['conclusion'] | undefined> = new Set([
  'failure',
  'timed_out',
  'cancelled',
]);

function isFailure(check: CheckRun): boolean {
  return FAILING_CONCLUSIONS.has(check.conclusion);
}

/**
 * Conclusions GitHub accepts as satisfying a required status check — success,
 * skipped, AND neutral. Demanding `success` alone is a permanent silent no-fire
 * on any repo whose required jobs are path-filtered or `if:`-guarded, since a
 * skipped required job is routine rather than exceptional.
 */
const SATISFYING_CONCLUSIONS: ReadonlySet<CheckRun['conclusion'] | undefined> = new Set([
  'success',
  'skipped',
  'neutral',
]);

function isSatisfied(check: CheckRun | undefined): boolean {
  return check !== undefined && SATISFYING_CONCLUSIONS.has(check.conclusion);
}

const DOCS_EXTENSION = /\.(?:md|mdx|txt)$/i;
// Anchored at BOTH ends, and the optional extension is restricted to doc
// formats. An open-ended prefix match swallows real source whose name merely
// starts the same way — `licenses.ts`, `changelog.ts`, `LICENSE-checker.js` —
// and a push touching only those would never re-fire the review.
const DOCS_FILENAME = /^(?:README|CHANGELOG|LICENSE)(?:\.(?:md|mdx|txt|rst))?$/i;

/** Whether a single path is documentation rather than behavior. */
function isDocumentationPath(path: string): boolean {
  if (DOCS_EXTENSION.test(path)) return true;
  const segments = path.split('/');
  if (DOCS_FILENAME.test(segments.at(-1) ?? '')) return true;
  return segments.slice(0, -1).some(segment => segment === 'docs' || segment === 'doc');
}

/**
 * Whether a change set is worth re-reviewing. A docs-only push after a review
 * never re-fires; anything touching source does. An empty set is immaterial —
 * there is nothing new to read.
 */
export function isMaterialChange(changedPaths: string[]): boolean {
  return changedPaths.some(path => !isDocumentationPath(path));
}

export interface TriggerContext {
  /** Draft pull requests are not "declared ready". */
  isDraft: boolean;
  ciState: CiState;
  headSha: string;
  /** The SHA the reviewer's receipt sits on, if it has run before. */
  reviewedSha?: string;
  /** Paths changed since `reviewedSha`. Absent on a first review. */
  changedPathsSinceReview?: string[];
}

export interface TriggerDecision {
  fire: boolean;
  /** Why — so "it didn't review, why not?" is answerable from one log line. */
  reason: string;
}

/**
 * Decide whether to review this head SHA. Ordered so the cheapest and most
 * definitive disqualifiers come first, and every branch names itself.
 */
export function evaluateTrigger(context: TriggerContext): TriggerDecision {
  if (context.isDraft) {
    return { fire: false, reason: 'pull request is still a draft — not declared ready' };
  }

  if (context.reviewedSha === context.headSha) {
    return { fire: false, reason: `already reviewed ${context.headSha}` };
  }

  // A re-review must clear the material bar BEFORE the CI check, so a docs-only
  // push reports the reason a reader can act on rather than "CI is red".
  if (
    context.reviewedSha !== undefined &&
    context.changedPathsSinceReview !== undefined &&
    !isMaterialChange(context.changedPathsSinceReview)
  ) {
    return { fire: false, reason: 'no material change since the last review (docs only)' };
  }

  if (context.ciState !== 'green') {
    return {
      fire: false,
      reason: `CI is ${context.ciState} — the reviewer reads the settled state`,
    };
  }

  return {
    fire: true,
    reason:
      context.reviewedSha === undefined
        ? `ready and green at ${context.headSha}`
        : `material change re-greened at ${context.headSha}`,
  };
}
