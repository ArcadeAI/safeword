// Safeword: phase-provenance gate logic (ticket 0KYEBN, #644 G2).
//
// Pure helpers (no I/O) so the pre-tool hook can validate ticket.md writes
// without importing the CLI dist (same cross-runtime-copy rationale as
// jtbd.ts — deployed hooks run standalone from .safeword/hooks/).
//
// The guarantee: a feature ticket's `phase:` is earned, not declared. Feature
// tickets are born at intake and advance one canonical step at a time; any
// deliberate deviation carries a per-phase `phase_skips` justification that
// stays visible in the frontmatter. The gate polices transitions, not
// history — tickets at rest are never re-validated.

import { parseFrontmatter } from './hierarchy.js';
import { parseImplPlan } from './impl-plan.js';
import { parseJtbdSection } from './jtbd.js';
import { isValidSha, isValidSkipReason } from './parse-annotation.js';

export const CANONICAL_PHASES = [
  'intake',
  'define-behavior',
  'scenario-gate',
  'plan-implementation',
  'implement',
  'verify',
  'done',
] as const;

const CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_PHASES);

/** Typed lookup so callers don't need casts; -1 for off-enum names. */
function canonicalIndex(phase: string): number {
  return (CANONICAL_PHASES as readonly string[]).indexOf(phase);
}

const CANONICAL_SEQUENCE = CANONICAL_PHASES.join(' → ');

export type ProvenanceVerdict = { ok: true } | { ok: false; reason: string; remediation: string };

const OK: ProvenanceVerdict = { ok: true };

/**
 * `phase_skips` convention: an indented YAML block sequence under the key, one
 * entry per bypassed phase:
 *
 *   phase_skips:
 *     - intake: <reason>
 *     - define-behavior: <reason>
 *
 * Use a block sequence, not a flow-style array (`[intake: a, ...]`): the minimal
 * frontmatter parser splits flow-style on commas, so a comma in a reason would
 * corrupt the entry. The `-` must be indented — a zero-column `- intake: …`
 * parses to nothing, and the skip would read as absent.
 */
const SKIPS_SYNTAX =
  'record a deliberate skip for each bypassed phase as an indented phase_skips block sequence — e.g. `phase_skips:` on its own line, then `  - intake: <reason>` (two-space indent) for each skipped phase, each with a non-empty reason';

