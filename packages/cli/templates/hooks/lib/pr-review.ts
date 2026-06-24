// Safeword: eng-review-on-green-PRs decision core (ticket Y9WX8R). Pure, no I/O.
// The skill and the merge gate wire these to the real review ledger; this module
// only decides. Mirrors review-ledger.ts conventions (manual type guards, no
// schema lib; `.js` specifiers so tsc resolves the .ts source under test).

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

/** `path:line` — a non-empty path, a colon, then a line number. */
const LOCATION = /^\S.*:\d+$/;

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
export function validateReviewResult(data: unknown): ReviewResultValidation {
  if (typeof data !== 'object' || data === null) {
    return { ok: false, reason: 'review result must be an object' };
  }
  const obj = data as Record<string, unknown>;

  if (!VERDICTS.includes(obj.verdict as Verdict)) {
    return { ok: false, reason: `verdict must be one of: ${VERDICTS.join(', ')}` };
  }

  if (!Array.isArray(obj.findings)) {
    return { ok: false, reason: 'findings must be an array' };
  }
  for (const [index, finding] of obj.findings.entries()) {
    const failure = validateFinding(finding, index);
    if (failure !== undefined) return { ok: false, reason: failure.reason };
  }

  if (obj.verdict !== 'APPROVE' && !isNonEmptyString(obj.nextAction)) {
    return { ok: false, reason: 'a non-approving verdict must state a next action' };
  }

  return { ok: true, data: obj as unknown as ReviewResult };
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
