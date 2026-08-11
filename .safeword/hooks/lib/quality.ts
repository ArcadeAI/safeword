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

export interface DecisionBriefParagraphGrammar {
  label: string;
  placeholder: string;
  optional?: boolean;
}

export interface DecisionBriefVariantGrammar {
  claim: string;
  terminalLabel: string;
  paragraphs: DecisionBriefParagraphGrammar[];
}

export interface DecisionBriefGrammar {
  variants: {
    CONFIDENT: DecisionBriefVariantGrammar;
    BLOCKED: DecisionBriefVariantGrammar;
  };
}

/** One grammar drives the proactive wording, compact reminder, and Stop validation. */
export const DECISION_BRIEF_GRAMMAR: DecisionBriefGrammar = {
  variants: {
    CONFIDENT: {
      claim: '<one-line plain-English claim>.',
      terminalLabel: 'Next',
      paragraphs: [
        {
          label: 'Decided',
          placeholder: '<1-2 sentences naming the actual choice and what changes>.',
        },
        {
          label: 'Rejected',
          placeholder:
            '<alt — one-line reason>; <alt — one-line reason>. (Omit this paragraph entirely if no real alternatives were considered.)',
          optional: true,
        },
        {
          label: 'Open',
          placeholder: '<resolved this turn | deferred to <ticket-or-follow-up> | none>.',
        },
        {
          label: 'Next',
          placeholder: "<one concrete imperative — what you'll do or recommend>.",
        },
      ],
    },
    BLOCKED: {
      claim: '<one specific unknown (a question with a falsifiable answer)>.',
      terminalLabel: 'Need',
      paragraphs: [
        { label: 'Tried', placeholder: '<concrete verb + object>.' },
        {
          label: 'Need',
          placeholder:
            '<unblock>. (Optional: propose one parallel action if non-blocker work exists.)',
        },
      ],
    },
  },
};

export function renderReplyFormatReminder(grammar = DECISION_BRIEF_GRAMMAR): string {
  const endings = Object.entries(grammar.variants)
    .map(([verdict, variant]) => `**${verdict}** ends with **${variant.terminalLabel}:**`)
    .join('; ');
  return `${REPLY_FORMAT_LEAD} For substantive work updates, use one decision brief: ${endings}.`;
}

/** Full pre-response pointer, used outside intentionally quiet TDD steps. */
export const REPLY_FORMAT_REMINDER = renderReplyFormatReminder();

export function renderDecisionBriefContract(grammar = DECISION_BRIEF_GRAMMAR): string {
  const endings = Object.entries(grammar.variants)
    .map(([verdict, variant]) => `**${variant.terminalLabel}:** for ${verdict}`)
    .join(' or ');
  const shapes = renderDecisionBriefShapes(grammar);

  return `Apply SAFEWORD.md "Talking to the user" rules to your reply: scan-not-read, ${REPLY_FORMAT_LEAD_RULE}, named structure only when it carries weight. End with ${endings}.

End with one verdict as its own scannable decision brief — the reader is choosing whether to continue, redirect, or intervene with this block as their only context. Plain English; no jargon the reader hasn't seen this turn — make the verdict line clear from the words after the dash, not the label alone (a non-coder may not know the labels). Reproduce the shape below exactly: bolded labels, blank line between each paragraph.

Implementation choices are yours. BLOCKED is for spec/scope/value decisions that need human input. Multiple unknowns: resolve the small ones, BLOCK on the largest.

${shapes}

`;
}

export const DECISION_BRIEF_CONTRACT = renderDecisionBriefContract();

export interface DecisionBriefCompliance {
  compliant: boolean;
  /** Deterministic work counter used to assert the scanner's fixed linear bound. */
  examinedCharacters: number;
  /** First structural reason a noncompliant reply cannot satisfy the grammar. */
  violation?: DecisionBriefViolation;
}

export type DecisionBriefVerdict = keyof DecisionBriefGrammar['variants'];

export type DecisionBriefViolation =
  | { kind: 'verdict-count'; count: number }
  | { kind: 'labels-before-verdict'; verdict: DecisionBriefVerdict }
  | { kind: 'label-sequence'; verdict: DecisionBriefVerdict };

interface MarkdownParagraph {
  text: string;
  grammarOpaque: boolean;
}

/** Public test contract: all explicitly counted passes remain below this fixed factor. */
export const DECISION_BRIEF_MAX_WORK_FACTOR = 8;

