/**
 * Unit tests for the artifact-content phase-anchor detectors (ticket HGYGND).
 * Pure functions — no filesystem, no git. An anchor value is the repo-relative
 * path of the exited phase's exit artifact; verification reads the tree via an
 * injected ArtifactReader and never consults history. Pins each dimensions.md
 * partition; the Cucumber lane (features/artifact-content-phase-anchors.feature)
 * proves the same behavior end-to-end, and the boundary command suites cover
 * the tier/history partitions.
 */

import { describe, expect, it } from 'vitest';

import type { ArtifactReader } from '../../templates/hooks/lib/phase-provenance.js';
import {
  detectUnanchoredPhaseState,
  detectUnanchoredPhaseTransition,
} from '../../templates/hooks/lib/phase-provenance.js';

/** A well-formed 7-hex abbreviated SHA — the legacy grammar. */
const SHA = 'a1b2c3d';

const TICKET_DIR = '.project/tickets/ZZTEST-fixture';
const IMPL_PLAN_PATH = `${TICKET_DIR}/impl-plan.md`;
const SPEC_PATH = `${TICKET_DIR}/spec.md`;
const LEDGER_PATH = `${TICKET_DIR}/test-definitions.md`;
const VERIFY_PATH = `${TICKET_DIR}/verify.md`;
const FEATURE_PATH = 'features/fixture.feature';

const SHAPE_VALID_IMPL_PLAN = [
  '# Impl Plan: fixture',
  '',
  '**Status:** planned',
  '',
  '## Approach',
  '',
  'Swap the grammar in place.',
  '',
  '## Decisions',
  '',
  'skip: fixture plan',
  '',
  '## Arch alignment',
  '',
  'skip: fixture plan',
  '',
  '## Known deviations',
  '',
  'skip: fixture plan',
  '',
  '## Assessment triggers',
  '',
  'skip: fixture plan',
  '',
].join('\n');

/** Scaffold with the headings present but every section empty — shape-invalid. */
const HOLLOW_IMPL_PLAN = [
  '# Impl Plan: fixture',
  '',
  '**Status:** planned',
  '',
  '## Approach',
  '',
  '## Decisions',
  '',
  '## Arch alignment',
  '',
  '## Known deviations',
  '',
  '## Assessment triggers',
  '',
].join('\n');

const SHAPE_VALID_SPEC = [
  '# Spec: fixture',
  '',
  '## Jobs To Be Done',
  '',
  '### fixture.SM1 — Do the job',
  '',
  '**Persona:** Safeword Maintainer (SM)',
  '',
  '> When I advance a phase, I want evidence recorded, so I can trust the trail.',
  '',
  '#### fixture.SM1.R1 — Evidence survives history rewrites',
  '',
].join('\n');

const SHAPE_VALID_FEATURE = [
  'Feature: fixture',
  '',
  '  Scenario: something observable happens',
  '    Given a precondition',
  '    When an action',
  '    Then an outcome',
  '',
].join('\n');

const SHAPE_VALID_LEDGER = [
  '# Test Definitions: fixture',
  '',
  '## Rule: something holds',
  '',
  '### Scenario: something observable happens',
  '',
  '- [ ] RED',
  '- [ ] GREEN',
  '- [ ] REFACTOR',
  '',
].join('\n');

const SHAPE_VALID_VERIFY = [
  '# Verify: fixture',
  '',
  '- Tests: 12/12 pass',
  '- Audit passed',
  '',
  '**PR Scope:** ✅ diff matches ticket scope',
  '',
].join('\n');

/** Reader over an in-memory tree. */
function readerFor(tree: Record<string, string>): ArtifactReader {
  return (relpath: string) => tree[relpath];
}

const FULL_TREE: Record<string, string> = {
  [IMPL_PLAN_PATH]: SHAPE_VALID_IMPL_PLAN,
  [SPEC_PATH]: SHAPE_VALID_SPEC,
  [LEDGER_PATH]: SHAPE_VALID_LEDGER,
  [VERIFY_PATH]: SHAPE_VALID_VERIFY,
  [FEATURE_PATH]: SHAPE_VALID_FEATURE,
  'README.md': '# Fixture readme\n',
};

