import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { SCENARIO_REVIEW_RUBRIC } from '../../src/review/scenario-rubric.generated.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const read = (relative: string): string => readFileSync(nodePath.join(repoRoot, relative), 'utf8');

/**
 * `out_of_scope` used to be write-only between intake and `/verify`: the phase
 * gate required the field to exist before test-definitions.md could be created,
 * `/self-review` checked the spec's Rules against it, and `/verify` checked the
 * final diff against it — but nothing in between read it. Scenario authoring
 * derived dimensions from `scope` alone and the review gate's cross-cutting
 * lenses all asked "what's missing?", so behavior the ticket had explicitly
 * excluded entered at the scenario layer and was built by TDD before anything
 * looked. These assertions pin the three reads that close that window --
 * authoring, the review gate, and the define-behavior evidence line -- plus the
 * context plumbing the gate's read depends on.
 */

const reviewSurfaces = [
  'packages/cli/templates/skills/review-spec/SKILL.md',
  '.safeword/skills/review-spec/SKILL.md',
  '.claude/skills/review-spec/SKILL.md',
  'packages/cli/codex-plugin/skills/review-spec/SKILL.md',
  'plugin/skills/review-spec/SKILL.md',
];

const authoringSurfaces = [
  'packages/cli/templates/skills/bdd/SCENARIOS.md',
  '.safeword/skills/bdd/SCENARIOS.md',
  '.claude/skills/bdd/SCENARIOS.md',
  'packages/cli/codex-plugin/skills/bdd/references/SCENARIOS.md',
  'plugin/skills/bdd/SCENARIOS.md',
];

describe('scenario scope boundary', () => {
  it.each(reviewSurfaces)('%s carries the scope-boundary lens', relative => {
    const content = read(relative);

    expect(content).toContain('**Scope boundary**');
    expect(content).toContain('`out_of_scope`');
    // The lens exists because Rule lineage does not settle scope: a Rule states
    // its invariant generally, so a scenario can prove a real Rule and still
    // assert an excluded outcome. Without this half the lens collapses back
    // into step 4's existing "does it map to a criterion?" check.
    expect(content).toContain('states its invariant generally');
    // Deleting the scenario is the author's call via `out_of_scope`; a reviewer
    // that can widen scope by approving is the failure mode being prevented.
    expect(content).toContain('never the reviewer');
  });

  it.each(reviewSurfaces)('%s hands the reviewer the file out_of_scope lives in', relative => {
    const content = read(relative);

    // `out_of_scope` is ticket.md frontmatter; the packet only requires spec.md
    // (packet.ts requireScenarioTicketSpec), which carries project and
    // milestone non-goals but never `out_of_scope`. Without ticket.md in the
    // context list the lens reads as enforced while the headless reviewer
    // cannot see the field it names — it would pass the exact crossing the
    // lens was added to catch.
    expect(content).toContain('--context ticket-spec ticket-file');
    expect(content).toContain('cannot see `out_of_scope`');
    // A missing ticket.md must degrade loudly; a silent fallback to spec.md
    // reproduces the same false-clean verdict.
    expect(content).toContain('If `ticket.md` was not supplied');
  });

  it.each(authoringSurfaces)('%s bounds dimension derivation by out_of_scope', relative => {
    const content = read(relative);

    // Derivation must read the exclusions in the same pass as `scope`; reading
    // them later means the out-of-scope partition is already a scenario.
    expect(content).toContain('out_of_scope');
    expect(content).toContain("milestone's Non-goals");
    expect(content).toContain('before partitioning');
    // The user-facing completeness question asked only about gaps, so an
    // overshoot had no turn at which it could surface.
    expect(content).toContain('go past what we agreed not to build');
  });

  it('ships the scope-boundary lens to the headless reviewer', () => {
    // The generated rubric is what the independent reviewer actually receives;
    // an edit that never regenerates leaves the gate running the old lens set.
    expect(SCENARIO_REVIEW_RUBRIC).toContain('**Scope boundary**');
  });

  it('records the scope check in the define-behavior evidence line', () => {
    // The stop hook's phase evidence is the third read: it makes the agent
    // state the boundary held before it can claim CONFIDENT at define-behavior.
    const content = read('packages/cli/templates/hooks/lib/quality.ts');
    const evidence = /'Phase: define-behavior\.[^']*'/.exec(content)?.[0];

    // Name the whole edge, not just out_of_scope: review-spec's Scope boundary
    // lens judges against the project and milestone non-goals too, so evidence
    // citing only out_of_scope would let define-behavior claim CONFIDENT on a
    // narrower check than the gate applies.
    expect(evidence).toContain('the scope edge excludes');
    expect(evidence).toContain('out_of_scope');
    expect(evidence).toContain('project and milestone non-goals');
  });
});