const BLOCK_QUOTE_OR_CODE = /^(?: {0,3}>| {4}|\t)/u;
const LIST_MARKER = /^( {0,3})(?:[-+*]|\d+[.)])([ \t]+)/u;
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/u;
const HTML_OPEN = /^ {0,3}<([A-Za-z][\w-]*)(?:[ \t]*$|[ \t]+|\/?>)/u;
const RAW_HTML_TAGS = new Set(['script', 'pre', 'style', 'textarea']);
const BLOCK_HTML_TAGS = new Set([
  'address',
  'article',
  'aside',
  'base',
  'basefont',
  'blockquote',
  'body',
  'caption',
  'center',
  'col',
  'colgroup',
  'dd',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'frame',
  'frameset',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hr',
  'html',
  'iframe',
  'legend',
  'li',
  'link',
  'main',
  'menu',
  'menuitem',
  'nav',
  'noframes',
  'ol',
  'optgroup',
  'option',
  'p',
  'param',
  'search',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'title',
  'tr',
  'track',
  'ul',
]);
const VERDICT = /^\*\*([^*\n]+)\*\*\s+—\s+\S[^\n]*$/u;
const LABEL = /^\*\*([^*\n]+):\*\*\s+\S[^\n]*(?:\n[^\n]+)*$/u;

interface ParagraphScan {
  paragraphs: MarkdownParagraph[];
  examinedCharacters: number;
}

/**
 * Extract rendered top-level paragraphs while ignoring Markdown containers that
 * can contain example templates. The scanner advances once through the input;
 * later grammar checks advance once through the retained paragraphs.
 */
function scanTopLevelParagraphs(reply: string): ParagraphScan {
  const normalized = reply.replace(/\r\n?/gu, '\n');
  // Count every whole-input and per-line pass. Parser changes must increment this
  // counter where work occurs so the public bound can detect accidental rescans.
  let examinedCharacters = reply.length + normalized.length;
  const paragraphs: MarkdownParagraph[] = [];
  let lines: string[] = [];
  let excludedFromDecisionGrammar = false;
  let fenceMarker: string | null = null;
  let htmlEnd: string | null = null;
  let rawHtmlTag: string | null = null;
  let insideBlockHtml = false;
  let listContentIndent: number | null = null;

  const flush = () => {
    if (lines.length > 0)
      paragraphs.push({
        text: lines.join('\n').trim(),
        grammarOpaque: excludedFromDecisionGrammar,
      });
    lines = [];
    excludedFromDecisionGrammar = false;
  };
  const flushBeforeExcludedBlock = () => {
    if (lines.length > 0 && !excludedFromDecisionGrammar) flush();
  };

  for (const line of normalized.split('\n')) {
    examinedCharacters += line.length + 1;
    const trimmed = line.trim();
    const fenceMatch = FENCE.exec(line);
    const fence = fenceMatch?.[1];
    const fenceRemainder = fenceMatch?.[2] ?? '';
    const wasInsideFence = fenceMarker !== null;
    const closesFence =
      fenceMarker !== null &&
      fence !== undefined &&
      fence[0] === fenceMarker[0] &&
      fence.length >= fenceMarker.length &&
      /^[\t ]*$/u.test(fenceRemainder);
    const opensFence =
      !wasInsideFence && fence !== undefined && (fence[0] !== '`' || !fenceRemainder.includes('`'));
    let endsExplicitHtmlBlock = false;

    if (fenceMarker) {
      excludedFromDecisionGrammar = true;
      if (closesFence) fenceMarker = null;
    } else if (opensFence) {
      flushBeforeExcludedBlock();
      excludedFromDecisionGrammar = true;
      fenceMarker = fence ?? null;
    }

    if (wasInsideFence || opensFence) {
      if (trimmed === '') flush();
      else lines.push(line);
      if (wasInsideFence && fenceMarker === null) flush();
      continue;
    }

    if (htmlEnd) {
      excludedFromDecisionGrammar = true;
      if (trimmed.includes(htmlEnd)) {
        htmlEnd = null;
        endsExplicitHtmlBlock = true;
      }
    } else if (trimmed.startsWith('<!--')) {
      flushBeforeExcludedBlock();
      excludedFromDecisionGrammar = true;
      if (trimmed.includes('-->')) endsExplicitHtmlBlock = true;
      else htmlEnd = '-->';
    } else if (trimmed.startsWith('<![CDATA[')) {
      flushBeforeExcludedBlock();
      excludedFromDecisionGrammar = true;
      if (trimmed.includes(']]>')) endsExplicitHtmlBlock = true;
      else htmlEnd = ']]>';
    } else if (trimmed.startsWith('<?')) {
      flushBeforeExcludedBlock();
      excludedFromDecisionGrammar = true;
      if (trimmed.includes('?>')) endsExplicitHtmlBlock = true;
      else htmlEnd = '?>';
    } else if (/^<![A-Z]/iu.test(trimmed)) {
      flushBeforeExcludedBlock();
      excludedFromDecisionGrammar = true;
      if (trimmed.includes('>')) endsExplicitHtmlBlock = true;
      else htmlEnd = '>';
    }

    if (rawHtmlTag) {
      excludedFromDecisionGrammar = true;
      if (trimmed.toLowerCase().includes(`</${rawHtmlTag}>`)) {
        rawHtmlTag = null;
        endsExplicitHtmlBlock = true;
      }
    } else if (insideBlockHtml) {
      excludedFromDecisionGrammar = true;
    } else if (!htmlEnd) {
      const openingTag = HTML_OPEN.exec(line)?.[1]?.toLowerCase();
      const interruptsParagraph =
        openingTag !== undefined &&
        (RAW_HTML_TAGS.has(openingTag) || BLOCK_HTML_TAGS.has(openingTag));
      if (openingTag && (lines.length === 0 || interruptsParagraph)) {
        flushBeforeExcludedBlock();
        excludedFromDecisionGrammar = true;
        if (
          RAW_HTML_TAGS.has(openingTag) &&
          !trimmed.toLowerCase().includes(`</${openingTag}>`) &&
          !trimmed.endsWith('/>')
        ) {
          rawHtmlTag = openingTag;
        } else if (RAW_HTML_TAGS.has(openingTag)) {
          endsExplicitHtmlBlock = true;
        } else if (BLOCK_HTML_TAGS.has(openingTag)) {
          insideBlockHtml = true;
        }
      }
    }

    const listMarker = LIST_MARKER.exec(line);
    const indentation = line.match(/^ */u)?.[0].length ?? 0;
    if (listContentIndent !== null && trimmed !== '') {
      if (indentation >= listContentIndent) excludedFromDecisionGrammar = true;
      else listContentIndent = null;
    }
    if (listMarker) {
      flushBeforeExcludedBlock();
      excludedFromDecisionGrammar = true;
      listContentIndent = listMarker[0].length;
    }
    if (lines.length === 0 && BLOCK_QUOTE_OR_CODE.test(line)) {
      excludedFromDecisionGrammar = true;
    }

    if (trimmed === '') {
      flush();
      insideBlockHtml = false;
    } else {
      lines.push(line);
      if (endsExplicitHtmlBlock) flush();
    }
  }
  flush();
  return {
    paragraphs,
    examinedCharacters,
  };
}