export function frontmatterOf(content: string): Record<string, string | string[]> | undefined {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return undefined;
  const parsed = parseFrontmatter(match[1] ?? '');
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

export function scalar(
  meta: Record<string, string | string[]> | undefined,
  key: string,
): string | undefined {
  const value = meta?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/** Parsed phase_skips: justified phase → reason, plus syntactically bad entries. */
interface ParsedSkips {
  justified: Map<string, string>;
  invalid: string[];
}

/** One `<phase>: <value>` block-sequence entry, split on the first colon. */
interface PhaseKeyedEntry {
  phase: string;
  value: string;
  /** The original entry text, for callers that report it verbatim. */
  raw: string;
}

/**
 * Parse a `<phase>: <value>` frontmatter block sequence (the shared shape
 * behind both phase_skips and phase_anchors). Splits each entry on the first
 * colon; entries with no colon or an empty phase are returned as `malformed`.
 * Value trimming happens here; what makes a value *valid* is the caller's call.
 */
function parsePhaseKeyedEntries(
  meta: Record<string, string | string[]> | undefined,
  key: string,
): { entries: PhaseKeyedEntry[]; malformed: string[] } {
  const raw = meta?.[key];
  const rawEntries = Array.isArray(raw) ? raw : typeof raw === 'string' && raw !== '' ? [raw] : [];
  const entries: PhaseKeyedEntry[] = [];
  const malformed: string[] = [];
  for (const rawEntry of rawEntries) {
    const match = /^([^:]+):(.*)$/.exec(rawEntry);
    const phase = match?.[1]?.trim();
    if (match === null || phase === undefined || phase === '') {
      malformed.push(rawEntry);
      continue;
    }
    entries.push({ phase, value: (match[2] ?? '').trim(), raw: rawEntry });
  }
  return { entries, malformed };
}

function parseSkips(meta: Record<string, string | string[]> | undefined): ParsedSkips {
  const { entries, malformed } = parsePhaseKeyedEntries(meta, 'phase_skips');
  const justified = new Map<string, string>();
  const invalid = [...malformed];
  for (const { phase, value, raw } of entries) {
    if (!isValidSkipReason(value)) {
      invalid.push(raw);
      continue;
    }
    justified.set(phase, value);
  }
  return { justified, invalid };
}

/**
 * Evaluate a ticket.md write (creation or edit) for phase provenance.
 *
 * @param priorContent  On-disk content before the write; undefined = creation.
 * @param proposedContent  The content the write would produce.
 */
export function evaluateTicketWrite(
  priorContent: string | undefined,
  proposedContent: string,
): ProvenanceVerdict {
  // Normalize CRLF so a Windows-authored ticket.md isn't misread as having no
  // frontmatter (the `^---\n` anchors are LF-only). Fail-safe either way — a
  // false "no frontmatter" only over-denies — but the false positive is poor UX.
  const proposed = normalizeNewlines(proposedContent);
  if (priorContent === undefined) {
    return evaluateCreation(proposed);
  }
  return evaluateEdit(normalizeNewlines(priorContent), proposed);
}

function normalizeNewlines(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

function evaluateCreation(proposedContent: string): ProvenanceVerdict {
  // Fail closed on unclassifiable creations (#119: a parse failure must not
  // become a silent bypass) — a ticket.md that can't declare its type could
  // otherwise slip past every type-keyed gate.
  if (!/^---\n[\s\S]*?\n---/.test(proposedContent)) {
    return {
      ok: false,
      reason:
        'ticket.md requires YAML frontmatter — without it no gate can classify the ticket, which is the silent-bypass failure #119 shipped.',
      remediation:
        'Start the file with a frontmatter block (---) carrying at least id, type, phase, and status.',
    };
  }
  const meta = frontmatterOf(proposedContent);
  if (meta === undefined) {
    return {
      ok: false,
      reason:
        'ticket.md requires parseable YAML frontmatter — the block between --- markers parses to no fields, so no gate can classify the ticket.',
      remediation:
        'Fix the frontmatter to simple "key: value" lines carrying at least id, type, phase, and status.',
    };
  }
  if (scalar(meta, 'type') !== 'feature') return OK;
  return evaluateBirth(meta, 'creation');
}

function evaluateEdit(priorContent: string, proposedContent: string): ProvenanceVerdict {
  const prior = frontmatterOf(priorContent);
  const proposed = frontmatterOf(proposedContent);
  // A write that leaves the frontmatter unparseable carries no phase or type
  // to police — at-rest tolerance (corruption integrity is G3/G5 territory).
  if (proposed === undefined) return OK;

  const priorType = scalar(prior, 'type');
  const proposedType = scalar(proposed, 'type');

  // Becoming a feature — from task/patch/epic, no type, or an unparseable
  // prior (frontmatter repair) — counts as a feature birth at the proposed
  // phase: the ticket never traversed the phases as a feature.
  if (proposedType === 'feature' && priorType !== 'feature') {
    return evaluateBirth(proposed, 'flip');
  }

  if (proposedType === 'feature') {
    const priorPhase = scalar(prior, 'phase');
    const proposedPhase = scalar(proposed, 'phase');
    if (proposedPhase !== undefined && proposedPhase !== priorPhase) {
      return evaluateAdvance(priorPhase, proposedPhase, proposed);
    }
  }

  return OK;
}

/**
 * A feature ticket's phase change: backward is free, forward is one canonical
 * step at a time, and any skipped phase needs a phase_skips justification.
 * An off-enum or absent prior counts as intake (legacy migration rule); an
 * off-enum target is denied — an unknown label would unreach every keyed gate.
 */
function evaluateAdvance(
  priorPhase: string | undefined,
  proposedPhase: string,
  proposed: Record<string, string | string[]>,
): ProvenanceVerdict {
  if (!CANONICAL_SET.has(proposedPhase)) {
    return {
      ok: false,
      reason: `"${proposedPhase}" is not a canonical ticket phase, so no gate keyed to phases would ever fire on this ticket again. Canonical phases: ${CANONICAL_SEQUENCE}.`,
      remediation: 'Advance to the next canonical phase instead.',
    };
  }

  const effectivePrior =
    priorPhase !== undefined && CANONICAL_SET.has(priorPhase) ? priorPhase : 'intake';
  const fromIndex = canonicalIndex(effectivePrior);
  const toIndex = canonicalIndex(proposedPhase);

  // Backward moves and re-declarations are rework, never gated.
  if (toIndex <= fromIndex + 1) return OK;

  return requireJustifiedSkips(
    proposed,
    CANONICAL_PHASES.slice(fromIndex + 1, toIndex),
    missing => ({
      ok: false,
      reason: `Phases advance one canonical step at a time — ${effectivePrior} → ${proposedPhase} skips work the workflow depends on. Phases still needing justification: ${missing.join(', ')}.`,
      remediation: `Advance one phase at a time (${CANONICAL_SEQUENCE}), or ${SKIPS_SYNTAX}.`,
    }),
  );
}

/**
 * Shared hatch check: every bypassed phase needs a valid phase_skips entry.
 * Invalid entries (bad shape, empty reason) deny uniformly; uncovered phases
 * deny with the caller's context-specific message.
 */
function requireJustifiedSkips(
  meta: Record<string, string | string[]> | undefined,
  bypassed: readonly string[],
  denialFor: (missing: string[]) => ProvenanceVerdict,
): ProvenanceVerdict {
  const skips = parseSkips(meta);
  if (skips.invalid.length > 0) {
    return {
      ok: false,
      reason: `phase_skips entry ${skips.invalid.map(entry => `"${entry}"`).join(', ')} is not a valid skip — every entry needs the "<phase>: <reason>" shape with a non-empty reason.`,
      remediation: `A skip is an auditable act: ${SKIPS_SYNTAX}.`,
    };
  }
  const missing = bypassed.filter(phase => !skips.justified.has(phase));
  return missing.length > 0 ? denialFor(missing) : OK;
}

/**
 * Birth semantics, shared by creation and type-flip/repair:
 * intake (or no phase) is free; past intake needs a phase_skips entry for
 * every bypassed phase. A non-canonical target is denied at creation; on a
 * flip it is pre-existing state and counts as intake (legacy migration rule).
 */
function evaluateBirth(
  meta: Record<string, string | string[]> | undefined,
  context: 'creation' | 'flip',
): ProvenanceVerdict {
  const phase = scalar(meta, 'phase');
  if (phase === undefined || phase === 'intake') return OK;

  if (!CANONICAL_SET.has(phase)) {
    if (context === 'flip') return OK;
    return {
      ok: false,
      reason: `"${phase}" is not a canonical ticket phase, so no gate keyed to phases would ever fire on this ticket. Canonical phases: ${CANONICAL_SEQUENCE}.`,
      remediation:
        'Create the ticket at phase: intake (or another canonical phase justified via phase_skips) and work forward.',
    };
  }

  return requireJustifiedSkips(meta, CANONICAL_PHASES.slice(0, canonicalIndex(phase)), missing => {
    const act = context === 'creation' ? 'begin life' : 'become a feature';
    return {
      ok: false,
      reason: `Feature tickets are born at phase: intake — this write would ${act} at "${phase}" without provenance, silently bypassing every gate keyed to the skipped phases. Phases still needing justification: ${missing.join(', ')}.`,
      remediation: `Start at phase: intake and work forward, or ${SKIPS_SYNTAX}.`,
    };
  });
}

// ---------------------------------------------------------------------------
// Artifact-content phase anchors (ticket HGYGND; supersedes #809's SHA anchors)
//
// A forward phase advance records the repo-relative path of the exit artifact
// of the phase being left — a `phase_anchors` block sequence, one
// `- <phase-entered>: <path>` entry per phase, mirroring the `phase_skips`
// convention. Verification reads the tree alone (an injected ArtifactReader):
// the anchored artifact must exist and pass its kind's cheap shape check. No
// anchor check consults git history, so verdicts survive amend, rebase,
// squash-merge, and shallow clones — the operations that orphaned SHA anchors
// (#902-#905, #911, #912). Hex-shaped legacy values are grandfathered at rest
// and drawn to the path grammar on new transitions. The R/G/R ledger's
// per-tick commit SHAs are a separate mechanism and keep their history-backed
// resolution (ledger-validation.ts / ledger-git.ts).
// ---------------------------------------------------------------------------

/**
 * Read one artifact's content by repo-relative path, or undefined when absent.
 * The tree behind it is the caller's choice: the staged index at the commit
 * boundary, HEAD at the push boundary, the filesystem for `safeword check`.
 * Callers with no tree at hand (write-time hooks) pass none — format-only.
 */
export type ArtifactReader = (relpath: string) => string | undefined;

/**
 * Parse a `phase_anchors` block sequence into entered-phase → recorded value.
 * Same shape as parseSkips: split each entry on the first colon. A blank value
 * is kept as `''` so validateAnchor (not this parser) is the single arbiter of
 * validity. Duplicate phase keys resolve to the LAST entry — re-doing a phase
 * legitimately replaces its output, so the latest anchor describes the phase's
 * current artifact (last-wins, pinned by test). Entries without a colon carry
 * no phase and are ignored.
 */
function parseAnchors(meta: Record<string, string | string[]> | undefined): Map<string, string> {
  const byPhase = new Map<string, string>();
  for (const { phase, value } of parsePhaseKeyedEntries(meta, 'phase_anchors').entries) {
    byPhase.set(phase, value);
  }
  return byPhase;
}

/** Non-blank content — the shape floor shared by the artifact kinds. */
function hasSubstance(content: string): boolean {
  return content.trim() !== '';
}

/**
 * The expected exit artifact for each enterable phase: how a recorded path is
 * recognized as that artifact, a remediation example, and the kind's cheap
 * shape check. Shape checks reuse the pure spec/plan parsers; verify.md and
 * the feature source use lightweight presence probes here — the authoritative
 * verify.md scope check stays `checkVerifyArtifact` (done-gate.ts), which the
 * boundary engine already runs on changed verify.md files. This map is the
 * codified phase→artifact contract the bdd skill's "artifact-first" rule
 * describes.
 */
interface AnchorKind {
  /** Human label for the expected artifact, used in verdict reasons. */
  label: string;
  /** Remediation example path for the expected anchor line. */
  example: string;
  matches: (relpath: string) => boolean;
  shapeOk: (relpath: string, content: string) => boolean;
}

const basenameOf = (relpath: string): string => relpath.split('/').at(-1) ?? '';

/** A Gherkin source: any .feature path with at least one scenario. */
const isFeatureSource = (relpath: string): boolean => relpath.endsWith('.feature');
const featureShapeOk = (content: string): boolean => /^\s*Scenario(?: Outline)?:/m.test(content);

/** Presence probe for verify.md's scope line (authoritative check: done-gate.ts). */
const VERIFY_SCOPE_LINE = /^\*\*PR Scope:\*\*\s*\S/im;

/**
 * Scenarios as evidence: the .feature (or test-definitions.md on the legacy
 * path). Anchors two forward advances — entering scenario-gate (define-behavior
 * produced the scenarios) and entering plan-implementation (scenario-gate is a
 * review gate with no distinct exit artifact of its own; its acceptance is
 * evidenced by the same reviewed source).
 */
const FEATURE_SOURCE_ANCHOR: AnchorKind = {
  label: 'the feature source (.feature, or test-definitions.md on the legacy path)',
  example: 'features/<slug>.feature',
  matches: relpath => isFeatureSource(relpath) || basenameOf(relpath) === 'test-definitions.md',
  shapeOk: (relpath, content) =>
    isFeatureSource(relpath) ? featureShapeOk(content) : hasSubstance(content),
};

// `satisfies` (not `Record<string, …>`) so the compiler forces an anchor kind
// for every enterable phase: a phase added to CANONICAL_PHASES without an entry
// here becomes a compile error, not a silently-unanchored forward transition.
const ANCHOR_KINDS = {
  'define-behavior': {
    label: 'spec.md',
    example: '<ticket-folder>/spec.md',
    matches: relpath => basenameOf(relpath) === 'spec.md',
    shapeOk: (_relpath, content) => {
      const jtbd = parseJtbdSection(content);
      return jtbd.entries.length > 0 || jtbd.skip !== null;
    },
  },
  'scenario-gate': FEATURE_SOURCE_ANCHOR,
  'plan-implementation': FEATURE_SOURCE_ANCHOR,
  implement: {
    label: 'impl-plan.md',
    example: '<ticket-folder>/impl-plan.md',
    matches: relpath => basenameOf(relpath) === 'impl-plan.md',
    shapeOk: (_relpath, content) => parseImplPlan(content).errors.length === 0,
  },
  verify: {
    label: 'test-definitions.md (the R/G/R ledger)',
    example: '<ticket-folder>/test-definitions.md',
    matches: relpath => basenameOf(relpath) === 'test-definitions.md',
    shapeOk: (_relpath, content) => hasSubstance(content),
  },
  done: {
    label: 'verify.md',
    example: '<ticket-folder>/verify.md',
    matches: relpath => basenameOf(relpath) === 'verify.md',
    shapeOk: (_relpath, content) => VERIFY_SCOPE_LINE.test(content),
  },
} satisfies Record<Exclude<(typeof CANONICAL_PHASES)[number], 'intake'>, AnchorKind>;

/**
 * A plausible repo-relative path: non-empty, forward-slashed, not absolute
 * (POSIX or Windows), free of `..` traversal, and free of git pathspec
 * magic/glob characters — a value opening with `(` or `:` would activate
 * pathspec magic inside a `git show :<path>` read (`:(top)x` exits 0 with
 * commit text, a false "anchored"), and glob characters are never a single
 * artifact's path. Deliberately permissive beyond that — existence and kind
 * checks do the real discrimination.
 */
function isPlausibleRepoPath(value: string): boolean {
  if (value === '' || value.includes('\\')) return false;
  if (value.startsWith('/') || /^[a-zA-Z]:/.test(value)) return false;
  if (/^[(:!^]/.test(value) || /[*?[\]]/.test(value)) return false;
  return !value.split('/').includes('..');
}

export type PhaseAnchorVerdict =
  | { kind: 'not-applicable' }
  | { kind: 'anchored' }
  | { kind: 'unanchored'; phase: string; reason: string };

const NOT_APPLICABLE: PhaseAnchorVerdict = { kind: 'not-applicable' };

/**
 * Detect whether a feature ticket's forward phase advance carries a valid
 * artifact-path anchor for the phase it enters (HGYGND). Pure — the tree is
 * read through an injected ArtifactReader, so the predicate touches neither
 * filesystem nor git: the boundary gate supplies a staged-index or HEAD-tree
 * reader, `safeword check` a filesystem reader; a caller with no tree at hand
 * passes none (format-only).
 *
 * Returns `anchored` / `unanchored` only for the policed act — a feature→feature
 * FORWARD phase change. Everything else is `not-applicable`: a creation/birth, a
 * type-flip into feature (prior was not a feature, so it never traversed the
 * phases), a non-feature ticket, a backward move, a re-declaration, or an
 * at-rest edit. The detector polices transitions, not history — exactly like
 * evaluateTicketWrite.
 */
export function detectUnanchoredPhaseTransition(
  priorContent: string | undefined,
  proposedContent: string,
  readArtifact?: ArtifactReader,
): PhaseAnchorVerdict {
  // A creation is a birth, not a transition.
  if (priorContent === undefined) return NOT_APPLICABLE;

  const proposed = frontmatterOf(normalizeNewlines(proposedContent));
  const prior = frontmatterOf(normalizeNewlines(priorContent));
  if (proposed === undefined) return NOT_APPLICABLE;

  // Feature→feature only. A type-flip into feature is a birth, not an advance.
  if (scalar(proposed, 'type') !== 'feature' || scalar(prior, 'type') !== 'feature') {
    return NOT_APPLICABLE;
  }

  const priorPhase = scalar(prior, 'phase');
  const proposedPhase = scalar(proposed, 'phase');
  if (proposedPhase === undefined || proposedPhase === priorPhase) return NOT_APPLICABLE;

  const toIndex = canonicalIndex(proposedPhase);
  if (toIndex === -1) return NOT_APPLICABLE; // off-enum target — legality is evaluateAdvance's job

  const effectivePrior =
    priorPhase !== undefined && CANONICAL_SET.has(priorPhase) ? priorPhase : 'intake';
  if (toIndex <= canonicalIndex(effectivePrior)) return NOT_APPLICABLE; // backward or lateral

  // Policed: a forward feature advance must carry a valid anchor for the phase entered.
  return validateAnchor(proposed, proposedPhase, readArtifact);
}

/**
 * Shared anchor validation ladder: entry present → path-shaped (hex is the
 * legacy branch) → expected kind for the phase → (with a reader) present in
 * the tree → shape-valid. Every denial names the exact line to write — the
 * honest hand-editor must be distinguishable from a forger by remediation,
 * not accusation.
 */
function validateAnchor(
  meta: Record<string, string | string[]>,
  phase: string,
  readArtifact?: ArtifactReader,
): PhaseAnchorVerdict {
  const kind = (ANCHOR_KINDS as Record<string, AnchorKind | undefined>)[phase];
  if (kind === undefined) return NOT_APPLICABLE; // intake/off-enum — nothing enterable to anchor

  const unanchored = (reason: string): PhaseAnchorVerdict => ({
    kind: 'unanchored',
    phase,
    reason,
  });
  const expectedLine = `\`- ${phase}: ${kind.example}\``;
  const anchor = parseAnchors(meta).get(phase);
  if (anchor === undefined) {
    return unanchored(
      `no phase_anchors entry for "${phase}" — record the exited phase's artifact, e.g. ${expectedLine}.`,
    );
  }
  if (isValidSha(anchor)) {
    return unanchored(
      `phase_anchors entry for "${phase}" is "${anchor}", a legacy commit-SHA anchor — record the artifact path instead, e.g. ${expectedLine}.`,
    );
  }
  if (!isPlausibleRepoPath(anchor)) {
    return unanchored(
      `phase_anchors entry for "${phase}" is "${anchor}", not a repo-relative artifact path — record ${expectedLine}.`,
    );
  }
  if (!kind.matches(anchor)) {
    return unanchored(
      `phase_anchors entry for "${phase}" is "${anchor}", not the expected artifact kind — "${phase}" expects ${kind.label}, e.g. ${expectedLine}.`,
    );
  }
  if (readArtifact === undefined) return { kind: 'anchored' };

  const content = readArtifact(anchor);
  if (content === undefined) {
    return unanchored(`anchored artifact "${anchor}" for "${phase}" is missing from the tree.`);
  }
  if (!kind.shapeOk(anchor, content)) {
    return unanchored(
      `anchored artifact "${anchor}" for "${phase}" fails its shape check — it does not look like ${kind.label}.`,
    );
  }
  return { kind: 'anchored' };
}

/**
 * At-rest variant of the anchor check (issue #824): does a feature ticket's
 * CURRENT phase carry a valid anchor? No transition needed — this is the
 * advisory view `safeword check` reports for in-progress tickets. Format-only
 * without a reader; existence + shape with one (`safeword check` injects the
 * filesystem). One deliberate divergence from the transition detector: a
 * hex-shaped legacy anchor at rest is `not-applicable` — pre-redesign tickets
 * recorded SHAs honestly under the old convention, and re-litigating them
 * would demand fabricated evidence (#909). Only a NEW transition draws the
 * migrate-to-path remediation. Intake is never anchored (nothing was advanced
 * into), non-features and off-enum phases are not policed, and the caller
 * decides status scoping.
 */
export function detectUnanchoredPhaseState(
  content: string,
  readArtifact?: ArtifactReader,
): PhaseAnchorVerdict {
  const meta = frontmatterOf(normalizeNewlines(content));
  if (meta === undefined) return NOT_APPLICABLE;
  if (scalar(meta, 'type') !== 'feature') return NOT_APPLICABLE;

  const phase = scalar(meta, 'phase');
  if (phase === undefined || phase === 'intake' || !CANONICAL_SET.has(phase)) {
    return NOT_APPLICABLE;
  }

  const anchor = parseAnchors(meta).get(phase);
  if (anchor !== undefined && isValidSha(anchor)) return NOT_APPLICABLE;

  return validateAnchor(meta, phase, readArtifact);
}
