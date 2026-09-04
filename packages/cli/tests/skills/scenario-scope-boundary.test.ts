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
 * looked. These assertions pin the two reads that close that window.
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

    expect(evidence).toContain('out_of_scope excludes');
  });
});