/** Evaluate the canonical terminal brief with deterministic linear instrumentation. */
export function evaluateDecisionBriefCompliance(
  reply: string,
  grammar = DECISION_BRIEF_GRAMMAR,
): DecisionBriefCompliance {
  const scan = scanTopLevelParagraphs(reply);
  let examinedCharacters = scan.examinedCharacters;
  const result = (
    compliant: boolean,
    violation?: DecisionBriefViolation,
  ): DecisionBriefCompliance => ({
    compliant,
    examinedCharacters,
    ...(violation ? { violation } : {}),
  });
  const paragraphs = scan.paragraphs;
  const verdicts = paragraphs.flatMap((paragraph, index) => {
    examinedCharacters += paragraph.text.length;
    if (paragraph.grammarOpaque) return [];
    const match = VERDICT.exec(paragraph.text);
    const verdict = match?.[1];
    return verdict && Object.hasOwn(grammar.variants, verdict) ? [{ index, verdict }] : [];
  });
  if (verdicts.length !== 1) {
    return result(false, { kind: 'verdict-count', count: verdicts.length });
  }

  const verdictEntry = verdicts[0];
  if (!verdictEntry) return result(false, { kind: 'verdict-count', count: 0 });
  const { index: verdictIndex, verdict: rawVerdict } = verdictEntry;
  const verdict = rawVerdict as DecisionBriefVerdict;
  const grammarLabels = new Set(
    Object.values(grammar.variants).flatMap(variant =>
      variant.paragraphs.map(paragraph => paragraph.label),
    ),
  );
  const labelsBeforeVerdict = paragraphs.slice(0, verdictIndex).some(paragraph => {
    examinedCharacters += paragraph.text.length;
    if (paragraph.grammarOpaque) return false;
    const label = LABEL.exec(paragraph.text)?.[1];
    return label !== undefined && grammarLabels.has(label);
  });
  if (labelsBeforeVerdict) {
    return result(false, { kind: 'labels-before-verdict', verdict });
  }

  const labels = paragraphs.slice(verdictIndex + 1).map(paragraph => {
    examinedCharacters += paragraph.text.length;
    if (paragraph.grammarOpaque) return undefined;
    return LABEL.exec(paragraph.text)?.[1];
  });
  const variant = grammar.variants[verdict as keyof DecisionBriefGrammar['variants']];
  if (!variant) return result(false, { kind: 'verdict-count', count: 0 });
  const sequences = variant.paragraphs.reduce<string[][]>(
    (variants, paragraph) => [
      ...variants.map(sequence => [...sequence, paragraph.label]),
      ...(paragraph.optional ? variants : []),
    ],
    [[]],
  );
  const compliant = sequences.some(
    sequence =>
      labels.length === sequence.length && labels.every((label, i) => label === sequence[i]),
  );
  return compliant ? result(true) : result(false, { kind: 'label-sequence', verdict });
}

