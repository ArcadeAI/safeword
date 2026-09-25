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
          placeholder: '<human: <one choice> | none>.',
        },
        {
          label: 'Next',
          placeholder:
            '<standalone decision or action with only the concrete context needed to decide or act without scrolling>.',
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

/** Stable identity shared by prompt rendering, evaluation, and host corrections. */
export const TERMINAL_HANDOFF_CONTRACT_VERSION = 'terminal-handoff/v1';

export function renderDecisionBriefContract(grammar = DECISION_BRIEF_GRAMMAR): string {
  const endings = Object.entries(grammar.variants)
    .map(([verdict, variant]) => `**${variant.terminalLabel}:** for ${verdict}`)
    .join(' or ');
  const shapes = renderDecisionBriefShapes(grammar);

  return `Apply SAFEWORD.md "Talking to the user" rules to your reply: scan-not-read, ${REPLY_FORMAT_LEAD_RULE}, named structure only when it carries weight. End with ${endings}.

End with one verdict as its own scannable decision brief — the reader is choosing whether to continue, redirect, or intervene with this block as their only context. Plain English; no jargon the reader hasn't seen this turn — make the verdict line clear from the words after the dash, not the label alone (a non-coder may not know the labels). Reproduce the shape below exactly: bolded labels, blank line between each paragraph.

Next or Need must stand alone under ${TERMINAL_HANDOFF_CONTRACT_VERSION}. Write for a reader who sees only this paragraph. When a decision is required, use exactly: Choice: <concrete choice>. Recommendation: <recommended option>. Reason: <controlling reason>. Impact: <material tradeoff or consequences>. Reply: <exact reply>. Use specific nouns, verbs, paths, commands, amounts, and consequences. Write each necessary marked term as Term: <name> = <plain-language meaning>. Include a detail only if it could change the decision or action. Stop once the reader can decide or act without scrolling. If no decision is required, use exactly: Action: <imperative>. Object: <specific object>. Optionally add only: Reason: Required because <essential reason>.

Implementation choices are yours. BLOCKED is for spec/scope/value decisions that need human input. Multiple unknowns: resolve the small ones, BLOCK on the largest.

${shapes}

`;
}

export const DECISION_BRIEF_CONTRACT = renderDecisionBriefContract();

export type TerminalHandoffForm = 'decision' | 'action' | 'outside';
export type TerminalHandoffSubstantiveEvidence =
  'structured-verdict' | 'current-turn-tool' | 'current-turn-edit' | 'none';

export interface TerminalHandoffEvaluationOptions {
  substantiveEvidence?: TerminalHandoffSubstantiveEvidence;
  validationMode?: 'canonical' | 'structural';
}

export const TERMINAL_HANDOFF_DECISION_REQUIREMENTS = [
  'concrete choice',
  'recommendation',
  'controlling reason',
  'material tradeoff or consequences',
  'exact reply',
] as const;

export interface TerminalHandoffContract {
  version: typeof TERMINAL_HANDOFF_CONTRACT_VERSION;
  decision: {
    Next: readonly { name: (typeof TERMINAL_HANDOFF_DECISION_REQUIREMENTS)[number] }[];
    Need: readonly { name: (typeof TERMINAL_HANDOFF_DECISION_REQUIREMENTS)[number] }[];
  };
  action: {
    role: 'Action';
    objectRole: 'Object';
    optionalReasonPrefix: 'Required because';
  };
}

const decisionContractRoles = TERMINAL_HANDOFF_DECISION_REQUIREMENTS.map(name => ({ name }));

/** Canonical machine-readable contract shared by prompts, evaluators, and host adapters. */
export const TERMINAL_HANDOFF_CONTRACT: TerminalHandoffContract = {
  version: TERMINAL_HANDOFF_CONTRACT_VERSION,
  decision: {
    Next: decisionContractRoles,
    Need: decisionContractRoles,
  },
  action: {
    role: 'Action',
    objectRole: 'Object',
    optionalReasonPrefix: 'Required because',
  },
};

export interface TerminalHandoffContractValidation {
  valid: boolean;
  requirements?: ('version' | 'symmetric decision roles' | 'no-decision action form')[];
}

function contractRoleNames(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const names = value.map(entry =>
    entry && typeof entry === 'object' && 'name' in entry
      ? (entry as { name?: unknown }).name
      : undefined,
  );
  return names.every((name): name is string => typeof name === 'string') ? names : undefined;
}

/** Validate contract compatibility before a host relies on its correction syntax. */
export function validateTerminalHandoffContract(
  contract: unknown,
): TerminalHandoffContractValidation {
  const requirements: NonNullable<TerminalHandoffContractValidation['requirements']> = [];
  const candidate =
    contract && typeof contract === 'object' ? (contract as Record<string, unknown>) : {};
  if (candidate.version !== TERMINAL_HANDOFF_CONTRACT_VERSION) requirements.push('version');

  const decision =
    candidate.decision && typeof candidate.decision === 'object'
      ? (candidate.decision as Record<string, unknown>)
      : {};
  const nextRoles = contractRoleNames(decision.Next);
  const needRoles = contractRoleNames(decision.Need);
  const expected = [...TERMINAL_HANDOFF_DECISION_REQUIREMENTS].sort();
  const hasExactRoles = (roles: string[] | undefined): boolean =>
    roles !== undefined &&
    roles.length === expected.length &&
    [...roles].sort().every((role, index) => role === expected[index]);
  if (!hasExactRoles(nextRoles) || !hasExactRoles(needRoles)) {
    requirements.push('symmetric decision roles');
  }

  const action =
    candidate.action && typeof candidate.action === 'object'
      ? (candidate.action as Record<string, unknown>)
      : {};
  if (
    action.role !== 'Action' ||
    action.objectRole !== 'Object' ||
    action.optionalReasonPrefix !== 'Required because'
  ) {
    requirements.push('no-decision action form');
  }

  return requirements.length === 0 ? { valid: true } : { valid: false, requirements };
}

export type TerminalHandoffRequirement =
  | (typeof TERMINAL_HANDOFF_DECISION_REQUIREMENTS)[number]
  | 'one concrete action'
  | 'one essential reason'
  | 'concise action form'
  | 'no extra context'
  | 'terminal paragraph'
  | 'plain-language meaning'
  | 'canonical Open route';

export interface DecisionBriefCompliance {
  compliant: boolean;
  contractVersion: typeof TERMINAL_HANDOFF_CONTRACT_VERSION;
  form: TerminalHandoffForm;
  /** Deterministic work counter used to assert the scanner's fixed linear bound. */
  examinedCharacters: number;
  /** First structural reason a noncompliant reply cannot satisfy the grammar. */
  violation?: DecisionBriefViolation;
  /** Stable reader-facing requirements that the terminal paragraph did not satisfy. */
  requirements?: TerminalHandoffRequirement[];
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

function determineTerminalHandoffForm(
  verdict: DecisionBriefVerdict,
  paragraphsAfterVerdict: readonly MarkdownParagraph[],
): Exclude<TerminalHandoffForm, 'outside'> {
  if (verdict === 'BLOCKED') return 'decision';
  const openParagraph = paragraphsAfterVerdict.find(
    paragraph => LABEL.exec(paragraph.text)?.[1] === 'Open',
  );
  return /^\*\*Open:\*\*\s+none\.?\s*$/iu.test(openParagraph?.text ?? '') ? 'action' : 'decision';
}

function hasCanonicalOpenRoute(
  verdict: DecisionBriefVerdict,
  paragraphsAfterVerdict: readonly MarkdownParagraph[],
): boolean {
  if (verdict === 'BLOCKED') return true;
  const openParagraph = paragraphsAfterVerdict.find(
    paragraph => LABEL.exec(paragraph.text)?.[1] === 'Open',
  );
  const value = openParagraph?.text ?? '';
  return (
    /^\*\*Open:\*\*\s+none\.?\s*$/iu.test(value) ||
    /^\*\*Open:\*\*\s+human:\s+\S(?:.*\S)?\.?\s*$/isu.test(value)
  );
}

const TERMINAL_ROLE =
  /(?:^|\s)(Choice|Recommendation|Reason|Impact|Reply|Action|Object|Term):\s*/giu;
const CONTENT_FREE = /^(?:tbd|todo|unknown|n\/?a|it|this|that|the work)[.!]?$/iu;
const BACK_REFERENCE =
  /^(?:same(?: as above)?|as above|see (?:the )?analysis|see above|described earlier)\b/iu;
const DECISION_ROLE_REQUIREMENT = {
  Choice: 'concrete choice',
  Recommendation: 'recommendation',
  Reason: 'controlling reason',
  Impact: 'material tradeoff or consequences',
  Reply: 'exact reply',
} as const;

interface TerminalRoleClause {
  role: string;
  value: string;
}

function parseTerminalRoleClauses(value: string): {
  clauses: TerminalRoleClause[];
  leadingText: string;
} {
  const matches = [...value.matchAll(TERMINAL_ROLE)];
  return {
    leadingText: value.slice(0, matches[0]?.index ?? value.length).trim(),
    clauses: matches.map((match, index) => ({
      role: match[1] ?? '',
      value: value.slice((match.index ?? 0) + match[0].length, matches[index + 1]?.index).trim(),
    })),
  };
}

function valueHasContent(value: string): boolean {
  const normalized = value.replaceAll(/[`*_]/gu, '').trim().toLowerCase();
  return (
    normalized.length > 0 && !CONTENT_FREE.test(normalized) && !BACK_REFERENCE.test(normalized)
  );
}

function termLacksPlainLanguageMeaning(clause: TerminalRoleClause): boolean {
  if (clause.role !== 'Term') return false;
  const [term, meaning, ...extra] = clause.value.split('=');
  return extra.length > 0 || !valueHasContent(term ?? '') || !valueHasContent(meaning ?? '');
}

function missingDecisionRequirements(terminalValue: string): TerminalHandoffRequirement[] {
  const { clauses, leadingText } = parseTerminalRoleClauses(terminalValue);
  const missing: TerminalHandoffRequirement[] = Object.entries(DECISION_ROLE_REQUIREMENT).flatMap(
    ([role, requirement]) => {
      const matching = clauses.filter(clause => clause.role === role);
      return matching.length === 1 && valueHasContent(matching[0]?.value ?? '')
        ? []
        : [requirement];
    },
  );
  if (leadingText !== '') missing.push('no extra context');
  const unexplainedTerm = clauses.find(termLacksPlainLanguageMeaning);
  if (unexplainedTerm) missing.push('plain-language meaning');
  return missing;
}

const NON_SPECIFIC_OBJECT = new Set([
  'a',
  'an',
  'it',
  'that',
  'the',
  'thing',
  'this',
  'them',
  'those',
  'work',
]);

function actionIsConcrete(action: string, object: string): boolean {
  const actionWords = action
    .replaceAll(/[`*_.,;:!?()[\]{}]/gu, ' ')
    .toLowerCase()
    .split(/\s+/u)
    .filter(Boolean);
  const objectWords = object
    .replaceAll(/[`*_.,;:!?()[\]{}]/gu, ' ')
    .toLowerCase()
    .split(/\s+/u)
    .filter(Boolean);
  return (
    actionWords.length > 0 &&
    actionWords.some(word => !NON_SPECIFIC_OBJECT.has(word)) &&
    objectWords.some(word => !NON_SPECIFIC_OBJECT.has(word))
  );
}

function missingActionRequirements(terminalValue: string): TerminalHandoffRequirement[] {
  const { clauses, leadingText } = parseTerminalRoleClauses(terminalValue);
  const requirements: TerminalHandoffRequirement[] = [];
  const actions = clauses.filter(clause => clause.role === 'Action');
  const objects = clauses.filter(clause => clause.role === 'Object');
  const reasons = clauses.filter(clause => clause.role === 'Reason');
  const decisionRoles = clauses.filter(
    clause => clause.role !== 'Reason' && Object.hasOwn(DECISION_ROLE_REQUIREMENT, clause.role),
  );

  const actionValue = actions[0]?.value ?? '';
  const objectValue = objects[0]?.value ?? '';
  const reasonValue = reasons[0]?.value ?? '';
  const reasonBody = reasonValue.replace(/^Required because\s+/u, '');
  if (actions.length !== 1 || objects.length !== 1 || !actionIsConcrete(actionValue, objectValue)) {
    requirements.push('one concrete action');
  }
  if (
    reasons.length > 1 ||
    (reasons.length === 1 &&
      (!reasonValue.startsWith('Required because ') || !valueHasContent(reasonBody)))
  ) {
    requirements.push('one essential reason');
  }
  if (decisionRoles.length > 0) requirements.push('concise action form');
  if (
    leadingText !== '' ||
    /[.!?]\s+\S/u.test(actionValue) ||
    /[.!?]\s+\S/u.test(objectValue) ||
    /[.!?]\s+\S/u.test(reasonBody.replace(/[.!?]\s*$/u, ''))
  ) {
    requirements.push('no extra context');
  }
  if (clauses.some(termLacksPlainLanguageMeaning)) requirements.push('plain-language meaning');
  return requirements;
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
  options: TerminalHandoffEvaluationOptions = {},
): DecisionBriefCompliance {
  const scan = scanTopLevelParagraphs(reply);
  let examinedCharacters = scan.examinedCharacters;
  let form: TerminalHandoffForm = 'outside';
  const result = (
    compliant: boolean,
    violation?: DecisionBriefViolation,
    requirements?: TerminalHandoffRequirement[],
  ): DecisionBriefCompliance => ({
    compliant,
    contractVersion: TERMINAL_HANDOFF_CONTRACT_VERSION,
    form,
    examinedCharacters,
    ...(violation ? { violation } : {}),
    ...(requirements && requirements.length > 0 ? { requirements } : {}),
  });
  const paragraphs = scan.paragraphs;
  const verdicts = paragraphs.flatMap((paragraph, index) => {
    examinedCharacters += paragraph.text.length;
    if (paragraph.grammarOpaque) return [];
    const match = VERDICT.exec(paragraph.text);
    const verdict = match?.[1];
    return verdict && Object.hasOwn(grammar.variants, verdict) ? [{ index, verdict }] : [];
  });
  const substantiveEvidence = options.substantiveEvidence ?? 'none';
  if (verdicts.length === 0 && substantiveEvidence === 'none') {
    return result(true);
  }
  if (verdicts.length !== 1) {
    return result(
      false,
      { kind: 'verdict-count', count: verdicts.length },
      verdicts.length === 0 ? ['terminal paragraph'] : undefined,
    );
  }

  const verdictEntry = verdicts[0];
  if (!verdictEntry) return result(false, { kind: 'verdict-count', count: 0 });
  const { index: verdictIndex, verdict: rawVerdict } = verdictEntry;
  const verdict = rawVerdict as DecisionBriefVerdict;
  form = determineTerminalHandoffForm(verdict, paragraphs.slice(verdictIndex + 1));
  const canonicalOpenRoute = hasCanonicalOpenRoute(verdict, paragraphs.slice(verdictIndex + 1));
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
  const terminalLabel = variant.terminalLabel;
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
  if (!compliant) {
    return result(
      false,
      { kind: 'label-sequence', verdict },
      labels.includes(terminalLabel) ? undefined : ['terminal paragraph'],
    );
  }
  if (options.validationMode === 'structural') return result(true);

  const terminalParagraph = paragraphs.at(-1)?.text ?? '';
  const terminalValue = terminalParagraph.replace(
    new RegExp(`^\\*\\*${terminalLabel}:\\*\\*\\s*`, 'u'),
    '',
  );
  if (terminalValue.trim() === '') return result(false, undefined, ['terminal paragraph']);
  if (form === 'decision') {
    const requirements = missingDecisionRequirements(terminalValue);
    if (!canonicalOpenRoute) requirements.push('canonical Open route');
    return requirements.length > 0 ? result(false, undefined, requirements) : result(true);
  }
  const requirements = missingActionRequirements(terminalValue);
  return requirements.length > 0 ? result(false, undefined, requirements) : result(true);
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
  if (!evaluation.violation && evaluation.requirements && evaluation.requirements.length > 0) {
    const header = `${evaluation.contractVersion} correction. Missing: ${evaluation.requirements.join(', ')}.`;
    const actionShape = `**Next:** Action: <imperative>. Object: <specific object>. Reason: Required because <essential reason>.`;
    const decisionShape = `**Next:** Choice: <concrete choice>. Recommendation: <recommended option>. Reason: <controlling reason>. Impact: <material tradeoff or consequences>. Reply: <exact reply>.\n\nFor BLOCKED, use the same five roles after **Need:**.`;
    const termShape = evaluation.requirements.includes('plain-language meaning')
      ? '\n\nWrite each necessary marked term as `Term: name = plain-language meaning`.'
      : '';
    const routeShape = evaluation.requirements.includes('canonical Open route')
      ? '\n\nAlso rewrite **Open:** as exactly `human: <one choice>` for a decision or `none` for an action.'
      : '';
    const rewriteScope = evaluation.requirements.includes('canonical Open route')
      ? 'the Open and terminal paragraphs'
      : 'only the terminal paragraph';

    return `${header} Preserve the useful content and rewrite ${rewriteScope} in this exact ${evaluation.form} form:\n\n${
      evaluation.form === 'action' ? actionShape : decisionShape
    }${routeShape}${termShape}\n\n${evidence}`;
  }

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

  return `${evaluation.contractVersion} correction. ${problem} ${choice}

${shapes}

${evidence}`;
}

/** Per-phase evidence templates appended to the universal header. */
const PHASE_EVIDENCE: Record<BddPhase, string> = {
  intake:
    'Phase: intake. CONFIDENT cites that scope/out_of_scope/done_when are bounded, failure modes were surfaced, and open questions are resolved (or explicitly deferred).',
  'define-behavior':
    'Phase: define-behavior. CONFIDENT cites derived dimensions, N user-confirmed scenarios authored against review-spec in Authoring mode, AODI for each, happy/failure/edge coverage, that scenarios test behaviors not implementation, and that none asserts an outcome the scope edge excludes — out_of_scope plus the project and milestone non-goals, or a note that this child spec has none and out_of_scope is the whole edge.',
  'scenario-gate':
    'Phase: scenario-gate. CONFIDENT cites a passing independent review-spec result, N validated scenarios, and either issues resolved or "No issues."',
  'plan-implementation':
    'Phase: plan-implementation. CONFIDENT cites a parse-valid impl-plan.md (five required sections content-or-skip, plus optional Doc impact, status planned), the riskiest assumption named with its proving scenario, and the independent review passed (or its pending state recorded).',
  'plan-execution':
    'Phase: plan-execution. CONFIDENT cites the current reviewed impl-plan.md whose accepted decisions bound the execution work; sibling 7CAMAD supplies the execution-plan.md completion contract.',
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
