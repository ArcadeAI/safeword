import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const read = (relative: string): string => readFileSync(nodePath.join(repoRoot, relative), 'utf8');
/** Prettier reflows these files, so match against collapsed whitespace. */
const flow = (relative: string): string => read(relative).replaceAll(/\s+/gu, ' ');

/**
 * The Killer Demo was write-only: authored at intake (spec-template.md, and one
 * of intake's confirmation checkpoints) and then referenced by zero downstream
 * checks -- verify, review-spec, self-review, and audit each mentioned it not at
 * all. A ticket could go green with its Payoff never built.
 *
 * The mirror defect sat in /verify, whose Experience "Peak" lens keyed on a
 * `## Rave Moment` heading that spec-template.md never scaffolds, so the check
 * silently no-opped on every ticket.
 *
 * These pin the chain that closes both, modelled on how Surfaces already flow:
 * authored in spec.md -> tagged on a scenario -> a scenario-gate lens -> named
 * evidence at verify. Deliberately NOT added to quality.ts PHASE_EVIDENCE,
 * because Surfaces -- the closest analogue -- is absent there too.
 */

const discoverySurfaces = [
  'packages/cli/templates/skills/bdd/DISCOVERY.md',
  '.safeword/skills/bdd/DISCOVERY.md',
  '.claude/skills/bdd/DISCOVERY.md',
  'packages/cli/codex-plugin/skills/bdd/references/DISCOVERY.md',
  'plugin/skills/bdd/DISCOVERY.md',
];

const scenarioSurfaces = [
  'packages/cli/templates/skills/bdd/SCENARIOS.md',
  '.safeword/skills/bdd/SCENARIOS.md',
  '.claude/skills/bdd/SCENARIOS.md',
  'packages/cli/codex-plugin/skills/bdd/references/SCENARIOS.md',
  'plugin/skills/bdd/SCENARIOS.md',
];

const reviewSurfaces = [
  'packages/cli/templates/skills/review-spec/SKILL.md',
  '.safeword/skills/review-spec/SKILL.md',
  '.claude/skills/review-spec/SKILL.md',
  'packages/cli/codex-plugin/skills/review-spec/SKILL.md',
  'plugin/skills/review-spec/SKILL.md',
];

const verifySurfaces = [
  'packages/cli/templates/skills/verify/SKILL.md',
  '.safeword/skills/verify/SKILL.md',
  '.claude/skills/verify/SKILL.md',
  'packages/cli/codex-plugin/skills/verify/SKILL.md',
  'plugin/skills/verify/SKILL.md',
];

describe('killer demo proof chain', () => {
  it.each(discoverySurfaces)('%s makes the Payoff provable at intake', relative => {
    const content = flow(relative);

    expect(content).toContain('Write the Payoff so a scenario can prove it');
    // A child never restates the demo, and the parent contract carries only the
    // digest -- so every downstream check has to resolve it by reference.
    expect(content).toContain('resolve the demo itself from the parent `spec.md`');
  });

  it.each(scenarioSurfaces)('%s defines the @demo tag', relative => {
    const content = flow(relative);

    expect(content).toContain('### Killer Demo tag');
    expect(content).toContain('`@demo`');
    // The tag must not become a reason to author a scenario nothing needed.
    expect(content).toContain('not an extra scenario written to satisfy a tag');
    expect(content).toContain('One tag per ticket');
  });

  it.each(reviewSurfaces)('%s gates the demo at scenario-gate', relative => {
    const content = flow(relative);

    expect(content).toContain('**Killer Demo proof**');
    // Checking the tag rather than the Payoff reproduces the false-coverage
    // failure this lens exists to catch.
    expect(content).toContain('Check the scenario against the Payoff text, not against the tag');
    // Severity is deliberate: a demo is a value claim, not a correctness
    // invariant, so it should not block the gate the way a defect does.
    expect(content).toContain('**should-strengthen**, not a must-fix');
  });

  it.each(verifySurfaces)('%s walks the Payoff at verify', relative => {
    const content = flow(relative);

    expect(content).toContain('declared a `## Killer Demo` in `spec.md`');
    // The dead heading the Peak lens used to key on.
    expect(content).not.toContain('## Rave Moment');
    // A green @demo proves mechanics, not that the payoff lands.
    expect(content).toContain('never evidence the Payoff lands');
  });

  it('keeps the demo out of PHASE_EVIDENCE, matching Surfaces', () => {
    // Parity guard: Surfaces run spec -> tag -> lens -> verify evidence and are
    // deliberately absent from the per-phase evidence lines. If a future change
    // adds one of these to quality.ts, it should add the other too.
    const quality = read('packages/cli/templates/hooks/lib/quality.ts');
    const evidence = quality.slice(
      quality.indexOf('const PHASE_EVIDENCE'),
      quality.indexOf('const TDD_STEP_EVIDENCE'),
    );

    expect(evidence).not.toContain('Killer Demo');
    expect(evidence).not.toContain('@demo');
    // Match the artifact, not the word: the intake line says "failure modes
    // were surfaced", so a bare /surface/ here passes for the wrong reason.
    expect(evidence).not.toContain('@surface');
    expect(evidence).not.toContain('affected surface');
  });
});