const readTree = readerFor(FULL_TREE);

function ticket(options: { type?: string; phase?: string; anchors?: string[] }): string {
  const lines = ['---', 'id: ZZTEST', 'slug: fixture'];
  if (options.type !== undefined) lines.push(`type: ${options.type}`);
  if (options.phase !== undefined) lines.push(`phase: ${options.phase}`);
  lines.push('status: in_progress');
  if (options.anchors !== undefined) {
    lines.push('phase_anchors:');
    for (const entry of options.anchors) lines.push(`  - ${entry}`);
  }
  lines.push('---', '', '# Fixture', '');
  return lines.join('\n');
}

describe('detectUnanchoredPhaseTransition — an advance anchored to the exited phase’s artifact', () => {
  it('a forward advance recording an existing shape-valid artifact path is anchored', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'scenario-gate' }),
      ticket({ type: 'feature', phase: 'implement', anchors: [`implement: ${IMPL_PLAN_PATH}`] }),
      readTree,
    );
    expect(verdict.kind).toBe('anchored');
  });

  it('only the entered phase needs an anchor on a multi-step advance', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'define-behavior' }),
      ticket({ type: 'feature', phase: 'implement', anchors: [`implement: ${IMPL_PLAN_PATH}`] }),
      readTree,
    );
    expect(verdict.kind).toBe('anchored');
  });

  it('a plausible path with no reader supplied is anchored (format-only mode)', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'scenario-gate' }),
      ticket({ type: 'feature', phase: 'implement', anchors: [`implement: ${IMPL_PLAN_PATH}`] }),
    );
    expect(verdict.kind).toBe('anchored');
  });
});

describe('detectUnanchoredPhaseTransition — the per-phase kind map', () => {
  it.each([
    ['define-behavior', 'intake', SPEC_PATH],
    ['scenario-gate', 'define-behavior', FEATURE_PATH],
    ['implement', 'scenario-gate', IMPL_PLAN_PATH],
    ['verify', 'implement', LEDGER_PATH],
    ['done', 'verify', VERIFY_PATH],
  ])('entering %s anchored to its canonical artifact is anchored', (entered, prior, path) => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: prior }),
      ticket({ type: 'feature', phase: entered, anchors: [`${entered}: ${path}`] }),
      readTree,
    );
    expect(verdict.kind).toBe('anchored');
  });

  it('the scenario-gate anchor accepts the legacy test-definitions fallback', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'define-behavior' }),
      ticket({
        type: 'feature',
        phase: 'scenario-gate',
        anchors: [`scenario-gate: ${LEDGER_PATH}`],
      }),
      readTree,
    );
    expect(verdict.kind).toBe('anchored');
  });

  it('an anchor of the wrong kind for the entered phase is unanchored, naming the mismatch', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'verify' }),
      ticket({ type: 'feature', phase: 'done', anchors: ['done: README.md'] }),
      readTree,
    );
    expect(verdict.kind).toBe('unanchored');
    if (verdict.kind === 'unanchored') {
      expect(verdict.reason).toMatch(/expected/i);
      expect(verdict.reason).toContain('verify.md');
    }
  });
});

describe('detectUnanchoredPhaseTransition — re-advance is judged by the latest entry (last-wins)', () => {
  it('a re-advance whose latest entry names an existing artifact is anchored', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'scenario-gate' }),
      ticket({
        type: 'feature',
        phase: 'implement',
        anchors: [`implement: ${TICKET_DIR}/gone.md`, `implement: ${IMPL_PLAN_PATH}`],
      }),
      readTree,
    );
    expect(verdict.kind).toBe('anchored');
  });

  it('an earlier valid entry cannot rescue a re-advance whose latest entry is stale', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'scenario-gate' }),
      ticket({
        type: 'feature',
        phase: 'implement',
        anchors: [`implement: ${IMPL_PLAN_PATH}`, `implement: ${TICKET_DIR}/gone.md`],
      }),
      readTree,
    );
    expect(verdict.kind).toBe('unanchored');
  });
});

