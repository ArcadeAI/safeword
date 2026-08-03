// Shared reply-shape vocabulary for Claude Code and Cursor hooks: the Stop
// quality-review message plus the compact pre-response pointers.
// Used by: stop-quality.ts, cursor/stop.ts, prompt-questions.ts (UserPromptSubmit).
//
// Contract: every Stop terminates in CONFIDENT or BLOCKED (binary terminal).
// CONFIDENT carries a decision brief — Decided / Rejected (optional) / Open /
// Next. BLOCKED carries Tried / Need so escalation is a clean handoff. Per-phase
// evidence templates make CONFIDENT falsifiable with phase-specific criteria.
//
// Rendering: model output renders as GFM/CommonMark in Claude Code. Single
// newlines collapse to spaces (soft-break); blank lines start new paragraphs.
// Bold-led sub-fields separated by blank lines render as a scannable stacked
// column. Indent inside a paragraph is a no-op.
//
// Style discipline: this prompt is reinjected every Stop, and the compact
// pointers below are reinjected every user prompt. Keep it terse and
// load-bearing. Project philosophy (research-depth, critical-review,
// investigate-on-uncertainty) lives in SAFEWORD.md which loads every
// conversation — don't duplicate it here.
//
// Calibration grounding: Kadavath 2022, Lin 2022, Tian 2023 — tokenized
// verdicts beat free-form uncertainty descriptions for calibration.

import type { CANONICAL_PHASES } from './phase-provenance.js';

/** Derived from CANONICAL_PHASES so a new phase is a compile error here, not drift. */
export type BddPhase = (typeof CANONICAL_PHASES)[number];

/**
 * The single wording of the lead-first rule. A bare mid-sentence fragment so the
 * Stop header can keep it inline where it belongs, rather than appending it as a
 * trailing labelled sentence.
 */
export const REPLY_FORMAT_LEAD_RULE = 'lead with the answer';

/** Lead-only pre-response pointer: the sole cue during intentionally quiet TDD steps. */
export const REPLY_FORMAT_LEAD = `Reply format: ${REPLY_FORMAT_LEAD_RULE}.`;

/** Full pre-response pointer, used outside intentionally quiet TDD steps. */
export const REPLY_FORMAT_REMINDER = `${REPLY_FORMAT_LEAD} For substantive work updates, use one decision brief: **CONFIDENT** ends with **Next:**; **BLOCKED** ends with **Need:**.`;

export const DECISION_BRIEF_CONTRACT = `Apply SAFEWORD.md "Talking to the user" rules to your reply: scan-not-read, ${REPLY_FORMAT_LEAD_RULE}, named structure only when it carries weight. End with **Next:** for CONFIDENT or **Need:** for BLOCKED.

End with one verdict as its own scannable decision brief — the reader is choosing whether to continue, redirect, or intervene with this block as their only context. Plain English; no jargon the reader hasn't seen this turn — make the CONFIDENT/BLOCKED line clear from the words after the dash, not the label alone (a non-coder may not know the labels). Reproduce the shape below exactly: bolded labels, blank line between each paragraph.

Implementation choices are yours. BLOCKED is for spec/scope/value decisions that need human input. Multiple unknowns: resolve the small ones, BLOCK on the largest.

**CONFIDENT** — <one-line plain-English claim>.

**Decided:** <1-2 sentences naming the actual choice and what changes>.

**Rejected:** <alt — one-line reason>; <alt — one-line reason>. (Omit this paragraph entirely if no real alternatives were considered.)

**Open:** <resolved this turn | deferred to <ticket-or-follow-up> | none>.

**Next:** <one concrete imperative — what you'll do or recommend>.

**BLOCKED** — <one specific unknown (a question with a falsifiable answer)>.

**Tried:** <concrete verb + object>.

**Need:** <unblock>. (Optional: propose one parallel action if non-blocker work exists.)

`;

const DECISION_BRIEF_LABELS = {
  CONFIDENT: [
    ['Decided', 'Open', 'Next'],
    ['Decided', 'Rejected', 'Open', 'Next'],
  ],
  BLOCKED: [['Tried', 'Need']],
} as const;

export interface DecisionBriefCompliance {
  compliant: boolean;
  /** Deterministic work counter used to assert the scanner's fixed linear bound. */
  examinedCharacters: number;
}

