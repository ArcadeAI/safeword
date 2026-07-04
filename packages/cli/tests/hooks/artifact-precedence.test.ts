/**
 * Unit tests for the artifact-precedence evaluators (ticket 87Y167, #644 G1).
 * Pure functions — no filesystem. Pins the dimensions.md partitions routed to
 * units (payload pass-through lives at the gate; reviewGate-on no-double-demand
 * is pinned here) plus the load-bearing implement-entry logic: phase_skips
 * coverage, scenario-source resolution, and ticket-qualified stamp matching.
 * The Cucumber lane (features/artifact-precedence-gate.feature) proves the
 * same behavior end-to-end through the hook subprocess.
 */

import { describe, expect, it } from 'vitest';

import {
  evaluateDimensionsCreation,
  evaluateImplementEntry,
  evaluateSpecCreation,
  resolveScenarioSource,
} from '../../templates/hooks/lib/artifact-precedence.js';
import { hashArtifact, reviewScope } from '../../templates/hooks/lib/review-ledger.js';

const PERSONAS = '# Personas\n\n## Fixture Person (FP)\n\n**Role:** exercises gates.\n';

const COMPLETE_SPEC = [
  '# Spec: fixture',
  '',
  '## Jobs To Be Done',
  '',
  '### fixture.FP1 — exercise the gate',
  '',
  '**Persona:** Fixture Person (FP)',
  '',
  '> When I write tickets, I want gates to fire, so I can trust phase state.',
  '',
  '#### fixture.FP1.AC1 — the gate decides deterministically',
  '',
].join('\n');

const JOBLESS_SPEC = '# Spec: fixture\n\n## Jobs To Be Done\n\n';

