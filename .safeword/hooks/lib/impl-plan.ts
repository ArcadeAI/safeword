// Safeword: impl-plan.md parsing + section validation (ticket XDNSZA).
//
// Pure helpers (no I/O) so the stop-quality hook can validate a ticket's
// impl-plan.md without importing the CLI dist (same cross-runtime-copy
// rationale as jtbd.ts — deployed hooks run standalone from .safeword/hooks/).

export type ImplPlanStatus = 'planned' | 'implemented';

/** The five required impl-plan sections, in template order. */
export const IMPL_PLAN_SECTIONS = [
  'Approach',
  'Decisions',
  'Arch alignment',
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

const SECTION_NAMES = new Map<string, ImplPlanAnySectionName>([
  ...IMPL_PLAN_SECTIONS.map((name): [string, ImplPlanAnySectionName] => [name.toLowerCase(), name]),
  ...IMPL_PLAN_OPTIONAL_SECTIONS.map((name): [string, ImplPlanAnySectionName] => [
    name.toLowerCase(),
    name,
  ]),
]);

/**
 * Lines outside HTML comments. Mirrors jtbd.ts's comment handling — the
 * scaffolded template's guidance is commented, so a fresh scaffold parses
 * to empty sections.
 */
function activeLines(content: string): string[] {
  const lines: string[] = [];
  let inComment = false;
  for (const raw of content.split('\n')) {
    let line = raw;
    if (inComment) {
      const end = line.indexOf('-->');
      if (end === -1) continue;
      inComment = false;
      line = line.slice(end + 3);
    }
    let start = line.indexOf('<!--');
    while (start !== -1) {
      const end = line.indexOf('-->', start + 4);
      if (end === -1) {
        line = line.slice(0, start);
        inComment = true;
        break;
      }
      line = line.slice(0, start) + line.slice(end + 3);
      start = line.indexOf('<!--');
    }
    lines.push(line);
  }
  return lines;
}

/** Scan for the `**Status:**` line; report its value or push the matching error. */
function parseStatus(lines: string[], errors: string[]): ImplPlanStatus | null {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(STATUS_PREFIX)) continue;
    const value = trimmed.slice(STATUS_PREFIX.length).trim();
    if (value === 'planned' || value === 'implemented') return value;
    errors.push(`Unknown status "${value}" — allowed values: planned, implemented.`);
    return null;
  }
  errors.push(`Missing \`${STATUS_PREFIX}\` line — add \`${STATUS_PREFIX} planned\` near the top.`);
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

export function parseImplPlan(content: string): ImplPlanResult {
  const errors: string[] = [];
  const lines = activeLines(content);
  const status = parseStatus(lines, errors);
  const bodies = collectSectionBodies(lines);

  const sections: ImplPlanResult['sections'] = {};
  const validatePresentSection = (name: ImplPlanAnySectionName, body: string[]): void => {
    const skipLine =
      body.length === 1 && body[0]?.toLowerCase().startsWith(SKIP_PREFIX) ? body[0] : null;
    if (skipLine !== null) {
      const reason = skipLine.slice(SKIP_PREFIX.length).trim();
      if (reason === '') {
        errors.push(`Section "${name}": skip requires a non-empty reason (\`skip: <why>\`).`);
      }
      sections[name] = { satisfied: reason !== '', skip: reason };
      return;
    }
    if (body.length === 0) {
      errors.push(`Section "${name}" is empty — add content or \`skip: <why>\`.`);
    }
    sections[name] = { satisfied: body.length > 0, skip: null };
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