describe('detectUnanchoredPhaseTransition — no real artifact behind the advance is unanchored', () => {
  it('no phase_anchors block at all is unanchored, naming the expected anchor line', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'scenario-gate' }),
      ticket({ type: 'feature', phase: 'implement' }),
      readTree,
    );
    expect(verdict.kind).toBe('unanchored');
    if (verdict.kind === 'unanchored') {
      expect(verdict.reason).toContain('- implement:');
      expect(verdict.reason).toContain('impl-plan.md');
    }
  });

  it('a phase_anchors block naming only an earlier phase is unanchored', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'scenario-gate' }),
      ticket({
        type: 'feature',
        phase: 'implement',
        anchors: ['scenario-gate: features/fixture.feature'],
      }),
      readTree,
    );
    expect(verdict.kind).toBe('unanchored');
  });

  it('an empty anchor value is unanchored', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'scenario-gate' }),
      ticket({ type: 'feature', phase: 'implement', anchors: ['implement:'] }),
      readTree,
    );
    expect(verdict.kind).toBe('unanchored');
  });

  it.each([
    '../outside/impl-plan.md',
    '/absolute/impl-plan.md',
    // Git pathspec magic / glob values would change the MEANING of a
    // `git show :<path>` read (`:(top)x` exits 0 with commit text — a false
    // "anchored"); they are rejected as paths before any read happens.
    '(top)gone/impl-plan.md',
    ':colon/impl-plan.md',
    'glob/*/impl-plan.md',
  ])('an implausible path value %s is unanchored', value => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'scenario-gate' }),
      ticket({ type: 'feature', phase: 'implement', anchors: [`implement: ${value}`] }),
      readTree,
    );
    expect(verdict.kind).toBe('unanchored');
  });

  it('an empty (readable but blank) artifact fails its shape check rather than reading as missing', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'implement' }),
      ticket({ type: 'feature', phase: 'verify', anchors: [`verify: ${LEDGER_PATH}`] }),
      readerFor({ [LEDGER_PATH]: '' }),
    );
    expect(verdict.kind).toBe('unanchored');
    if (verdict.kind === 'unanchored') expect(verdict.reason).toMatch(/shape/i);
  });

  it('a path absent from the tree is unanchored, saying it is missing', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'scenario-gate' }),
      ticket({
        type: 'feature',
        phase: 'implement',
        anchors: [`implement: ${TICKET_DIR}/gone/impl-plan.md`],
      }),
      readTree,
    );
    expect(verdict.kind).toBe('unanchored');
    if (verdict.kind === 'unanchored') expect(verdict.reason).toMatch(/missing/i);
  });

  it('a hollow scaffold artifact is unanchored, saying it fails its shape check', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'scenario-gate' }),
      ticket({ type: 'feature', phase: 'implement', anchors: [`implement: ${IMPL_PLAN_PATH}`] }),
      readerFor({ [IMPL_PLAN_PATH]: HOLLOW_IMPL_PLAN }),
    );
    expect(verdict.kind).toBe('unanchored');
    if (verdict.kind === 'unanchored') expect(verdict.reason).toMatch(/shape/i);
  });

  it('a hex-shaped legacy value on a new transition is unanchored, teaching the path grammar', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'scenario-gate' }),
      ticket({ type: 'feature', phase: 'implement', anchors: [`implement: ${SHA}`] }),
      readTree,
    );
    expect(verdict.kind).toBe('unanchored');
    if (verdict.kind === 'unanchored') {
      expect(verdict.reason).toMatch(/artifact path/i);
      expect(verdict.reason).toContain('- implement:');
    }
  });
});