function ticket(options: { type?: string; phase?: string; skips?: string[] }): string {
  const lines = ['---', 'id: ZZTEST', 'slug: fixture'];
  if (options.type !== undefined) lines.push(`type: ${options.type}`);
  if (options.phase !== undefined) lines.push(`phase: ${options.phase}`);
  lines.push('status: in_progress');
  if (options.skips !== undefined) {
    lines.push('phase_skips:');
    for (const skipEntry of options.skips) lines.push(`  - ${skipEntry}`);
  }
  lines.push('---', '', '# Fixture', '');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// evaluateSpecCreation
// ---------------------------------------------------------------------------

describe('evaluateSpecCreation', () => {
  it('denies spec.md creation when ticket.md is absent, naming ticket.md', () => {
    const verdict = evaluateSpecCreation({ ticketFileExists: false });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('ticket.md');
  });

  it('allows spec.md creation when ticket.md exists', () => {
    expect(evaluateSpecCreation({ ticketFileExists: true }).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateDimensionsCreation
// ---------------------------------------------------------------------------

describe('evaluateDimensionsCreation', () => {
  it('denies when spec.md is missing, naming spec.md as the artifact to author first', () => {
    const verdict = evaluateDimensionsCreation({
      ticketType: 'feature',
      specContent: undefined,
      personasContent: PERSONAS,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toContain('spec.md');
      expect(verdict.reason).not.toContain('dimensions.md before');
    }
  });

  it('denies when the spec has no resolvable job', () => {
    const verdict = evaluateDimensionsCreation({
      ticketType: 'feature',
      specContent: JOBLESS_SPEC,
      personasContent: PERSONAS,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/Job To Be Done/i);
  });

  it('denies when a job lacks acceptance criteria', () => {
    const spec = COMPLETE_SPEC.replace(
      '#### fixture.FP1.AC1 — the gate decides deterministically',
      '',
    );
    const verdict = evaluateDimensionsCreation({
      ticketType: 'feature',
      specContent: spec,
      personasContent: PERSONAS,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/Acceptance Criterion/i);
  });

  it('allows on a complete spec', () => {
    const verdict = evaluateDimensionsCreation({
      ticketType: 'feature',
      specContent: COMPLETE_SPEC,
      personasContent: PERSONAS,
    });
    expect(verdict.ok).toBe(true);
  });

  it('allows on a spec whose jobs section is a reasoned skip', () => {
    const verdict = evaluateDimensionsCreation({
      ticketType: 'feature',
      specContent: '# Spec\n\n## Jobs To Be Done\n\nskip: internal plumbing\n',
      personasContent: PERSONAS,
    });
    expect(verdict.ok).toBe(true);
  });

  it('denies on a spec whose jobs skip has a blank reason', () => {
    const verdict = evaluateDimensionsCreation({
      ticketType: 'feature',
      specContent: '# Spec\n\n## Jobs To Be Done\n\nskip:\n',
      personasContent: PERSONAS,
    });
    expect(verdict.ok).toBe(false);
  });

  it.each(['task', 'patch', 'epic', undefined])('exempts non-feature ticket type %s', type => {
    const verdict = evaluateDimensionsCreation({
      ticketType: type,
      specContent: undefined,
      personasContent: PERSONAS,
    });
    expect(verdict.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveScenarioSource
// ---------------------------------------------------------------------------

describe('resolveScenarioSource', () => {
  it('resolves the Feature source: line to the named path', () => {
    const ledger = '# Test Definitions\n\nFeature source: `features/fixture.feature`\n';
    expect(resolveScenarioSource(ledger)).toBe('features/fixture.feature');
  });

  it('returns undefined when no feature source is named', () => {
    expect(resolveScenarioSource('# Test Definitions\n\n## Rule: x\n')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// evaluateImplementEntry — the load-bearing slice
// ---------------------------------------------------------------------------

const SOURCE_CONTENT = 'Feature: fixture\n  Scenario: a\n';
const LEDGER_WITH_SOURCE = '# Test Definitions\n\nFeature source: `features/fixture.feature`\n';
const LEDGER_ONLY = '# Test Definitions\n\n## Rule: x\n\n### Scenario: a\n\n- [ ] RED\n';

function entry(options: {
  prior?: string;
  proposed?: string;
  ledger?: string;
  /** test-definitions.md absent (ledger option ignored). */
  noLedger?: boolean;
  source?: string;
  stamps?: { scope: string; skipReason?: string }[];
  ticketFolder?: string;
}) {
  const ledger = options.noLedger ? undefined : (options.ledger ?? LEDGER_ONLY);
  return evaluateImplementEntry({
    priorTicketContent: options.prior ?? ticket({ type: 'feature', phase: 'scenario-gate' }),
    proposedTicketContent: options.proposed ?? ticket({ type: 'feature', phase: 'implement' }),
    ticketFolder: options.ticketFolder ?? 'ZZTEST-fixture',
    ledgerContent: ledger,
    resolveSourceContent: () => options.source,
    stamps: options.stamps ?? [],
  });
}

describe('evaluateImplementEntry — demand and satisfaction', () => {
  it('denies a forward advance into implement with no scenario review stamp', () => {
    const verdict = entry({});
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/independent review/i);
  });

  it('allows when a stamp matches the ledger at current content (no source named)', () => {
    const scope = reviewScope('ZZTEST-fixture', 'scenarios', hashArtifact(LEDGER_ONLY));
    expect(entry({ stamps: [{ scope }] }).ok).toBe(true);
  });

  it('binds to the named feature source when the ledger names one', () => {
    const scope = reviewScope('ZZTEST-fixture', 'scenarios', hashArtifact(SOURCE_CONTENT));
    const verdict = entry({
      ledger: LEDGER_WITH_SOURCE,
      source: SOURCE_CONTENT,
      stamps: [{ scope }],
    });
    expect(verdict.ok).toBe(true);
  });

  it('rejects a stamp for the ledger when the ledger names a feature source', () => {
    const ledgerScope = reviewScope(
      'ZZTEST-fixture',
      'scenarios',
      hashArtifact(LEDGER_WITH_SOURCE),
    );
    const verdict = entry({
      ledger: LEDGER_WITH_SOURCE,
      source: SOURCE_CONTENT,
      stamps: [{ scope: ledgerScope }],
    });
    expect(verdict.ok).toBe(false);
  });

  it('falls back to the ledger when a named source is unreadable (resolver returns undefined)', () => {
    // The hook's resolver returns undefined on any read error (EISDIR/EACCES);
    // the gate must then bind to the ledger, not crash — a ledger stamp satisfies.
    const ledgerScope = reviewScope(
      'ZZTEST-fixture',
      'scenarios',
      hashArtifact(LEDGER_WITH_SOURCE),
    );
    const verdict = entry({
      ledger: LEDGER_WITH_SOURCE,
      source: undefined,
      stamps: [{ scope: ledgerScope }],
    });
    expect(verdict.ok).toBe(true);
  });

  it('denies when a named source is unreadable and no stamp matches the ledger', () => {
    const verdict = entry({ ledger: LEDGER_WITH_SOURCE, source: undefined });
    expect(verdict.ok).toBe(false);
  });

  it('rejects a stale stamp after the scenario source changed', () => {
    const staleScope = reviewScope('ZZTEST-fixture', 'scenarios', hashArtifact('old content'));
    const verdict = entry({
      ledger: LEDGER_WITH_SOURCE,
      source: SOURCE_CONTENT,
      stamps: [{ scope: staleScope }],
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/current content|changed/i);
  });

  it("rejects another ticket's stamp at identical source content", () => {
    const foreignScope = reviewScope('OTHER1-ticket', 'scenarios', hashArtifact(SOURCE_CONTENT));
    const verdict = entry({
      ledger: LEDGER_WITH_SOURCE,
      source: SOURCE_CONTENT,
      stamps: [{ scope: foreignScope }],
    });
    expect(verdict.ok).toBe(false);
  });

  it('accepts a logged skip with a reason at current content', () => {
    const scope = reviewScope('ZZTEST-fixture', 'scenarios', hashArtifact(LEDGER_ONLY));
    expect(entry({ stamps: [{ scope, skipReason: 'greenfield spike' }] }).ok).toBe(true);
  });

  it('rejects a logged skip with an empty reason', () => {
    const scope = reviewScope('ZZTEST-fixture', 'scenarios', hashArtifact(LEDGER_ONLY));
    const verdict = entry({ stamps: [{ scope, skipReason: '  ' }] });
    expect(verdict.ok).toBe(false);
  });

  it('denies with no scenario artifact, naming test-definitions.md first', () => {
    const verdict = entry({ noLedger: true });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('test-definitions.md');
  });
});

describe('evaluateImplementEntry — phase_skips hatch', () => {
  it('is satisfied by a phase_skips entry covering scenario-gate', () => {
    const verdict = entry({
      prior: ticket({ type: 'feature', phase: 'intake' }),
      proposed: ticket({
        type: 'feature',
        phase: 'implement',
        skips: ['define-behavior: scenarios exist as tests', 'scenario-gate: reviewed on PR'],
      }),
      noLedger: true,
    });
    expect(verdict.ok).toBe(true);
  });

  it('is not satisfied by a phase_skips entry for a different phase', () => {
    const verdict = entry({
      proposed: ticket({
        type: 'feature',
        phase: 'implement',
        skips: ['intake: migrated'],
      }),
    });
    expect(verdict.ok).toBe(false);
  });

  it('is not satisfied by a scenario-gate entry with a blank reason', () => {
    const verdict = entry({
      proposed: ticket({ type: 'feature', phase: 'implement', skips: ['scenario-gate:'] }),
    });
    expect(verdict.ok).toBe(false);
  });
});

describe('evaluateImplementEntry — writes it never gates', () => {
  it('ignores non-feature tickets', () => {
    const verdict = entry({
      prior: ticket({ type: 'task', phase: 'scenario-gate' }),
      proposed: ticket({ type: 'task', phase: 'implement' }),
    });
    expect(verdict.ok).toBe(true);
  });

  it('ignores edits that leave the phase unchanged', () => {
    const same = ticket({ type: 'feature', phase: 'scenario-gate' });
    expect(entry({ prior: same, proposed: `${same}\nnote` }).ok).toBe(true);
  });

  it('ignores backward moves out of implement', () => {
    const verdict = entry({
      prior: ticket({ type: 'feature', phase: 'implement' }),
      proposed: ticket({ type: 'feature', phase: 'define-behavior' }),
    });
    expect(verdict.ok).toBe(true);
  });

  it('ignores backward moves into implement (verify rework)', () => {
    const verdict = entry({
      prior: ticket({ type: 'feature', phase: 'verify' }),
      proposed: ticket({ type: 'feature', phase: 'implement' }),
    });
    expect(verdict.ok).toBe(true);
  });

  it('ignores advances not targeting implement', () => {
    const verdict = entry({
      prior: ticket({ type: 'feature', phase: 'implement' }),
      proposed: ticket({ type: 'feature', phase: 'verify' }),
    });
    expect(verdict.ok).toBe(true);
  });

  it('treats an unknown prior phase as intake (forward into implement is gated)', () => {
    const verdict = entry({
      prior: ticket({ type: 'feature', phase: 'research' }),
      proposed: ticket({ type: 'feature', phase: 'implement' }),
    });
    expect(verdict.ok).toBe(false);
  });
});
