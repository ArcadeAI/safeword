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

import {
  parseFeatureLineageReferences,
  parseFeatureScenarios,
  parseLineageReferenceFromTag,
} from './gherkin-feature.js';
// parseLineageReferenceFromTag also backs the test-definitions.md tag fallback (issue #891).
import { computeSkipMask, parseHeading } from './markdown-sections.js';

const JTBD_HEADING = 'jobs to be done';
const SURFACES_HEADING = 'surfaces';
const SCENARIO_PREFIX = '### Scenario:';
const AFFECTED_SURFACES_LABEL = /^Affected\s*:\s*$/i;
const SURFACE_TAG_PREFIX = '@surface.';

export interface CoverageReport {
  /** AC ids declared in spec.md that no scenario references. */
  uncovered: string[];
  /** Scenario refs whose JTBD exists but whose AC number does not. */
  stale: string[];
  /** Scenario refs whose JTBD is absent from spec.md entirely. */
  orphan: string[];
}

export interface SurfaceReference {
  name: string;
  slug: string;
  skipped: boolean;
}

interface MissingSurfaceCoverage {
  name: string;
  slug: string;
}

export interface SurfaceCoverageReport {
  /** Affected surfaces from spec.md that no feature scenario tag covers. */
  missing: MissingSurfaceCoverage[];
  /** Feature scenario surface tags that are not listed as affected. */
  stale: string[];
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

/** A JTBD's declared criteria, split by kind (ticket V0NHT6 rule tier). */
export interface JtbdCriteria {
  acIds: string[];
  ruleIds: string[];
}

export function parseAcIdsByJtbd(specContent: string): Map<string, string[]> {
  const byJtbd = new Map<string, string[]>();
  for (const [jtbd, criteria] of parseCriteriaIdsByJtbd(specContent)) {
    byJtbd.set(jtbd, criteria.acIds);
  }
  return byJtbd;
}

export function parseCriteriaIdsByJtbd(specContent: string): Map<string, JtbdCriteria> {
  const lines = specContent.split('\n');
  const skip = computeSkipMask(lines);
  const byJtbd = new Map<string, JtbdCriteria>();
  let state: WalkState = { inSection: false, currentJtbd: undefined };

  for (const [index, line] of lines.entries()) {
    const isSkipped = skip[index];
    if (isSkipped) continue;
    const heading = parseHeading(line);
    if (heading !== undefined) state = advance(state, heading, byJtbd);
  }

  return byJtbd;
}

const REJECTION_TAG = '@rejection';

/**
 * Spec-declared numbered Rules that have at least one referencing scenario but
 * none tagged `@rejection`. A rule with no scenarios at all is the uncovered
 * bucket's finding, not noise here; unnumbered `Rule:` grouping blocks declare
 * no rule id, so they are exempt by construction.
 */
export function findRulesMissingRejectionPaths(
  specContent: string,
  featureContent: string,
): string[] {
  const declared = declaredRuleIds(specContent);
  if (declared.size === 0) return [];

  const hasRejectionByRule = new Map<string, boolean>();
  for (const scenario of parseFeatureScenarios(featureContent)) {
    recordRuleRejections(scenario.tags, declared, hasRejectionByRule);
  }

  return [...declared].filter(id => hasRejectionByRule.get(id) === false);
}

/** Every numbered-Rule id declared across the spec's JTBDs. */
function declaredRuleIds(specContent: string): Set<string> {
  const declared = new Set<string>();
  for (const criteria of parseCriteriaIdsByJtbd(specContent).values()) {
    for (const id of criteria.ruleIds) declared.add(id);
  }
  return declared;
}

/** Fold one scenario's rule refs into the rule → has-rejection-scenario map. */
function recordRuleRejections(
  tags: readonly string[],
  declared: ReadonlySet<string>,
  hasRejectionByRule: Map<string, boolean>,
): void {
  const isRejection = tags.includes(REJECTION_TAG);
  for (const tag of tags) {
    const ref = parseLineageReferenceFromTag(tag);
    if (ref?.kind !== 'rule' || !declared.has(ref.reference)) continue;
    hasRejectionByRule.set(
      ref.reference,
      (hasRejectionByRule.get(ref.reference) ?? false) || isRejection,
    );
  }
}

/** JTBD ids declaring both ACs and numbered Rules — one criteria kind per job. */
export function findMixedCriteriaJtbds(specContent: string): string[] {
  return [...parseCriteriaIdsByJtbd(specContent)]
    .filter(([, criteria]) => criteria.acIds.length > 0 && criteria.ruleIds.length > 0)
    .map(([jtbd]) => jtbd);
}

/** Apply one heading to the JTBD/criteria walk, recording ids into `byJtbd`. */
function advance(
  state: WalkState,
  heading: { level: number; text: string },
  byJtbd: Map<string, JtbdCriteria>,
): WalkState {
  if (heading.level <= 2) {
    return { inSection: heading.text.toLowerCase() === JTBD_HEADING, currentJtbd: undefined };
  }
  if (!state.inSection) return state;
  if (heading.level === 3) {
    const currentJtbd = firstToken(heading.text);
    if (!byJtbd.has(currentJtbd)) byJtbd.set(currentJtbd, { acIds: [], ruleIds: [] });
    return { inSection: true, currentJtbd };
  }
  if (state.currentJtbd !== undefined) {
    appendCriterion(byJtbd, state.currentJtbd, firstToken(heading.text));
  }
  return state;
}

/**
 * A terminal `.R<n>` id is a numbered Rule; everything else (including the
 * `.AC<n>`-terminated ids and legacy free-form headings) stays an AC, so an
 * AC-shaped id wins over a rule-shaped prefix (`feat.R1.AC1` is an AC of
 * JTBD `feat.R1`).
 */
export function isRuleId(id: string): boolean {
  return /\.R\d+$/.test(id);
}

const EMPTY_REPORT: CoverageReport = { uncovered: [], stale: [], orphan: [] };

/**
 * Build the advisory coverage report for one ticket's (spec, test-definitions)
 * pair. Degrades quietly: an empty report when the spec declares no ACs, or
 * when `testDefinitionsContent` is omitted (no test-definitions.md yet — a
 * ticket that hasn't reached define-behavior must not drown in uncovered-AC
 * noise). Coverage is read from conformant scenario titles and `@`-tag lineage
 * (see `parseTestDefinitionReferences`); a free-text title carrying neither
 * contributes no coverage and raises no flag.
 */
export function buildCoverageReport(
  specContent: string,
  testDefinitionsContent?: string,
): CoverageReport {
  const scenarioReferences =
    testDefinitionsContent === undefined
      ? undefined
      : parseTestDefinitionReferences(testDefinitionsContent);
  return buildCoverageReportFromReferences(specContent, scenarioReferences);
}

export function buildCoverageReportFromFeature(
  specContent: string,
  featureContent?: string,
): CoverageReport {
  if (featureContent === undefined) return buildCoverageReportFromReferences(specContent);
  const { ac, rule } = parseFeatureLineageReferences(featureContent);
  return buildCoverageReportFromReferences(specContent, [...ac, ...rule]);
}

export function buildSurfaceCoverageReportFromFeature(
  specContent: string,
  featureContent?: string,
): SurfaceCoverageReport {
  const affected = parseAffectedSurfaceReferences(specContent);
  if (affected.length === 0 || featureContent === undefined) return { missing: [], stale: [] };

  const coveredSurfaceSlugs = parseFeatureSurfaceTagSlugs(featureContent);
  const affectedSurfaceSlugs = new Set(affected.map(surface => surface.slug));

  return {
    missing: affected
      .filter(surface => !surface.skipped && !coveredSurfaceSlugs.has(surface.slug))
      .map(surface => ({ name: surface.name, slug: surface.slug })),
    stale: [...coveredSurfaceSlugs.difference(affectedSurfaceSlugs)],
  };
}

export function parseAffectedSurfaceReferences(specContent: string): SurfaceReference[] {
  const lines = specContent.split('\n');
  const skip = computeSkipMask(lines);
  const surfaces: SurfaceReference[] = [];
  let state: SurfaceWalkState = { inSurfacesSection: false, inAffectedList: false };

  for (const [index, rawLine] of lines.entries()) {
    if (skip[index] === true) continue;
    const result = readSurfaceLine(state, rawLine);
    state = result.state;
    if (result.surface !== undefined) surfaces.push(result.surface);
  }

  return surfaces;
}

interface SurfaceWalkState {
  inSurfacesSection: boolean;
  inAffectedList: boolean;
}

interface SurfaceWalkResult {
  state: SurfaceWalkState;
  surface?: SurfaceReference;
}

function readSurfaceLine(state: SurfaceWalkState, rawLine: string): SurfaceWalkResult {
  const heading = parseHeading(rawLine);
  if (heading !== undefined && heading.level <= 2) {
    return {
      state: {
        inSurfacesSection: heading.text.toLowerCase() === SURFACES_HEADING,
        inAffectedList: false,
      },
    };
  }
  if (!state.inSurfacesSection) return { state };

  const line = rawLine.trim();
  if (line.length === 0) return { state };
  if (AFFECTED_SURFACES_LABEL.test(line)) return { state: { ...state, inAffectedList: true } };
  if (isSurfaceSubsectionLabel(line)) return { state: { ...state, inAffectedList: false } };
  if (!state.inAffectedList || !line.startsWith('- ')) return { state };

  const surface = parseSurfaceListItem(line.slice(2));
  return surface === undefined ? { state } : { state, surface };
}

function parseFeatureSurfaceTagSlugs(featureContent: string): Set<string> {
  const slugs = new Set<string>();
  for (const scenario of parseFeatureScenarios(featureContent)) {
    for (const tag of scenario.tags) {
      const slug = parseSurfaceTagSlug(tag);
      if (slug !== undefined) slugs.add(slug);
    }
  }
  return slugs;
}

function parseSurfaceTagSlug(tag: string): string | undefined {
  if (!tag.startsWith(SURFACE_TAG_PREFIX)) return undefined;
  const slug = tag.slice(SURFACE_TAG_PREFIX.length).trim();
  return slug.length === 0 ? undefined : slug;
}

function parseSurfaceListItem(value: string): SurfaceReference | undefined {
  const skipped = value.toLowerCase().includes('skip:');
  const name = stripFormatting(surfaceNamePart(value)).trim();
  if (name.length === 0) return undefined;
  return { name, slug: surfaceSlug(name), skipped };
}

function isSurfaceSubsectionLabel(line: string): boolean {
  if (!line.endsWith(':')) return false;
  const label = line.slice(0, -1).trim();
  const first = label.at(0);
  if (first === undefined || !isLabelStart(first)) return false;
  for (const character of label) {
    if (!isLabelCharacter(character)) return false;
  }
  return true;
}

function isLabelStart(character: string): boolean {
  return (
    (character >= 'a' && character <= 'z') ||
    (character >= 'A' && character <= 'Z') ||
    (character >= '0' && character <= '9') ||
    character === '_'
  );
}

function isLabelCharacter(character: string): boolean {
  return isLabelStart(character) || character === ' ' || character === '-';
}

function surfaceNamePart(value: string): string {
  for (const separator of [' — ', ' – ', ' - ']) {
    const index = value.indexOf(separator);
    if (index !== -1) return value.slice(0, index);
  }
  return value;
}

function stripFormatting(value: string): string {
  let stripped = value.replaceAll('`', '');
  if (stripped.startsWith('**')) stripped = stripped.slice(2);
  if (stripped.endsWith('**')) stripped = stripped.slice(0, -2);
  return stripped;
}

function surfaceSlug(name: string): string {
  let slug = '';
  let previousWasDash = false;
  for (const character of name.trim().toLowerCase()) {
    if (isSlugCharacter(character)) {
      slug += character;
      previousWasDash = false;
    } else if (!previousWasDash) {
      slug += '-';
      previousWasDash = true;
    }
  }
  return trimDashes(slug);
}

function isSlugCharacter(character: string): boolean {
  return (character >= 'a' && character <= 'z') || (character >= '0' && character <= '9');
}

function trimDashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < value.length && value.at(start) === '-') start += 1;
  while (end > start && value.at(end - 1) === '-') end -= 1;
  return value.slice(start, end);
}

