import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const planningSkill = readFileSync(
  nodePath.join(packageRoot, 'templates/skills/bdd/PLAN_IMPLEMENTATION.md'),
  'utf8',
).replaceAll(/\s+/gu, ' ');
const rubric = PLAN_REVIEW_RUBRIC.replaceAll(/\s+/gu, ' ');

describe('Implementation Plan repair loop', () => {
  it('makes one receipt expose the full current blocking set and its decision owners', () => {
    expect(rubric).toContain('full current set of blocking defects');
    expect(rubric).toContain('Do not stop at the first error');
    expect(rubric).toContain('accepted decision owner');
    expect(rubric).toContain('never choose the missing behavior or expand scope');
  });

  it('repairs agent-owned gaps but pauses honestly for unavailable external authority', () => {
    expect(planningSkill).toContain('Repair every blocker owned by the agent');
    expect(planningSkill).toContain('Do not invent or infer a decision reserved for the user');
    expect(planningSkill).toContain('the pending decision, the consequences of each viable choice');
    expect(planningSkill).toContain('one concrete action that resumes the loop');
    expect(planningSkill).toContain(
      'Do not stamp, approve, or advance the plan while authority is pending',
    );
  });

  it('re-reviews changed exact bytes until the current plan is clean without a retry cap', () => {
    expect(planningSkill).toContain(
      'Re-run the independent review against the corrected exact bytes',
    );
    expect(planningSkill).toContain(
      'A clean receipt for earlier bytes never approves a changed plan',
    );
    expect(planningSkill).toContain('Repeat without a fixed retry cap');
    expect(planningSkill).toContain('current exact bytes receive an approving receipt');
  });

  it('routes phase exit through the digest-bound approval command into Execution Planning', () => {
    expect(planningSkill).toContain('safeword ticket approve-plan <ticket-id>');
    expect(planningSkill).toContain('Never replace this command with conversational approval');
    expect(planningSkill).toContain('`phase: plan-execution`');
    expect(planningSkill).not.toContain('**Update frontmatter:** `phase: implement`');
  });
});
