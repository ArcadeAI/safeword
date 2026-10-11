import type { PlanningContractCase } from '../../scripts/lib/planning-contracts-eval.js';

const outcomes = [
  {
    name: 'Success, explicit approval and trust',
    given: 'the Builder explicitly approved one change to their own account with current consent',
    when: 'the Builder submits that manual change through the CLI',
    result:
      'the account has the requested value and the receipt names that consenting owner without exposing the consent token',
  },
  {
    name: 'Refusal',
    given: 'the Builder declined consent for a requested account change',
    when: 'the Builder submits that manual change through the CLI',
    result: 'the CLI reports consent refused and the account retains its original value',
  },
  {
    name: 'Failure',
    given: 'the Builder has valid consent but the account endpoint has a transient failure',
    when: 'the Builder submits that manual change through the CLI',
    result: 'the CLI reports a retryable endpoint error and the account retains its original value',
  },
  {
    name: 'Recovery',
    given:
      'the Builder has an unchanged pending request rejected for expired consent and now has fresh owner consent',
    when: 'the Builder retries that same target change through the CLI',
    result: 'the pending change succeeds once on the original target account',
  },
];

export function createPersonaCoverageCases(productInventory: string): PlanningContractCase[] {
  return [false, true].map(missingRecovery => {
    const reviewedPlan = ['Technical Builder', 'Non-Technical Builder']
      .map((persona, index) => {
        const rule = `account.${index === 0 ? 'TB' : 'NTB'}1.R1`;
        return `  @${rule} @surface.account-cli
  Rule: ${rule} — Give ${persona} a safe manual change and recovery
${outcomes
  .filter(outcome => !(missingRecovery && index === 1 && outcome.name === 'Recovery'))
  .map(
    outcome => `    Scenario: ${persona} ${outcome.name}
      Given ${outcome.given.replaceAll('the Builder', () => `the ${persona}`)}
      When ${outcome.when.replaceAll('the Builder', () => `the ${persona}`)}
      Then ${outcome.result}
`,
  )
  .join('\n')}`;
      })
      .join('\n');
    const id = missingRecovery ? 'r16-scenario-missing-recovery' : 'r16-scenario-complete-coverage';
    return {
      id,
      rule: 'R16',
      kind: 'scenario-gate',
      planning_phase: undefined,
      accepted_boundary:
        'Manual owner-authorized account changes for Technical Builder and Non-Technical Builder. No automatic migration, background mutation, batched account changes or token disclosure. Each accepted persona has success, refusal, failure, explicit approval, trust and recovery outcomes.',
      context: JSON.stringify({
        ticket: {
          scope: 'manual owner-authorized account changes for both named personas',
          out_of_scope: 'automatic migration, background mutation, batching and token disclosure',
        },
        approved_product_plan: `${productInventory}\nRules: account.TB1.R1 and account.NTB1.R1 each require the named persona's manual consent, owner-named approval receipt, no mutation on refusal or failure, and recovery by retrying the same pending target after fresh consent. Project non-goals: automatic migration, background mutation, batching and token disclosure. No parent or inherited boundary applies.`,
        personas: ['Technical Builder', 'Non-Technical Builder'],
        surfaces: { 'account-cli': 'existing manual account-change CLI' },
        dimensions:
          'Representative consent refusal, transient failure and expired-consent recovery are accepted behavior partitions. Schema/consent-token permutations are assigned to the planned consent-token contract matrix. Accepted scenario tests will invoke the public CLI with real configuration and the existing account endpoint; no injected authorization internals. No current execution or shipping claim is made.',
      }),
      reviewed_plan: `Feature: Safe manual changes for both accepted personas\n\n${reviewedPlan}`,
      expected_verdict: missingRecovery ? 'request_changes' : 'approve',
      allowed_finding_authority: missingRecovery
        ? 'Name the uncovered Non-Technical Builder recovery outcome. The approved Product Plan already contains it; this is missing scenario coverage, not a missing Product or Implementation Plan decision.'
        : 'Every applicable persona outcome has a concrete accepted scenario. The authorized-change receipt proves success, explicit approval and trust together; do not demand duplicate scenarios for those same observable facts.',
      forbidden_scope_expansion:
        'Do not add migration, background mutation, batching, token disclosure or implementation-design requirements. Judge scenario coverage against the approved Product Plan only.',
    };
  });
}
