/**
 * Scenario-lineage coverage (ticket XT1FFM).
 *
 * Pure helpers behind `safeword check`'s advisory coverage report:
 *   - parseAcIdsByJtbd — a spec.md's Acceptance Criteria ids, grouped by JTBD;
 *   - parseAcReferenceFromTitle — a scenario title's `<jtbd-id>.AC<#>` reference;
 *   - buildCoverageReport — cross-references the two into three buckets:
 *       uncovered (a spec AC no scenario references),
 *       stale     (a scenario ref whose JTBD exists but whose AC# does not),
 *       orphan    (a scenario ref whose JTBD is absent from the spec).
 *
 * The `## `-section walk reuses `computeSkipMask` from `./markdown-sections.js`
 * (the shared CommonMark comment/fence-skip primitive, ticket WQ4RH3). The
 * hook-side `jtbd.ts` keeps its own copy across the deployed-hook runtime
 * boundary — it cannot import the CLI dist.
 *
 * No I/O — callers pass file content; check.ts owns ticket discovery.
 */

import { computeSkipMask } from './markdown-sections.js';

const JTBD_HEADING = 'jobs to be done';
const SCENARIO_PREFIX = '### Scenario:';

export interface CoverageReport {
  /** AC ids declared in spec.md that no scenario references. */
  uncovered: string[];
  /** Scenario refs whose JTBD exists but whose AC number does not. */
  stale: string[];
  /** Scenario refs whose JTBD is absent from spec.md entirely. */
  orphan: string[];
}

/**
 * Conformant scenario title: a single whitespace-free token shaped
 * `<jtbd-id>.AC<#>` with an optional `.<scenario_name>` tail. The lazy
 * `\S+?` plus the mandatory `.AC<digits>` anchor keep this linear — no two
 * adjacent greedy `\S+` groups to backtrack between. Free-text titles (which
 * contain spaces) can never match from `^`.
 */
const CONFORMANT_TITLE = /^(\S+?)\.AC(\d+)(?:\.|$)/;

export function parseAcReferenceFromTitle(title: string): string | undefined {
  const match = CONFORMANT_TITLE.exec(title.trim());
  if (!match) return undefined;
  return `${match[1] ?? ''}.AC${match[2] ?? ''}`;
}

/**
 * Group Acceptance-Criteria ids by their JTBD id within a spec.md's
 * `## Jobs To Be Done` section. Each `### ` heading opens a JTBD (id = its
 * first token); each `#### ` heading under it is an AC (id = its first token).
 * HTML-commented and fenced content is skipped, so the template's commented
 * example never counts. A JTBD with no ACs maps to an empty array — it is
 * still a known JTBD id for orphan-vs-stale classification.
 */
interface WalkState {
  inSection: boolean;
  currentJtbd: string | undefined;
}

export function parseAcIdsByJtbd(specContent: string): Map<string, string[]> {
  const lines = specContent.split('\n');
  const skip = computeSkipMask(lines);
  const byJtbd = new Map<string, string[]>();
  let state: WalkState = { inSection: false, currentJtbd: undefined };

  for (const [index, line] of lines.entries()) {
    if (skip[index]) continue;
    const heading = parseHeading(line);
    if (heading !== undefined) state = advance(state, heading, byJtbd);
  }

  return byJtbd;
}

/** Apply one heading to the JTBD/AC walk, recording ACs into `byJtbd`. */
function advance(
  state: WalkState,
  heading: { level: number; text: string },
  byJtbd: Map<string, string[]>,
): WalkState {
  if (heading.level <= 2) {
    return { inSection: heading.text.toLowerCase() === JTBD_HEADING, currentJtbd: undefined };
  }
  if (!state.inSection) return state;
  if (heading.level === 3) {
    const currentJtbd = firstToken(heading.text);
    if (!byJtbd.has(currentJtbd)) byJtbd.set(currentJtbd, []);
    return { inSection: true, currentJtbd };
  }
  if (state.currentJtbd !== undefined) {
    appendAc(byJtbd, state.currentJtbd, firstToken(heading.text));
  }
  return state;
}

const EMPTY_REPORT: CoverageReport = { uncovered: [], stale: [], orphan: [] };

/**
 * Build the advisory coverage report for one ticket's (spec, test-definitions)
 * pair. Degrades quietly: an empty report when the spec declares no ACs, or
 * when `testDefinitionsContent` is omitted (no test-definitions.md yet — a
 * ticket that hasn't reached define-behavior must not drown in uncovered-AC
 * noise). Free-text scenario titles contribute no coverage and raise no flag.
 */
export function buildCoverageReport(
  specContent: string,
  testDefinitionsContent?: string,
): CoverageReport {
  const byJtbd = parseAcIdsByJtbd(specContent);
  const knownAcIds = new Set<string>();
  for (const acIds of byJtbd.values()) for (const id of acIds) knownAcIds.add(id);

  if (knownAcIds.size === 0) return { ...EMPTY_REPORT };
  if (testDefinitionsContent === undefined) return { ...EMPTY_REPORT };

  const knownJtbds = new Set(byJtbd.keys());
  const covered = new Set<string>();
  const stale = new Set<string>();
  const orphan = new Set<string>();

  for (const title of parseScenarioTitles(testDefinitionsContent)) {
    const reference = parseAcReferenceFromTitle(title);
    if (reference === undefined) continue;
    if (knownAcIds.has(reference)) {
      covered.add(reference);
    } else if (knownJtbds.has(jtbdPart(reference))) {
      stale.add(reference);
    } else {
      orphan.add(reference);
    }
  }

  return {
    uncovered: [...knownAcIds].filter(id => !covered.has(id)),
    stale: [...stale],
    orphan: [...orphan],
  };
}

/** Append an AC id to a JTBD's list, creating the list on first use. */
function appendAc(byJtbd: Map<string, string[]>, jtbd: string, acId: string): void {
  const acIds = byJtbd.get(jtbd) ?? [];
  acIds.push(acId);
  byJtbd.set(jtbd, acIds);
}

/** Strip the trailing `.AC<#>` segment to recover the JTBD id of a reference. */
function jtbdPart(reference: string): string {
  return reference.replace(/\.AC\d+$/, '');
}

/**
 * Extract every `### Scenario:` title from a test-definitions.md, skipping
 * commented/fenced regions.
 */
function parseScenarioTitles(content: string): string[] {
  const lines = content.split('\n');
  const skip = computeSkipMask(lines);
  const titles: string[] = [];
  for (const [index, line] of lines.entries()) {
    if (skip[index]) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith(SCENARIO_PREFIX)) {
      titles.push(trimmed.slice(SCENARIO_PREFIX.length).trim());
    }
  }
  return titles;
}

/** First whitespace-delimited token of a heading's text (its id). */
function firstToken(text: string): string {
  return text.split(/\s+/)[0] ?? '';
}

/**
 * An ATX heading → `{ level, text }`; undefined for non-heading lines. Counts
 * leading `#` manually (no quantifier-over-quantifier regex) and requires a
 * whitespace separator before the heading text.
 */
function parseHeading(line: string): { level: number; text: string } | undefined {
  const trimmed = line.trim();
  let level = 0;
  while (level < trimmed.length && trimmed.charAt(level) === '#') level += 1;
  if (level === 0 || level > 6) return undefined;
  const rest = trimmed.slice(level);
  if (rest.length === 0 || !WHITESPACE_START.test(rest)) return undefined;
  return { level, text: rest.trim() };
}

const WHITESPACE_START = /^\s/;
