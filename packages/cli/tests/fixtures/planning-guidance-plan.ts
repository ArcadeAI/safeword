import {
  DELIVERY_CHECKLIST_CATEGORIES,
  type DeliveryChecklistCategory,
} from '../../src/execution-plan/delivery-checklist.js';

/** Planned proof, not executed evidence. Only the CLI variant owns CLI refusal proof. */
export function manualAuthorizationPlan(cliDenial = false): string {
  const cli = cliDenial
    ? `\nDuring that first RED, also spawn the existing bin/account-change.js with an expired token, capture exit code 2 and refusal text, and compare the account before and after. Include these denied-exit assertions before any production edit. A direct endpoint call cannot replace this subprocess proof.\n`
    : '';
  const invocation = JSON.stringify({
    type: 'command',
    cwd: '.',
    argv: ['bun', 'run', 'test', 'tests/manual-account-change.integration.test.ts'],
  });
  const obligations: Record<DeliveryChecklistCategory, string> = {
    'outcome and scope':
      'Require explicit consent for manual account changes; exclude migration and background mutation.',
    'resolved decisions':
      'Keep the existing consent-token API as authorization owner and account records as source of truth.',
    'dependency and pull-request decomposition':
      'Deliver the Manual authorization endpoint change and focused proof together in one safe pull request with no unmerged successor.',
    testing: `Prove authorized changes succeed and refusals leave the account unchanged${cliDenial ? ', including the actual CLI refusal and exit 2' : ''}.`,
    'data and compatibility':
      'Preserve existing account schema and readers; compare stored account bytes before and after every refusal.',
    'monitoring and failure signals':
      'Record authorized, denied and failed manual requests without exposing consent tokens.',
    'security and privacy':
      'Validate requester, target account and expiry before any write; refuse invalid tokens or unavailable validation without mutation.',
    'rollout and rollback':
      'Enable consent checks before accepting writes and verify disabling the manual endpoint prevents changes on rollback.',
    documentation:
      'Document manual consent, refusal and retry behavior; assert those claims match the endpoint and promise no automatic migration.',
    'ownership and human dependencies':
      'Record contributor work separately from pending product-owner copy approval and maintainer merge approval; grant neither authority.',
    'completion evidence':
      'Rerun every applicable integration assertion after the final edit; retain missing proof and pending human decisions until genuinely resolved.',
  };
  const rows = DELIVERY_CHECKLIST_CATEGORIES.map(
    (category, index) =>
      `| manual-${index + 1} | ${category} | Manual authorization: ${obligations[category]} | contributor | manual-proof | open | missing | | |`,
  );
  return `# Execution Plan

**Status:** planned

## Current and target state

The existing consent-token API already validates the requesting user, target account and expiry. The manual endpoint has not yet wired that check before writes.${cliDenial ? ' The existing CLI invokes that endpoint, but currently exits 0 on refusal; mapping refusal to exit 2 is target work, not existing proof.' : ''} The account store remains authoritative and its schema is unchanged. All work and proof below are planned, not completed or verified. Automatic migration, background mutation and new authorization APIs remain excluded.

## Pull-request slicing

Slicing decision: one_pull_request. One manual authorization outcome and its real-boundary proof form one independently reviewable change; splitting the check from its proof would leave an unsafe intermediate state.

### Slice: Manual authorization

- Purpose: require explicit consent before a manual account change.
- Boundary: the existing consent-token API, manual endpoint and its integration fixture${cliDenial ? ', including the target refusal mapping on the existing CLI' : ''}.
- Inputs: accepted manual-authorization scenarios and the accepted Implementation Plan in context.md.
- Slice prerequisites: none.
- Proof: manual-proof.
- Completion signal: after the final production, rollout or documentation edit, the integration command exits 0 and every applicable assertion below passes at the current revision. Required human decisions remain separately pending.
- Relies on unmerged successor: false.

## Startable steps

1. RED: extend tests/manual-account-change.integration.test.ts with a fixture-owned account and tokens for the wrong user, wrong account and expired consent. Invoke the real HTTP endpoint and assert refusal status 403 and a byte-identical stored account. Run bun run test tests/manual-account-change.integration.test.ts and require these denial assertions to fail because the endpoint currently writes without invoking the validator. Do not edit production first.
${cli}
2. GREEN: wire the existing validator into src/account-change.ts before the account-store write. Permit the authorized path only after validation; missing, malformed, expired or mismatched tokens and validator unavailability refuse without any write. Log authorized, denied and failed attempts without tokens. Assert valid consent changes only the requested account and every refusal leaves it unchanged.${cliDenial ? ' Map the existing endpoint refusal to CLI exit 2 without changing authorization.' : ''}
3. Add rollout/rollback assertions to the same integration fixture: enable the check before accepting writes, disable the manual endpoint on rollback, and assert refused requests cannot bypass the validator during either transition. Storage compatibility asserts existing account readers remain unchanged; there is no data migration.
4. Update the existing manual-authorization documentation with the accepted consent requirement, refusal/retry behavior and pending human decisions. The fixture reads that document and asserts those claims match the endpoint responses and no automatic migration or background mutation is promised.
5. Run bun run test tests/manual-account-change.integration.test.ts after the last edit. Require exit 0 for the valid, refusal, no-write, logging, compatibility, rollout/rollback and documentation assertions${cliDenial ? ', plus the real denied CLI subprocess and exit-code assertions' : ''}. Repeat the whole command after any later edit; a previous pass cannot complete delivery.

## Accepted decisions and owners

The existing consent-token API remains the authorization owner; account records remain the source of truth. Both accepted decisions are unchanged. The contributor owns endpoint wiring, fixtures, logging, compatibility, rollout/rollback, documentation and current proof. There are no additional load-bearing choices. Product-owner approval of final copy and maintainer merge approval remain human dependencies; contributor proof grants neither. Delivery remains incomplete while a required human decision is pending.

## Proof specifications

| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |
| --- | --- | --- | --- | --- | --- | --- |
| manual-proof | command | integration | real HTTP endpoint, account store, validator failure, logging, rollout/rollback and documentation${cliDenial ? ', plus the actual denied CLI subprocess' : ''} | real_boundary | current_required | ${invocation} |

## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`;
}