describe('detectUnanchoredPhaseTransition — fires only on a feature forward advance', () => {
  it('a backward phase move is not flagged', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'implement' }),
      ticket({ type: 'feature', phase: 'define-behavior' }),
      readTree,
    );
    expect(verdict.kind).toBe('not-applicable');
  });

  it('re-declaring the same phase is not flagged', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'implement' }),
      ticket({ type: 'feature', phase: 'implement' }),
      readTree,
    );
    expect(verdict.kind).toBe('not-applicable');
  });

  it.each(['task'])('a %s ticket advancing is not flagged', type => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type, phase: 'define-behavior' }),
      ticket({ type, phase: 'implement' }),
      readTree,
    );
    expect(verdict.kind).toBe('not-applicable');
  });

  it('a typeless ticket advancing is not flagged', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ phase: 'define-behavior' }),
      ticket({ phase: 'implement' }),
      readTree,
    );
    expect(verdict.kind).toBe('not-applicable');
  });

  it('a ticket becoming a feature past intake is not flagged', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'task', phase: 'implement' }),
      ticket({ type: 'feature', phase: 'implement' }),
      readTree,
    );
    expect(verdict.kind).toBe('not-applicable');
  });

  it('an edit that leaves the phase unchanged is not flagged', () => {
    const verdict = detectUnanchoredPhaseTransition(
      ticket({ type: 'feature', phase: 'implement' }),
      `${ticket({ type: 'feature', phase: 'implement' })}\nan extra body line\n`,
      readTree,
    );
    expect(verdict.kind).toBe('not-applicable');
  });

  it('a creation (no prior) is not flagged — a birth is not a transition', () => {
    const verdict = detectUnanchoredPhaseTransition(
      undefined,
      ticket({ type: 'feature', phase: 'intake' }),
      readTree,
    );
    expect(verdict.kind).toBe('not-applicable');
  });
});

describe('detectUnanchoredPhaseState — at-rest variant (the check advisory)', () => {
  it('a feature past intake with a valid path anchor and no reader is anchored (format-only)', () => {
    const verdict = detectUnanchoredPhaseState(
      ticket({ type: 'feature', phase: 'implement', anchors: [`implement: ${IMPL_PLAN_PATH}`] }),
    );
    expect(verdict.kind).toBe('anchored');
  });

  it('a feature past intake with an existing shape-valid anchor and a reader is anchored', () => {
    const verdict = detectUnanchoredPhaseState(
      ticket({ type: 'feature', phase: 'implement', anchors: [`implement: ${IMPL_PLAN_PATH}`] }),
      readTree,
    );
    expect(verdict.kind).toBe('anchored');
  });

  it('a feature past intake with no phase_anchors block is unanchored — the advisory can fire', () => {
    const verdict = detectUnanchoredPhaseState(ticket({ type: 'feature', phase: 'implement' }));
    expect(verdict.kind).toBe('unanchored');
  });

  it('a feature whose anchors name only other phases is unanchored', () => {
    const verdict = detectUnanchoredPhaseState(
      ticket({ type: 'feature', phase: 'verify', anchors: [`implement: ${IMPL_PLAN_PATH}`] }),
    );
    expect(verdict.kind).toBe('unanchored');
  });

  it('a path anchor absent from the tree is unanchored under a reader', () => {
    const verdict = detectUnanchoredPhaseState(
      ticket({
        type: 'feature',
        phase: 'implement',
        anchors: [`implement: ${TICKET_DIR}/gone.md`],
      }),
      readTree,
    );
    expect(verdict.kind).toBe('unanchored');
  });

  it('a hex-shaped legacy anchor at rest is not applicable — grandfathered, never re-litigated', () => {
    const verdict = detectUnanchoredPhaseState(
      ticket({ type: 'feature', phase: 'implement', anchors: [`implement: ${SHA}`] }),
      readTree,
    );
    expect(verdict.kind).toBe('not-applicable');
  });

  it('a feature at intake is not applicable — intake is never anchored', () => {
    const verdict = detectUnanchoredPhaseState(ticket({ type: 'feature', phase: 'intake' }));
    expect(verdict.kind).toBe('not-applicable');
  });

  it('a non-feature ticket is not applicable', () => {
    const verdict = detectUnanchoredPhaseState(ticket({ type: 'task', phase: 'implement' }));
    expect(verdict.kind).toBe('not-applicable');
  });

  it('an off-enum phase is not applicable — legality is the provenance gate, not this check', () => {
    const verdict = detectUnanchoredPhaseState(ticket({ type: 'feature', phase: 'shipping' }));
    expect(verdict.kind).toBe('not-applicable');
  });

  it('a feature with no phase field is not applicable', () => {
    const verdict = detectUnanchoredPhaseState(ticket({ type: 'feature' }));
    expect(verdict.kind).toBe('not-applicable');
  });
});