/** Whether a reply already ends in the canonical phase-neutral decision brief. */
export function isDecisionBriefCompliant(reply: string): boolean {
  return evaluateDecisionBriefCompliance(reply).compliant;
}

function getDecisionBriefVerdicts(grammar: DecisionBriefGrammar): DecisionBriefVerdict[] {
  return Object.keys(grammar.variants) as DecisionBriefVerdict[];
}

function renderDecisionBriefShapes(
  grammar: DecisionBriefGrammar,
  verdicts: readonly DecisionBriefVerdict[] = getDecisionBriefVerdicts(grammar),
): string {
  return verdicts
    .flatMap(verdict => {
      const variant = grammar.variants[verdict];
      return [
        `**${verdict}** — ${variant.claim}`,
        ...variant.paragraphs.map(paragraph => `**${paragraph.label}:** ${paragraph.placeholder}`),
      ];
    })
    .join('\n\n');
}

/** Evidence request for generic work that has no trustworthy BDD phase. */
export const GENERIC_REVIEW_EVIDENCE =
  'Work update: CONFIDENT names what changed, what was checked, and the concrete result.';

function describeDecisionBriefViolation(
  violation: DecisionBriefViolation | undefined,
  grammar: DecisionBriefGrammar,
): { problem: string; verdicts: readonly DecisionBriefVerdict[] } {
  const allVerdicts = getDecisionBriefVerdicts(grammar);
  if (violation?.kind === 'verdict-count') {
    return {
      problem:
        violation.count === 0
          ? 'Your reply has no recognized verdict.'
          : `Your reply has ${violation.count} recognized verdicts; choose exactly one.`,
      verdicts: allVerdicts,
    };
  }
  if (violation?.kind === 'labels-before-verdict') {
    return {
      problem: `Decision-brief labels appear before the ${violation.verdict} verdict.`,
      verdicts: [violation.verdict],
    };
  }
  if (violation?.kind === 'label-sequence') {
    return {
      problem: `${violation.verdict} has missing, extra, or out-of-order decision-brief labels.`,
      verdicts: [violation.verdict],
    };
  }
  return {
    problem: 'Your reply does not match the decision-brief grammar.',
    verdicts: allVerdicts,
  };
}

/**
 * Render a self-contained correction from the parser's observed failure. The
 * standing contract remains at SessionStart; Stop repeats only the exact shape
 * needed to repair this reply plus the evidence relevant to this review.
 */
export function renderDecisionBriefCorrection(
  evaluation: DecisionBriefCompliance,
  evidence: string,
  grammar = DECISION_BRIEF_GRAMMAR,
): string {
  const { problem, verdicts } = describeDecisionBriefViolation(evaluation.violation, grammar);

  const choice =
    verdicts.length === 1
      ? 'Preserve the useful content, then rewrite the contiguous top-level ending exactly as follows, with blank lines between paragraphs:'
      : 'Preserve the useful content, then end with exactly one of these top-level shapes, with blank lines between paragraphs:';
  const shapes =
    verdicts.length === 1
      ? renderDecisionBriefShapes(grammar, verdicts)
      : verdicts
          .map(verdict => renderDecisionBriefShapes(grammar, [verdict]))
          .join('\n\nOr, only if human input is required:\n\n');

  return `${problem} ${choice}

${shapes}

${evidence}`;
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

/** Phase-aware evidence without inventing an implementation phase for generic work. */
export function getQualityEvidence(phase?: BddPhase | string, tddStep?: string | null): string {
  if (phase === 'implement' && tddStep && Object.hasOwn(TDD_STEP_EVIDENCE, tddStep)) {
    return TDD_STEP_EVIDENCE[tddStep] ?? GENERIC_REVIEW_EVIDENCE;
  }
  if (phase && Object.hasOwn(PHASE_EVIDENCE, phase)) {
    return PHASE_EVIDENCE[phase as BddPhase];
  }
  return GENERIC_REVIEW_EVIDENCE;
}

/**
 * The default quality review prompt (backwards compatible export).
 * Used when no phase is detected. Cursor's stop hook consumes this directly.
 */
export const QUALITY_REVIEW_MESSAGE = DECISION_BRIEF_CONTRACT + PHASE_EVIDENCE.implement;

/**
 * Get phase-appropriate quality review message.
 * During implement phase, uses TDD-step-specific evidence when tddStep is provided.
 * Falls back to phase-neutral evidence when the phase is unknown.
 */
export function getQualityMessage(phase?: BddPhase | string, tddStep?: string | null): string {
  return DECISION_BRIEF_CONTRACT + getQualityEvidence(phase, tddStep);
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
