// Safeword: impl-plan.md parsing + section validation (ticket XDNSZA).
//
// Pure helpers (no I/O) so the stop-quality hook can validate a ticket's
// impl-plan.md without importing the CLI dist (same cross-runtime-copy
// rationale as jtbd.ts — deployed hooks run standalone from .safeword/hooks/).

import { withoutFencedCode } from './markdown-structure.js';
import { IMPLEMENTATION_INSPIRATION_GRAMMAR } from './inspiration.js';

export type ImplPlanStatus = 'planned' | 'implemented';

/** The five required impl-plan sections, in template order. */
export const IMPL_PLAN_SECTIONS = [
  'Approach',
  'Decisions',
  'Design alignment',
  'Known deviations',
  'Assessment triggers',
] as const;

export type ImplPlanSectionName = (typeof IMPL_PLAN_SECTIONS)[number];

/**
 * Optional sections validated only when present (TXRHMD, #480 decision 22):
 * the template ships them, legacy plans without them stay valid.
 */
export const IMPL_PLAN_OPTIONAL_SECTIONS = ['Doc impact'] as const;

export type ImplPlanOptionalSectionName = (typeof IMPL_PLAN_OPTIONAL_SECTIONS)[number];

/** Any section name the parser can report — required or optional. */
export type ImplPlanAnySectionName = ImplPlanSectionName | ImplPlanOptionalSectionName;

export interface ImplPlanSectionVerdict {
  /** True when the section has real content or a valid skip. */
  satisfied: boolean;
  /** The skip reason when the section is skip-annotated; null otherwise. */
  skip: string | null;
}

export interface ImplPlanResult {
  /** Parsed status, or null when the line is missing or carries an unknown value. */
  status: ImplPlanStatus | null;
  /** Per-section verdicts — required sections plus optional ones when present. */
  sections: Partial<Record<ImplPlanAnySectionName, ImplPlanSectionVerdict>>;
  /** Validation errors; empty when the plan is valid. */
  errors: string[];
}

const STATUS_PREFIX = '**Status:**';
const SKIP_PREFIX = 'skip:';
const DECISIONS_SCAFFOLD_LINES = new Set<string>(Object.values(IMPLEMENTATION_INSPIRATION_GRAMMAR));

const SECTION_NAMES = new Map<string, ImplPlanAnySectionName>([
  ...IMPL_PLAN_SECTIONS.map((name): [string, ImplPlanAnySectionName] => [name.toLowerCase(), name]),
  ['arch alignment', 'Design alignment'],
  ...IMPL_PLAN_OPTIONAL_SECTIONS.map((name): [string, ImplPlanAnySectionName] => [
    name.toLowerCase(),
    name,
  ]),
]);

const DESIGN_ALIGNMENT_HEADING = 'design alignment';
const LEGACY_ARCH_ALIGNMENT_HEADING = 'arch alignment';

/** Lines outside fenced, commented, and indented code. */
export function activeLines(content: string): string[] {
  return withoutFencedCode(content)
    .split('\n')
    .filter(line => !/^(?: {4}|\t)/u.test(line));
}

/** Scan for the `**Status:**` line; report its value or push the matching error. */
function parseStatus(lines: string[], errors: string[]): ImplPlanStatus | null {
  const candidates = lines.map(line => line.trim()).filter(line => line.startsWith(STATUS_PREFIX));
  if (candidates.length === 0) {
    errors.push(
      `Missing \`${STATUS_PREFIX}\` line — add \`${STATUS_PREFIX} planned\` near the top.`,
    );
    return null;
  }
  if (candidates.length !== 1) {
    errors.push(`Expected exactly one \`${STATUS_PREFIX}\` line; found ${candidates.length}.`);
    return null;
  }
  const value = candidates[0]!.slice(STATUS_PREFIX.length).trim();
  if (value === 'planned' || value === 'implemented') return value;
  errors.push(`Unknown status "${value}" — allowed values: planned, implemented.`);
  return null;
}