function buildCoverageReportFromReferences(
  specContent: string,
  scenarioReferences?: readonly string[],
): CoverageReport {
  const byJtbd = parseCriteriaIdsByJtbd(specContent);
  const knownIds = new Set<string>();
  for (const criteria of byJtbd.values()) {
    for (const id of [...criteria.acIds, ...criteria.ruleIds]) knownIds.add(id);
  }

  if (knownIds.size === 0) return { ...EMPTY_REPORT };
  if (scenarioReferences === undefined) return { ...EMPTY_REPORT };

  const knownJtbds = new Set(byJtbd.keys());
  const covered = new Set<string>();
  const stale = new Set<string>();
  const orphan = new Set<string>();

  for (const reference of scenarioReferences) {
    if (knownIds.has(reference)) {
      covered.add(reference);
    } else if (knownJtbds.has(jtbdPart(reference))) {
      stale.add(reference);
    } else {
      orphan.add(reference);
    }
  }

  return {
    uncovered: [...knownIds.difference(covered)],
    stale: [...stale],
    orphan: [...orphan],
  };
}

/** Append a criterion id to a JTBD's criteria by kind, creating the entry on first use. */
function appendCriterion(byJtbd: Map<string, JtbdCriteria>, jtbd: string, id: string): void {
  const criteria = byJtbd.get(jtbd) ?? { acIds: [], ruleIds: [] };
  (isRuleId(id) ? criteria.ruleIds : criteria.acIds).push(id);
  byJtbd.set(jtbd, criteria);
}

