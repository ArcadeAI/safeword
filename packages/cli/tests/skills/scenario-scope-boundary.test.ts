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
    expect(content).toContain('[parent-spec]');
    expect(content).toContain('cannot see `out_of_scope`');
    // A missing ticket.md must degrade loudly; a silent fallback to spec.md
    // reproduces the same false-clean verdict.
    expect(content).toContain('when `ticket.md` was not supplied');
    expect(content).toContain('report the inherited project and milestone boundaries as unchecked');
    expect(content).toContain(
      'report `out_of_scope` as unchecked and require re-dispatch with the missing context',
    );
  });

  it.each(authoringSurfaces)('%s bounds dimension derivation by out_of_scope', relative => {
    const content = read(relative);

    // Derivation must read the exclusions in the same pass as `scope`; reading
    // them later means the out-of-scope partition is already a scenario.
    expect(content).toContain('out_of_scope');
    expect(content).toContain("Product Bet's project non-goals");
    expect(content).toContain("milestone's Non-goals");
    expect(content).toContain('inherited project and milestone non-goals remain part of the edge');
    expect(content).not.toContain('`out_of_scope` is the whole edge');
    expect(content).toContain('before partitioning');
    // The user-facing completeness question asked only about gaps, so an
    // overshoot had no turn at which it could surface.
    expect(content).toContain('go past what we agreed not to build');
  });

  it.each(authoringSurfaces)('%s does not turn review advice into new scope', relative => {
    const content = read(relative);

    expect(content).toContain(
      'Apply only **Must Fix** findings that name a concrete false pass against an accepted Rule or dimension partition',
    );
    expect(content).toContain(
      '**Should Strengthen** findings are non-blocking and change scenarios only when the user asks',
    );
    expect(content).toContain('says an existing scenario crosses the accepted scope edge');
    expect(content).toContain('return it to the user as a scope decision');
    expect(content).toContain(
      'record that disposition and re-run independent review against the unchanged accepted scope',
    );
    expect(content).toContain('including vacuous-pass and AODI failures');
    expect(content).toContain(
      'If a Must Fix names missing review context, re-dispatch with that file before judging the scenarios',
    );
    // An edit still costs the stamp and still re-runs the gate. What changed
    // (#4701) is the re-run's SCOPE: the generative lenses run once per accepted
    // scope, so repairing a finding cannot regenerate the scope that produced it.
    expect(content).toContain('A scenario edit invalidates the review stamp, so the gate re-runs');
    expect(content).toContain("the re-run's scope is the edit, not a fresh expansion");
    expect(content).toContain('run once per accepted scope');
    expect(content).toContain('Let severity end the loop, not patience');
  });

  it.each(authoringSurfaces)('%s gives the scenario gate a termination condition', relative => {
    const content = read(relative);

    // #4701: the gate re-reviewed prose with nothing that could end it. No pass
    // could return a negative — every one had something to say, and each edit
    // gave the next pass fresh wording to question — so it ran for seventeen
    // rounds until a human stopped it by hand. These two rules are what made it
    // unbounded; asserting only the replacements would still pass if one were
    // re-added alongside them, leaving the contract self-contradictory.
    expect(content).not.toContain(
      'Any scenario edit — including a user-requested Should Strengthen',
    );
    expect(content).not.toContain(
      'If the adversarial pass or user feedback produced new scenarios',
    );

    // Severity ends the loop, not patience: should-strengthen never holds it open.
    expect(content).toContain('A re-run with no Must Fix is clean even when Should Strengthen');
    expect(content).toContain('two consecutive re-runs return only Should Strengthen');

    // Only a user-owned scope change re-opens define-behavior. A scenario the
    // reviewer proposed inside accepted scope must not restart the generative pass.
    expect(content).toContain('If the **user** adds behavior or amends `out_of_scope`');
    expect(content).toContain('is a scenario edit, not a scope change');

    // The exit needs a check that can come back empty. Both commands are named:
    // lint-gherkin alone passes a feature whose scenario carries no lineage tag,
    // and doctor is what catches that.
    expect(content).toContain('safeword project lint-gherkin');
    expect(content).toContain('safeword doctor');
  });

  it.each(authoringSurfaces)('%s demonstrates both halves of the scope check', relative => {
    const content = read(relative);

    expect(content).toContain(
      'a new conflict warning goes past the agreed behavior, so I dropped it',
    );
    expect(content).toContain('Does any scenario go past what we agreed not to build?');
    expect(content).toContain('nothing is missing and no scenario crosses the agreed scope edge');
  });

  it.each(authoringSurfaces)('%s does not reconfirm unchanged reviewed scenarios', relative => {
    const content = read(relative);

    expect(content).toContain(
      "If review is clean and the scenarios are unchanged, keep the user's earlier confirmation; do not ask again",
    );
  });

  it('ships the scope-boundary lens to the headless reviewer', () => {
    // The generated rubric is what the independent reviewer actually receives;
    // an edit that never regenerates leaves the gate running the old lens set.
    expect(SCENARIO_REVIEW_RUBRIC).toContain('**Scope boundary**');
    expect(SCENARIO_REVIEW_RUBRIC).toContain(
      'report the inherited project and milestone boundaries as unchecked',
    );
    expect(SCENARIO_REVIEW_RUBRIC).toContain('report `out_of_scope` as unchecked');
    expect(SCENARIO_REVIEW_RUBRIC).toContain(
      'A nonblank value such as `none` deliberately declares no ticket-specific exclusions and is readable',
    );
  });

  it('records the scope check in the define-behavior evidence line', () => {
    // The stop hook's phase evidence is the third read: it makes the agent
    // state the boundary held before it can claim CONFIDENT at define-behavior.
    const content = read('packages/cli/templates/hooks/lib/quality.ts');
    const evidence = content.match(/'Phase: define-behavior\.[^']*'/g) ?? [];

    // Name the whole edge, not just out_of_scope: review-spec's Scope boundary
    // lens judges against the project and milestone non-goals too, so evidence
    // citing only out_of_scope would let define-behavior claim CONFIDENT on a
    // narrower check than the gate applies.
    expect(evidence.length).toBeGreaterThan(0);
    for (const line of evidence) {
      expect(line).toContain('the scope edge excludes');
      expect(line).toContain('out_of_scope');
      expect(line).toContain('project and milestone non-goals');
    }
  });
});