/** Accumulate non-empty body lines per known `## ` section. */
function collectSectionBodies(lines: string[]): Map<ImplPlanAnySectionName, string[]> {
  const bodies = new Map<ImplPlanAnySectionName, string[]>();
  let current: ImplPlanAnySectionName | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      current = SECTION_NAMES.get(trimmed.slice(3).trim().toLowerCase()) ?? null;
      if (current && !bodies.has(current)) bodies.set(current, []);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      current = null;
      continue;
    }
    if (current && trimmed !== '') bodies.get(current)?.push(trimmed);
  }
  return bodies;
}

/** Reject the one ambiguous compatibility case before alias normalization. */
function validateAlignmentHeading(lines: string[], errors: string[]): void {
  const headings = new Set(
    lines
      .map(line => line.trim())
      .filter(line => line.startsWith('## '))
      .map(line => line.slice(3).trim().toLowerCase()),
  );
  if (headings.has(DESIGN_ALIGNMENT_HEADING) && headings.has(LEGACY_ARCH_ALIGNMENT_HEADING)) {
    errors.push(
      'Both `## Design alignment` and legacy `## Arch alignment` are present — keep exactly one.',
    );
  }
}

/** Reject repeated known section headings after legacy aliases normalize. */
function validateUniqueSectionHeadings(lines: string[], errors: string[]): void {
  const counts = new Map<ImplPlanAnySectionName, number>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('## ')) continue;
    const name = SECTION_NAMES.get(trimmed.slice(3).trim().toLowerCase());
    if (name !== undefined) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  for (const [name, count] of counts) {
    if (count > 1)
      errors.push(`Section "${name}" appears ${count} times — keep exactly one heading.`);
  }
}

export function parseImplPlan(content: string): ImplPlanResult {
  const errors: string[] = [];
  const lines = activeLines(content);
  const status = parseStatus(lines, errors);
  validateAlignmentHeading(lines, errors);
  validateUniqueSectionHeadings(lines, errors);
  const bodies = collectSectionBodies(lines);

  const sections: ImplPlanResult['sections'] = {};
  const validatePresentSection = (name: ImplPlanAnySectionName, body: string[]): void => {
    const meaningfulBody = body.filter(
      line =>
        !/^#{3,6}(?:\s|$)/u.test(line) &&
        (name !== 'Decisions' || !DECISIONS_SCAFFOLD_LINES.has(line)),
    );
    const skipLine =
      meaningfulBody.length === 1 && meaningfulBody[0]?.toLowerCase().startsWith(SKIP_PREFIX)
        ? meaningfulBody[0]
        : null;
    if (skipLine !== null) {
      const reason = skipLine.slice(SKIP_PREFIX.length).trim();
      if (reason === '') {
        errors.push(`Section "${name}": skip requires a non-empty reason (\`skip: <why>\`).`);
      }
      sections[name] = { satisfied: reason !== '', skip: reason };
      return;
    }
    if (meaningfulBody.length === 0) {
      errors.push(`Section "${name}" is empty — add content or \`skip: <why>\`.`);
    }
    sections[name] = { satisfied: meaningfulBody.length > 0, skip: null };
  };

  for (const name of IMPL_PLAN_SECTIONS) {
    const body = bodies.get(name);
    if (body === undefined) {
      errors.push(
        `Missing section heading \`## ${name}\` — all five required sections must be present.`,
      );
      continue;
    }
    validatePresentSection(name, body);
  }

  // Optional sections: validated only when their heading exists — a legacy
  // plan without them stays valid (decision 22's grandfather guarantee).
  for (const name of IMPL_PLAN_OPTIONAL_SECTIONS) {
    const body = bodies.get(name);
    if (body !== undefined) validatePresentSection(name, body);
  }

  return { status, sections, errors };
}

/**
 * Whether a Decisions-section body carries a citation — the enforceable trace
 * that evidence-weighing (e.g. /figure-it-out) actually happened (ticket
 * MR5M3A). Minimal/structural per the YR6C49 non-prose-extraction ruling: a
 * citation is a URL or a `[n]` numeric source-reference marker. Prose alone is
 * not a citation.
 */
export function hasCitation(text: string): boolean {
  return /https?:\/\/\S+|\[\d+\]/.test(text);
}

/** The active (non-comment) body text of a named section, joined by newlines; '' when absent. */
export function sectionBody(content: string, name: ImplPlanSectionName): string {
  return (collectSectionBodies(activeLines(content)).get(name) ?? []).join('\n');
}