/** Strip the trailing `.AC<#>` or `.R<#>` segment to recover the JTBD id of a reference. */
function jtbdPart(reference: string): string {
  return reference.replace(/\.(?:AC|R)\d+$/, '');
}

/** Every `@`-prefixed token on a line, once inline-code backticks are stripped. */
const LINEAGE_TAG_TOKEN = /@\S+/g;

/**
 * Lineage references a test-definitions.md declares, from two vehicles, skipping
 * commented/fenced regions:
 *   - conformant `### Scenario:` titles shaped `<jtbd>.AC#.<name>` (the encode-in-
 *     the-title form the `testDefinitions` fixtures use); and
 *   - `@<jtbd>.AC#` / `@<jtbd>.R#` lineage tags carried on a `## Rule:` heading or
 *     on their own line beneath one — bare or wrapped in an inline `` `code span` ``.
 *
 * The tag vehicle mirrors what the `.feature` docs teach (lineage on the Rule
 * block), so a ledger-only ticket that carries the same tag stays covered.
 * Backticks are stripped before the tag parse because `parseLineageReferenceFromTag`
 * is `^`-anchored — a leading `` ` `` would otherwise fold the whole reference into
 * its lazy prefix and yield a malformed, never-matching id (issue #891).
 */
function parseTestDefinitionReferences(content: string): string[] {
  const lines = content.split('\n');
  const skip = computeSkipMask(lines);
  const references: string[] = [];
  for (const [index, line] of lines.entries()) {
    if (skip[index] === true) continue;
    references.push(...lineReferences(line.trim()));
  }
  return references;
}

