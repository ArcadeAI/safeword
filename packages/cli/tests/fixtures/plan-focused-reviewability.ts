import { createHash } from 'node:crypto';

import type { ReviewerOutput } from '../../src/review/contract.js';

export const FOCUSED_REVIEW_OBLIGATION = 'Focused decision path';
const PLAN_RUBRIC_START = '<!-- SAFEWORD:PLAN_RUBRIC_START -->';
const PLAN_RUBRIC_END = '<!-- SAFEWORD:PLAN_RUBRIC_END -->';
export const FOCUSED_REVIEW_REQUIREMENTS = [
  {
    name: 'opening architecture mental model',
    pattern: /architecture-at-a-glance mental model/u,
  },
  {
    name: 'load-bearing choice in the main review path',
    pattern: /every load-bearing choice in the main review path/u,
  },
  {
    name: 'linked supporting detail in the review path',
    pattern: /Explicitly linked supporting detail remains in that path/u,
  },
  {
    name: 'named decision consequence before linked detail',
    pattern: /plan names the decision and its consequence/u,
  },
  {
    name: 'removable execution and evidence detail',
    pattern: /step-by-step coding instructions or repeated test evidence/u,
  },
] as const;

export interface PlanReviewFixture {
  readonly plan: string;
  readonly linkedDetail?: string;
}

export function extractPackagedPlanReviewRubric(skill: string): string {
  const start = skill.indexOf(PLAN_RUBRIC_START);
  const end = skill.indexOf(PLAN_RUBRIC_END);
  if (start === -1 || end <= start) throw new Error('the packaged plan rubric is unavailable');
  return skill.slice(start + PLAN_RUBRIC_START.length, end).trim();
}

export function obligationClause(contract: string, obligation: string): string | undefined {
  return contract
    .split(/\n(?=- \*\*)/u)
    .find(candidate => candidate.startsWith(`- **${obligation}:**`))
    ?.split('\n\n', 1)[0];
}

function structuralFindings(plan: string): { severity: 'error'; message: string }[] {
  const findings: { severity: 'error'; message: string }[] = [];
  const sections = Array.from(plan.matchAll(/^## (.+)$/gmu), match => match[1]?.trim());
  if (sections[0] !== 'Architecture at a glance') {
    findings.push({
      severity: 'error',
      message: 'The main review path does not open with an architecture-at-a-glance mental model.',
    });
  }

  const architectureOffset = plan.indexOf('## Architecture at a glance');
  const firstDecisionOffset = plan.search(/^## .*Decisions?/mu);
  const reviewLead = plan.slice(0, firstDecisionOffset === -1 ? plan.length : firstDecisionOffset);
  if (/^\d+\.\s+\S+/mu.test(reviewLead)) {
    findings.push({
      severity: 'error',
      message: 'Remove step-by-step coding instructions from the focused decision path.',
    });
  }
  if ((reviewLead.match(/^Evidence:/gmu)?.length ?? 0) > 1) {
    findings.push({
      severity: 'error',
      message: 'Remove repeated test evidence from the focused decision path.',
    });
  }
  if (architectureOffset > firstDecisionOffset && firstDecisionOffset !== -1) {
    findings.push({
      severity: 'error',
      message: 'Move the architecture-at-a-glance mental model before decision detail.',
    });
  }
  return findings;
}

function decisionFindings(fixture: PlanReviewFixture): { severity: 'error'; message: string }[] {
  const linkedDetailIsInReviewPath =
    fixture.linkedDetail !== undefined && /^Supporting detail:\s+\S+$/mu.test(fixture.plan);
  const reviewPath = linkedDetailIsInReviewPath
    ? `${fixture.plan}\n${fixture.linkedDetail}`
    : fixture.plan;
  const decisionIsNamed = /^Failure[- ]posture(?: decision)?: .+$/imu.test(fixture.plan);
  const consequenceIsNamed = /^Consequence: .+$/mu.test(fixture.plan);
  const decisionDepthIsInReviewPath = /^Failure posture: .+$/mu.test(reviewPath);
  if (decisionIsNamed && consequenceIsNamed && decisionDepthIsInReviewPath) return [];
  return [
    {
      severity: 'error',
      message:
        'The load-bearing failure-posture decision and its consequence are absent from the main review path.',
    },
  ];
}

/**
 * Deterministic conformance collaborator for the semantic fixture corpus. It
 * applies one obligation to every artifact shape; it does not select a verdict
 * by scenario name or expected outcome. The headings used to model a named
 * decision, consequence, and full-depth detail are fixture protocol rather than
 * a production parser. Live semantic review remains the production judgment
 * boundary.
 */
export function reviewFocusedDecisionPath(
  contract: string,
  fixture: PlanReviewFixture,
): ReviewerOutput {
  const findings: { severity: 'error'; message: string }[] = [];
  const clause = obligationClause(contract, FOCUSED_REVIEW_OBLIGATION);
  if (clause === undefined) {
    findings.push({
      severity: 'error',
      message: `The packaged plan contract is missing the "${FOCUSED_REVIEW_OBLIGATION}" obligation.`,
    });
  } else {
    const normalizedClause = clause.replaceAll(/\s+/gu, ' ');
    for (const requirement of FOCUSED_REVIEW_REQUIREMENTS) {
      if (!requirement.pattern.test(normalizedClause)) {
        findings.push({
          severity: 'error',
          message: `The packaged plan contract is missing the focused-review requirement for ${requirement.name}.`,
        });
      }
    }
  }
  if (findings.length === 0) {
    findings.push(...structuralFindings(fixture.plan), ...decisionFindings(fixture));
  }

  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0
        ? 'The focused decision path is reviewable.'
        : 'The focused decision path needs changes.',
    findings,
  };
}
