import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const read = (relative: string): string => readFileSync(nodePath.join(repoRoot, relative), 'utf8');

/**
 * A user speccing a real toolkit reported saying yes 10-15 times through intake,
 * then telling the agent to stop asking and burning their token budget. The
 * count was not drift: the sub-phase gate rule said "for each meaningful unit,
 * present the artifact, ask one closing question, and wait", and with several
 * jobs and several milestones that produced a confirmation per item. They also
 * had no way to know when to hand the work over, and nothing capped how many
 * Rules and scenarios got generated.
 *
 * The fix keeps the collaboration they valued and cuts the rubber-stamping:
 * confirm per artifact rather than per item, give the volume checks a real
 * criterion, and say where to start.
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

const orchestratorSurfaces = ['packages/cli/templates/SAFEWORD.md', '.safeword/SAFEWORD.md'];

describe('intake ergonomics', () => {
  it.each(discoverySurfaces)('%s confirms per artifact, not per item', relative => {
    const content = read(relative);

    // The load-bearing correction: the old rule's "each meaningful unit" was
    // read as each job and each milestone, which is where the 10-15 came from.
    expect(content).toContain('Confirm once per artifact, not once per item');
    expect(content).toContain('four checkpoints');
    // Naming the anti-pattern matters more than the count — an agent that
    // walks milestones one at a time is doing the thing being corrected.
    expect(content).toContain('one at a time collecting a yes for each');
    // A self-check the agent can apply mid-phase, when it is about to over-ask.
    expect(content).toContain('fifth confirmation');
  });

  it.each(discoverySurfaces)('%s bounds how many Rules get written', relative => {
    const content = read(relative);

    expect(content).toContain('fewest Rules that make the job decidable');
    // The criterion is qualitative on purpose: a numeric ceiling would be
    // arbitrary across domains, while independent-failure is checkable.
    expect(content).toContain('could fail on its own and a user would');
    expect(content).toContain('Merge Rules that always pass or fail together');
  });

  it.each(scenarioSurfaces)('%s gives the card-ratio check a real criterion', relative => {
    const content = read(relative);

    // "too many rules?" alone had no answer, so nothing pushed toward fewer.
    expect(content).toContain('would dropping this scenario let a real defect ship');
    expect(content).toContain('they are one scenario with a better name');
  });

  it.each(orchestratorSurfaces)('%s tells the user where to start', relative => {
    const content = read(relative);

    expect(content).toContain('**Say where to start.**');
    // Both handoff points are legitimate; the failure was not knowing that.
    expect(content).toContain('raw area');
    expect(content).toContain('already-scoped set of jobs');
    // Orientation, not another gate — otherwise this fix adds a confirmation
    // to the very flow it is trying to shorten.
    expect(content).toContain('this is orientation, not a gate');
  });
});