interface MarkdownParagraph {
  text: string;
  ignored: boolean;
}

const CONTAINER_PREFIX = /^(?: {0,3}>| {0,3}(?:[-+*]|\d+[.)])\s| {4}|\t)/u;
const FENCE = /^ {0,3}(`{3,}|~{3,})/u;
const HTML_OPEN = /^ {0,3}<([A-Za-z][\w-]*)\b[^>]*>/u;
const VERDICT = /^\*\*(CONFIDENT|BLOCKED)\*\*\s+—\s+\S[^\n]*$/u;
const LABEL = /^\*\*(Decided|Rejected|Open|Next|Tried|Need):\*\*\s+\S[^\n]*(?:\n[^\n]+)*$/u;

/**
 * Extract rendered top-level paragraphs while ignoring Markdown containers that
 * can contain example templates. The scanner advances once through the input;
 * later grammar checks advance once through the retained paragraphs.
 */
function scanTopLevelParagraphs(reply: string): MarkdownParagraph[] {
  const paragraphs: MarkdownParagraph[] = [];
  let lines: string[] = [];
  let ignored = false;
  let fenceMarker: string | null = null;
  let inHtmlComment = false;
  let htmlTag: string | null = null;

  const flush = () => {
    if (lines.length > 0) paragraphs.push({ text: lines.join('\n').trim(), ignored });
    lines = [];
    ignored = false;
  };

  for (const line of reply.replaceAll('\r\n', '\n').split('\n')) {
    const trimmed = line.trim();
    const fence = FENCE.exec(line)?.[1];

    if (fenceMarker) {
      ignored = true;
      if (fence && fence[0] === fenceMarker[0] && fence.length >= fenceMarker.length) {
        fenceMarker = null;
      }
    } else if (fence) {
      ignored = true;
      fenceMarker = fence;
    }

    if (inHtmlComment || trimmed.startsWith('<!--')) {
      ignored = true;
      inHtmlComment = !trimmed.includes('-->');
    }

    if (htmlTag) {
      ignored = true;
      if (trimmed.toLowerCase().includes(`</${htmlTag}>`)) htmlTag = null;
    } else if (!inHtmlComment) {
      const openingTag = HTML_OPEN.exec(line)?.[1]?.toLowerCase();
      if (openingTag) {
        ignored = true;
        if (!trimmed.includes(`</${openingTag}>`) && !trimmed.endsWith('/>')) htmlTag = openingTag;
      }
    }

    if (lines.length === 0 && CONTAINER_PREFIX.test(line)) ignored = true;

    if (trimmed === '') {
      flush();
    } else {
      lines.push(line);
    }
  }
  flush();
  return paragraphs.filter(paragraph => !paragraph.ignored);
}

/** Evaluate the canonical terminal brief with deterministic linear instrumentation. */
export function evaluateDecisionBriefCompliance(reply: string): DecisionBriefCompliance {
  const result = (compliant: boolean): DecisionBriefCompliance => ({
    compliant,
    examinedCharacters: reply.length,
  });
  const paragraphs = scanTopLevelParagraphs(reply);
  const verdicts = paragraphs.flatMap((paragraph, index) => {
    const match = VERDICT.exec(paragraph.text);
    return match ? [{ index, verdict: match[1] as keyof typeof DECISION_BRIEF_LABELS }] : [];
  });
  if (verdicts.length !== 1) return result(false);

  const [{ index: verdictIndex, verdict }] = verdicts;
  const labelsBeforeVerdict = paragraphs
    .slice(0, verdictIndex)
    .some(paragraph => LABEL.test(paragraph.text));
  if (labelsBeforeVerdict) return result(false);

  const labels = paragraphs
    .slice(verdictIndex + 1)
    .map(paragraph => LABEL.exec(paragraph.text)?.[1]);
  const compliant = DECISION_BRIEF_LABELS[verdict].some(
    sequence =>
      labels.length === sequence.length &&
      labels.every((label, index) => label === sequence[index]),
  );
  return result(compliant);
}

/** Whether a reply already ends in the canonical phase-neutral decision brief. */
export function isDecisionBriefCompliant(reply: string): boolean {
  return evaluateDecisionBriefCompliance(reply).compliant;
}

/** Per-phase evidence templates appended to the universal header. */
const PHASE_EVIDENCE: Record<BddPhase, string> = {
  intake:
    'Phase: intake. CONFIDENT cites that scope/out_of_scope/done_when are bounded, failure modes were surfaced, and open questions are resolved (or explicitly deferred).',
  'define-behavior':
    'Phase: define-behavior. CONFIDENT cites N scenarios, AODI for each, happy/failure/edge coverage, and that scenarios test behaviors not implementation.',
  'scenario-gate':
    'Phase: scenario-gate. CONFIDENT cites N validated scenarios, AODI pass, and either issues found or "No issues."',
  'plan-implementation':
    'Phase: plan-implementation. CONFIDENT cites a parse-valid impl-plan.md (five required sections content-or-skip, plus optional Doc impact, status planned), the riskiest assumption named with its proving scenario, and the independent review passed (or its pending state recorded).',
  implement:
    'Phase: implement. CONFIDENT cites the passing artifact (X/X tests pass; scenario checked off).',
  verify:
    'Phase: verify. CONFIDENT cites /verify result (X/X tests; N/N scenarios complete) and that no scenarios are stale.',
  done: "Phase: done. CONFIDENT cites /audit passed, /verify passed, verify.md present, PR scope checked against the ticket (no piggybacked work), scenario coverage validated (no behaviors emerged that aren't in test-definitions), and any clear-win cross-scenario refactoring done.",
};

/** TDD-step-specific evidence for implement phase (RED/GREEN/REFACTOR). */
const TDD_STEP_EVIDENCE: Record<string, string> = {
  red: 'Phase: implement (TDD: RED). CONFIDENT cites the failing test, the missing behavior it names, and that the assertion is independent of the implementation.',
  green:
    'Phase: implement (TDD: GREEN). CONFIDENT cites X/X tests pass, that you wrote only what the test requires, and no mocks where real deps would work.',
  refactor:
    'Phase: implement (TDD: REFACTOR). CONFIDENT cites one refactoring applied (not batched), the smell it addressed (duplication / long-fn / nesting / magic / dead-code / naming), no behavior change, and X/X tests still pass.',
};

/**
 * The default quality review prompt (backwards compatible export).
 * Used when no phase is detected. Cursor's stop hook consumes this directly.
 */
export const QUALITY_REVIEW_MESSAGE = DECISION_BRIEF_CONTRACT + PHASE_EVIDENCE.implement;

/**
 * Get phase-appropriate quality review message.
 * During implement phase, uses TDD-step-specific evidence when tddStep is provided.
 * Falls back to default (implement) if phase unknown.
 */
export function getQualityMessage(phase?: BddPhase | string, tddStep?: string | null): string {
  if (phase === 'implement' && tddStep && tddStep in TDD_STEP_EVIDENCE) {
    return DECISION_BRIEF_CONTRACT + TDD_STEP_EVIDENCE[tddStep];
  }
  if (phase && phase in PHASE_EVIDENCE) {
    return DECISION_BRIEF_CONTRACT + PHASE_EVIDENCE[phase as BddPhase];
  }
  return QUALITY_REVIEW_MESSAGE;
}

/**
 * Build a disqualification message when state flags suggest CONFIDENT shouldn't be allowed.
 * Returns undefined if no disqualification applies.
 *
 * Wired by stop-quality.ts which has access to the session state. Keeps quality.ts
 * state-agnostic (it only knows the prompt-shape contract).
 */
export function getDisqualificationMessage(options: {
  pendingLearningsNudges?: string[];
  recentRelevantFailure?: string;
}): string | undefined {
  const messages: string[] = [];
  const pending = options.pendingLearningsNudges ?? [];
  if (pending.length > 0) {
    const files = pending.map(f => f.split('/').pop() ?? f).join(', ');
    messages.push(
      `Novel-claim nudge pending for: ${files}. The next user prompt will clear it automatically. If any claim is load-bearing, run /quality-review now to verify against primary sources before relying on it.`,
    );
  }
  if (options.recentRelevantFailure) {
    messages.push(
      `CONFIDENT requires evidence the failure mode was checked: ${options.recentRelevantFailure}.`,
    );
  }
  return messages.length > 0 ? messages.join('\n') : undefined;
}
