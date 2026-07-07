// Occurrence ledger — the single retro-maintained comment on a known issue that
// records VOLUME (how many sessions/harnesses hit it) without flooding the
// thread. State round-trips as JSON inside a hidden marker so retro can find and
// edit its own comment idempotently. Session ids gate volume (one bump per
// session); manifestation hashes gate SHAPE (a comment is posted only for a
// manifestation not already documented).

export const LEDGER_MARKER = '<!-- retro-ledger -->';
const DATA_OPEN = '<!-- retro-data:';
const DATA_CLOSE = '-->';

/**
 * Code-state provenance of an encounter (G19QG7): a dogfood session records the
 * safeword repo's short HEAD SHA, a customer install records the installed
 * safeword version — both with the capture time. Newest encounter wins; the
 * ledger keeps only the latest.
 */
export interface Provenance {
  sha?: string;
  version?: string;
  at: string;
}

export interface LedgerState {
  total: number;
  harness: Record<string, number>;
  sessions: string[];
  manifestations: string[];
  /** Newest encounter's code-state provenance; absent on pre-provenance ledgers. */
  provenance?: Provenance;
}

export interface EncounterInput {
  sessionId: string;
  harness: string;
  manifestation: string;
  /** Code state observed by this encounter; omitted when unresolvable. */
  provenance?: Provenance;
}

export interface EncounterResult {
  state: LedgerState;
  /** True when this encounter changed the ledger (a new session was counted). */
  changed: boolean;
  /** True when the manifestation was not already documented. */
  novel: boolean;
}

export function emptyLedger(): LedgerState {
  return { total: 0, harness: {}, sessions: [], manifestations: [] };
}

/** Parse a comment body into ledger state; returns the empty ledger when unmarked. */
export function parseLedger(body: string): LedgerState {
  const start = body.indexOf(DATA_OPEN);
  if (start === -1) return emptyLedger();
  const from = start + DATA_OPEN.length;
  const end = body.indexOf(DATA_CLOSE, from);
  if (end === -1) return emptyLedger();
  try {
    const parsed = JSON.parse(body.slice(from, end).trim()) as Record<string, unknown>;
    const provenance = coerceProvenance(parsed.provenance);
    return {
      total: typeof parsed.total === 'number' ? parsed.total : 0,
      harness: coerceHarness(parsed.harness),
      sessions: coerceStringArray(parsed.sessions),
      manifestations: coerceStringArray(parsed.manifestations),
      ...(provenance && { provenance }),
    };
  } catch {
    return emptyLedger();
  }
}

// The ledger comment is attacker-influenceable (anyone who can comment on the
// upstream issue), so every field is coerced — wrong types become safe defaults
// rather than crashing recordEncounter / renderLedger downstream.
function coerceStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function coerceProvenance(value: unknown): Provenance | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  if (typeof source.at !== 'string') return undefined;
  const provenance: Provenance = { at: source.at };
  if (typeof source.sha === 'string') provenance.sha = source.sha;
  if (typeof source.version === 'string') provenance.version = source.version;
  return provenance;
}

function coerceHarness(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === 'number') out[key] = count;
  }
  return out;
}

/** Render ledger state as a human-readable comment body with the embedded data marker. */
export function renderLedger(state: LedgerState): string {
  const breakdown = Object.entries(state.harness)
    .map(([name, count]) => `${name} ×${count}`)
    .join(', ');
  const data = JSON.stringify(state);
  return [
    LEDGER_MARKER,
    `**Retro occurrences:** ${state.total} across ${state.sessions.length} session(s)`,
    '',
    breakdown.length > 0 ? `Harness: ${breakdown}` : 'Harness: (none recorded)',
    '',
    `${DATA_OPEN} ${data} ${DATA_CLOSE}`,
  ].join('\n');
}

/**
 * Fold an encounter into the ledger. A session already recorded is a no-op for
 * volume (idempotent re-runs). A manifestation not yet documented is flagged
 * novel and remembered, so the caller posts exactly one shape comment for it.
 */
export function recordEncounter(state: LedgerState, input: EncounterInput): EncounterResult {
  const novel = !state.manifestations.includes(input.manifestation);
  const manifestations = novel
    ? [...state.manifestations, input.manifestation]
    : state.manifestations;

  if (state.sessions.includes(input.sessionId)) {
    // Volume already counted for this session; only a never-seen manifestation
    // (rare on a re-run) updates state.
    return {
      state: { ...state, manifestations },
      changed: novel,
      novel,
    };
  }

  return {
    state: {
      total: state.total + 1,
      harness: { ...state.harness, [input.harness]: (state.harness[input.harness] ?? 0) + 1 },
      sessions: [...state.sessions, input.sessionId],
      manifestations,
      ...(input.provenance && { provenance: input.provenance }),
    },
    changed: true,
    novel,
  };
}
