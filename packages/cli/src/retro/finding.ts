// Retro finding schema + normalizer.
//
// The extraction agent emits findings as a constrained, snake_case schema (see
// `packages/cli/features/retro-transcript-mining.feature`). normalizeFinding is
// the first egress wall: it maps that raw shape to a typed Finding built ONLY
// from allowlisted fields and drops everything else, so an agent cannot smuggle
// customer data through an off-schema field. The issue body is later assembled
// by `assembleBody` from these fields alone — never free-written by the agent.

type FindingCategory = 'bug' | 'rough-edge' | 'gap';

const CATEGORIES: ReadonlySet<string> = new Set<FindingCategory>(['bug', 'rough-edge', 'gap']);

/**
 * Whether the friction is still live (`present`) or the session already fixed it
 * in safeword (`resolved`). The pipeline files only `present` findings — filing a
 * `resolved` one would spam the tracker with already-solved bugs (ticket 1M20EW).
 */
type FindingStatus = 'present' | 'resolved';

/** A normalized retro finding — exactly the allowlisted, typed fields. */
export interface Finding {
  category: FindingCategory;
  title: string;
  safewordSurface: string;
  whatHappened: string;
  whyFriction: string;
  repro: string;
  /** Resolution state; defaults to `present` when the model omits/garbles it. */
  status: FindingStatus;
}

// Bound each free-text field so even a schema-valid finding can't carry a blob.
const MAX_FIELD_LENGTH = 600;

function boundedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, MAX_FIELD_LENGTH);
}

/**
 * Resolve the finding status, defaulting to `present` unless the model EXPLICITLY
 * says `resolved` — a missing or garbled label must not silently drop live friction
 * (over-filing is recoverable by triage; suppressing real friction is not; 1M20EW).
 */
function resolveStatus(value: unknown): FindingStatus {
  return value === 'resolved' ? 'resolved' : 'present';
}

/**
 * Map a raw agent finding to a typed Finding, keeping only allowlisted fields.
 * Returns undefined when the input is not an object, the category is outside the
 * enum, or any required field is missing/empty. Off-schema keys are dropped.
 */
export function normalizeFinding(raw: unknown): Finding | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const source = raw as Record<string, unknown>;

  const category = typeof source.category === 'string' ? source.category : '';
  if (!CATEGORIES.has(category)) return undefined;

  const title = boundedString(source.title);
  const safewordSurface = boundedString(source.safeword_surface);
  const whatHappened = boundedString(source.what_happened);
  const whyFriction = boundedString(source.why_friction);
  const repro = boundedString(source.repro);

  if (!title || !safewordSurface || !whatHappened || !whyFriction || !repro) return undefined;

  return {
    category: category as FindingCategory,
    title,
    safewordSurface,
    whatHappened,
    whyFriction,
    repro,
    status: resolveStatus(source.status),
  };
}

/**
 * Assemble the GitHub issue body from a Finding's fields only. Code owns this —
 * the agent never writes the body — so no off-schema prose can reach the wire.
 */
export function assembleBody(finding: Finding): string {
  return [
    `**Category:** ${finding.category}`,
    `**Safeword surface:** \`${finding.safewordSurface}\``,
    '',
    '**What happened**',
    '',
    finding.whatHappened,
    '',
    '**Why it is friction**',
    '',
    finding.whyFriction,
    '',
    '**Repro**',
    '',
    finding.repro,
    '',
    '<sub>Auto-filed by `safeword retro` from a session transcript; sanitized at egress (no customer data).</sub>',
  ].join('\n');
}
