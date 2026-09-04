import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const read = (path: string): string => readFileSync(nodePath.join(repoRoot, path), 'utf8');

describe('shared scenario-quality contract', () => {
  it('loads review-spec Authoring mode before the define-behavior pipeline drafts scenarios', () => {
    const scenarios = read('packages/cli/templates/skills/bdd/SCENARIOS.md');
    const reviewSpec = read('packages/cli/templates/skills/review-spec/SKILL.md');

    expect(reviewSpec).toContain('## Authoring mode');
    expect(reviewSpec).toContain('## Review mode');
    expect(reviewSpec).toContain('Do not launch the independent review coordinator');
    expect(reviewSpec.match(/SAFEWORD:SCENARIO_RUBRIC_START/gu) ?? []).toHaveLength(1);
    expect(reviewSpec.match(/SAFEWORD:SCENARIO_RUBRIC_END/gu) ?? []).toHaveLength(1);
    expect(scenarios.match(/Load `review-spec` in Authoring mode/gu) ?? []).toHaveLength(1);
    expect(scenarios).not.toContain('### Scenario construction rules');
    const authoringIndex = scenarios.indexOf('Load `review-spec` in Authoring mode');
    const generationIndex = scenarios.indexOf('**Generate scenarios**');
    expect(authoringIndex).toBeGreaterThanOrEqual(0);
    expect(generationIndex).toBeGreaterThanOrEqual(0);
    expect(authoringIndex).toBeLessThan(generationIndex);
  });

  it('documents one feature target and current project knowledge as context', () => {
    const reviewSpec = read('packages/cli/templates/skills/review-spec/SKILL.md');

    expect(reviewSpec).toContain(
      'review run scenario-gate feature-file [legacy-test-definitions] --context ticket-spec ticket-file [dimensions-file] principles-file personas-file surfaces-file',
    );
    expect(reviewSpec.toLowerCase().replaceAll(/\s+/gu, ' ')).toContain(
      'omit optional paths that do not exist',
    );
  });

  it('keeps the coordinator protocol out of the BDD orchestrator', () => {
    const bdd = read('packages/cli/templates/skills/bdd/SKILL.md');
    expect(bdd).not.toContain('review run scenario-gate');
    expect(bdd).toContain('`review-spec` in Review mode');
  });
});
