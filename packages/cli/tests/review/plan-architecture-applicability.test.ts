import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';

const ARCHITECTURE_OBLIGATION = 'Principles and architecture';
const ARCHITECTURE_REQUIREMENTS = [
  {
    name: 'explicit applicability',
    pattern: /Require Architecture applicability to\s+state/u,
  },
  {
    name: 'concrete consequence',
    pattern: /concrete component or shared-contract consequence/u,
  },
  {
    name: 'justified non-applicability',
    pattern: /`skip: <reason>`/u,
  },
  {
    name: 'missing or bare skip rejection',
    pattern: /Block both a missing\s+applicability statement\s+and a bare `skip:`/u,
  },
] as const;

function obligationClause(contract: string, obligation: string): string | undefined {
  return contract
    .split(/\n(?=- \*\*)/u)
    .find(candidate => candidate.startsWith(`- **${obligation}:**`))
    ?.split('\n\n', 1)[0];
}

function architectureFindings(plan: string): { severity: 'error'; message: string }[] {
  if (/^Architecture consequence:\s+\S.+$/mu.test(plan)) return [];

  const prefix = 'Architecture applicability:';
  const applicability = plan
    .split('\n')
    .find(line => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
  if (applicability === undefined) {
    return [
      {
        severity: 'error',
        message: 'Architecture applicability is missing; record a consequence or a justified skip.',
      },
    ];
  }
  if (/^skip:\s*$/u.test(applicability)) {
    return [
      {
        severity: 'error',
        message: 'Architecture applicability has a bare skip with no reason.',
      },
    ];
  }
  return /^skip:\s+\S.+$/u.test(applicability)
    ? []
    : [
        {
          severity: 'error',
          message: 'Architecture applicability must record a concrete consequence or skip reason.',
        },
      ];
}

function reviewArchitectureApplicability(contract: string, plan: string): ReviewerOutput {
  const findings: { severity: 'error'; message: string }[] = [];
  const clause = obligationClause(contract, ARCHITECTURE_OBLIGATION);
  if (clause === undefined) {
    findings.push({
      severity: 'error',
      message: `The packaged plan contract is missing the "${ARCHITECTURE_OBLIGATION}" obligation.`,
    });
  } else {
    for (const requirement of ARCHITECTURE_REQUIREMENTS) {
      if (!requirement.pattern.test(clause)) {
        findings.push({
          severity: 'error',
          message: `The packaged plan contract is missing the architecture-applicability requirement for ${requirement.name}.`,
        });
      }
    }
  }
  if (findings.length === 0) findings.push(...architectureFindings(plan));

  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0
        ? 'Architecture applicability is explicit.'
        : 'Architecture applicability needs changes.',
    findings,
  };
}

const ARCHITECTURE_CLAUSE_FIXTURE = `- **Principles and architecture:** Using the supplied configured principles file,
  challenge whether the plan identified the actually applicable project
  principles. For each one, verify that the concrete consequence follows and
  that the named proof can establish it. Confirm relevant architecture records
  are honored, and that significant structural or hard-to-reverse changes get
  an ADR while routine choices do not. Require Architecture applicability to state
  either a concrete component or shared-contract consequence, or a justified
  \`skip: <reason>\` when neither applies. Block both a missing applicability statement
  and a bare \`skip:\` with no reason.`;

function contractWithArchitectureFixture(): string {
  const existing = obligationClause(PLAN_REVIEW_RUBRIC, ARCHITECTURE_OBLIGATION);
  if (existing === undefined) return `${PLAN_REVIEW_RUBRIC}\n${ARCHITECTURE_CLAUSE_FIXTURE}`;
  if (ARCHITECTURE_REQUIREMENTS.every(requirement => requirement.pattern.test(existing))) {
    return PLAN_REVIEW_RUBRIC;
  }
  const offset = PLAN_REVIEW_RUBRIC.indexOf(existing);
  return `${PLAN_REVIEW_RUBRIC.slice(0, offset)}${ARCHITECTURE_CLAUSE_FIXTURE}${PLAN_REVIEW_RUBRIC.slice(offset + existing.length)}`;
}

describe('Implementation Plan architecture applicability contract', () => {
  it.each([
    {
      name: 'rejects an omitted architecture applicability statement',
      plan: '# Implementation Plan\n\n## Design alignment\n\nNo project principles apply.\n',
      verdict: 'request_changes',
      finding: 'Architecture applicability is missing',
    },
    {
      name: 'rejects a bare architecture applicability skip',
      plan: '# Implementation Plan\n\nArchitecture applicability: skip:\n',
      verdict: 'request_changes',
      finding: 'bare skip with no reason',
    },
    {
      name: 'accepts a justified architecture applicability skip',
      plan: '# Implementation Plan\n\nArchitecture applicability: skip: no component or shared-contract boundary changes\n',
      verdict: 'approve',
    },
    {
      name: 'accepts a concrete architecture consequence',
      plan: '# Implementation Plan\n\nArchitecture consequence: the gateway and worker share one authorization boundary.\n',
      verdict: 'approve',
    },
  ])('$name', ({ finding, plan, verdict }) => {
    const result = reviewArchitectureApplicability(PLAN_REVIEW_RUBRIC, plan);
    const contractFailures = result.findings.filter(candidate =>
      candidate.message.startsWith('The packaged plan contract is missing'),
    );
    expect(
      contractFailures,
      'The packaged contract is missing the architecture-applicability requirement.',
    ).toEqual([]);
    expect(result.verdict).toBe(verdict);
    if (finding !== undefined) {
      expect(result.findings.some(candidate => candidate.message.includes(finding))).toBe(true);
    }
  });

  it('fails closed when the architecture obligation is removed', () => {
    const contract = contractWithArchitectureFixture();
    const clause = obligationClause(contract, ARCHITECTURE_OBLIGATION) ?? '';
    const offset = contract.indexOf(clause);
    const mutated = `${contract.slice(0, offset)}${contract.slice(offset + clause.length)}`;

    const result = reviewArchitectureApplicability(
      mutated,
      'Architecture applicability: skip: no impact',
    );

    expect(result.verdict).toBe('request_changes');
    expect(result.findings).toEqual([
      expect.objectContaining({ message: expect.stringContaining(ARCHITECTURE_OBLIGATION) }),
    ]);
  });

  it.each(ARCHITECTURE_REQUIREMENTS)('fails closed when the contract drops $name', requirement => {
    const contract = contractWithArchitectureFixture();
    const clause = obligationClause(contract, ARCHITECTURE_OBLIGATION) ?? '';
    const offset = contract.indexOf(clause);
    const mutatedClause = clause.replace(requirement.pattern, '');
    const mutated = `${contract.slice(0, offset)}${mutatedClause}${contract.slice(offset + clause.length)}`;

    const result = reviewArchitectureApplicability(
      mutated,
      'Architecture applicability: skip: no component boundary changes',
    );

    expect(result.verdict).toBe('request_changes');
    expect(result.findings).toEqual([
      expect.objectContaining({ message: expect.stringContaining(requirement.name) }),
    ]);
  });
});
