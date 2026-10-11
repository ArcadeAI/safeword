import type { PlanningContractCase } from '../../scripts/lib/planning-contracts-eval.js';

export const scopeBoundaries = {
  'ticket-scope': 'Ticket scope: require explicit user authorization before account changes.',
  'ticket-exclusions': 'Ticket exclusions: no automatic account migration.',
  'project-non-goals': 'Project non-goals: no background account mutation.',
  'milestone-non-goals': 'Milestone non-goals: no batched account changes.',
  'parent-boundary':
    'Inherited parent boundary: each request changes one owner-authorized target account.',
} as const;

export type ScopeBoundary = keyof typeof scopeBoundaries;

export function createScopeContextCases(plan: string): PlanningContractCase[] {
  const entries = Object.entries(scopeBoundaries);
  const accepted = entries.map(([, value]) => value).join(' ');
  const truthfulPlan = plan
    .replace(
      'because it already enforces the accepted boundary',
      'because Product Planning assumes it can enforce the accepted boundary; this is an assumption, not verified evidence. The endpoint contract tests must validate owner/target binding and expiry. If they fail, return this choice to the product owner because new authorization APIs are excluded',
    )
    .replace(
      'Measurement: record authorized, denied, and failed attempts without exposing tokens.',
      'Measurement: no new attempt store or quantitative measurement is introduced. Existing ephemeral diagnostics may name the outcome but never include tokens.',
    );
  const scopedPlan = `${truthfulPlan.replace(
    'rollback disables the new endpoint',
    'rollback disables account-change handling at the existing endpoint',
  )} The existing endpoint and consent-token API remain; no new authorization API is introduced. Each request changes one owner-authorized target account only; batched account changes are excluded. Refusal and recovery: absent, expired, or mismatched consent returns a named denial without mutation; the Builder obtains valid consent and retries the same target. A transient endpoint failure returns a retryable error without mutation. Surface proof: drive the real CLI through that endpoint for authorized, denied, expired, mismatched, and transient-failure inputs, assert the visible result and account state, and verify no write is attempted before consent succeeds. Confidence limit: this wiring proof does not establish upstream consent issuance or token-provider internals.`;
  return [undefined, ...Object.keys(scopeBoundaries)].map(missing => ({
    id: missing === undefined ? 'r12-complete-scope-context' : `r12-missing-${missing}`,
    rule: 'R12',
    kind: 'plan-implementation',
    planning_phase: 'plan-implementation',
    accepted_boundary: accepted,
    reviewer_boundary:
      'Obtain ticket scope, ticket exclusions, project non-goals, milestone non-goals, and inherited parent boundaries from the supplied source files. Check completeness before approving.',
    context:
      missing === undefined
        ? 'Every structurally required role and path is supplied, and all ticket, project, milestone, and inherited parent binding contents are present.'
        : `Every structurally required role and path is supplied, but ${missing} binding content is not supplied. The reviewed plan and other scope sources do not supply authority for that omitted source.`,
    reviewed_plan: scopedPlan,
    expected_verdict: missing === undefined ? 'approve' : 'request_changes',
    allowed_finding_authority:
      missing === undefined
        ? 'All five binding sources are available and the plan conforms; scope-context completeness does not block.'
        : `Name the missing ${missing} binding content and the incomplete accepted-boundary check. Do not silently infer it from other sources or select its contents for the user.`,
    forbidden_scope_expansion:
      'Do not invent an omitted boundary or require migration, background mutation, or batching.',
  }));
}