/**
 * Lineage references one non-skipped, trimmed test-definitions.md line declares:
 * its `### Scenario:` title reference, else every `@`-tag reference it carries.
 *
 * A concrete `@<jtbd>.AC#` token in prose or inline code is counted — inherent
 * to treating the tag as a lineage vehicle. It stays advisory-only (health.ts
 * routes coverage to advisories, not blocking issues); `@`-tokens that aren't
 * `.AC<n>`/`.R<n>`-shaped (emails, decorators, `@rejection`, `@<jtbd>.AC#`
 * placeholders) never match.
 */
function lineReferences(trimmed: string): string[] {
  if (trimmed.startsWith(SCENARIO_PREFIX)) {
    const reference = parseAcReferenceFromTitle(trimmed.slice(SCENARIO_PREFIX.length).trim());
    return reference === undefined ? [] : [reference];
  }
  const tagTokens = trimmed.replaceAll('`', '').match(LINEAGE_TAG_TOKEN) ?? [];
  return tagTokens
    .map(token => parseLineageReferenceFromTag(token)?.reference)
    .filter((reference): reference is string => reference !== undefined);
}

/** First whitespace-delimited token of a heading's text (its id). */
function firstToken(text: string): string {
  return text.split(/\s+/, 1)[0] ?? '';
}
