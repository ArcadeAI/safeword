import {
  EXECUTION_PLAN_CONFORMANCE_CASES,
  type ExecutionPlanConformanceCase,
  type ExecutionPlanConformanceExpectation,
} from '../../src/review/execution-plan-conformance.js';

export interface SlicingAcceptanceCase extends ExecutionPlanConformanceCase {
  readonly expectation: ExecutionPlanConformanceExpectation & { readonly finding_subject?: string };
}

function replaceRequired(
  source: string,
  search: string | RegExp,
  replacement: string | ((match: string) => string),
): string {
  let found = false;
  const rewritten = source.replace(search, match => {
    found = true;
    return typeof replacement === 'string' ? replacement : replacement(match);
  });
  if (!found) throw new Error(`Missing fixture anchor: ${search}`);
  return rewritten;
}

function original(id: string): ExecutionPlanConformanceCase {
  const found = EXECUTION_PLAN_CONFORMANCE_CASES.find(candidate => candidate.id === id);
  if (found === undefined) throw new Error(`Unknown conformance case: ${id}`);
  return found;
}

// Reviewer context describes accepted product behavior, never the eval's
// expected verdict or which defect the fixture is intended to contain.
const acceptedScenarios = `Feature: Retain typed Execution Plan judgments
  Scenario: Authorized review
    Given an authorized terminal user submits an Execution Plan
    When the user invokes the packaged review command
    Then the typed judgment is returned and retained with all documented result fields
  Scenario: Compatible persisted judgments
    Given an existing stored judgment uses the prior schema
    When a package consumer validates it after upgrade
    Then it remains readable without rewriting its original bytes
  Scenario: Failure and authorization
    Given a reviewer fails or an unauthorized user invokes either gateway transport
    When the request reaches the shared authorization service and review boundary
    Then the CLI names the failure with one recovery action and persists no unauthorized result
  Scenario: Supported activation and rollback
    Given the operator toggles the accepted activation switch
    When the CLI reads the retained judgment
    Then both enabled activation and disabled rollback retain a supported response
  Scenario: Published command contract
    Given the published command example and links
    When a terminal user follows them
    Then the example returns the documented typed judgment and the links resolve
`;

const procedures = [
  [
    'data-compatibility',
    'test:schema-compatibility',
    'legacy-result',
    'an installed-package consumer validates old and new judgments against the published schema',
    'src/review/contract.ts',
    'the old judgment still validates, its stored fixture bytes are byte-identical before and after validation, and the new judgment exposes the accepted schema fields',
  ],
  [
    'behavior-boundary',
    'test:review-cli',
    'approved-plan',
    'a terminal user invokes the installed CLI review command',
    'src/review/command.ts',
    'the public response contains schema_version, dispatch_id, reviewer_agent, verdict, summary, findings, planning_destination and execution_plan_record, and reading the retained result through the installed CLI returns the identical judgment',
  ],
  [
    'plan-integrity',
    'test:execution-plan-conformance',
    'edited-plan',
    'a terminal user asks the installed CLI to authorize an edited plan',
    'src/review/command.ts',
    'the installed CLI exits 2 for the edited plan and grants no coding authority',
  ],
  [
    'failure-signals',
    'test:failure-signals',
    'reviewer-failure',
    'a terminal user reads the installed CLI failure response',
    'src/review/command.ts',
    'the installed CLI exits 2, names the failed reviewer and supplies one recovery action',
  ],
  [
    'security-boundary',
    'test:authorization-boundary',
    'denied-transports',
    'unauthorized users invoke both gateway transports through the accepted shared authorization service',
    'src/review/command.ts',
    'both transports deny the actor with a named authorization failure and one recovery action, and no result is persisted; separate per-transport checks fail the shared-service assertion',
  ],
  [
    'rollout-rollback',
    'test:rollout-rollback',
    'disabled-result',
    'an operator toggles the accepted activation switch and reads the installed CLI response',
    'src/review/rollout.ts',
    'enabled activation reads the new judgment and disabled rollback reads the unchanged legacy judgment',
  ],
  [
    'documentation-contract',
    'test:documentation-contract',
    'published-command',
    'a terminal user executes the published command example through the installed CLI',
    'docs/review-command.md',
    'the documented example returns the exact public judgment fields and all published links resolve',
  ],
] as const;

// These are acceptance fixtures, not admission evidence. Give every proof step
// an actor, fixture, edit, command and falsifiable result before leaving one field explicitly unresolved.
function withConcreteTasks(plan: string): string {
  return plan.replaceAll(
    /(### [^\n]+\n[\s\S]*?#### Tasks and tests\n\n)[\s\S]*?(?=\n### |\n## Obligation ownership)/gu,
    (_section, heading: string) => {
      const proofLine = heading.split('\n').find(line => line.startsWith('- Proof:')) ?? '';
      const tasks = procedures
        .filter(([id]) => proofLine.includes(id))
        .flatMap(([id, script, fixture, actor, edit, result], index) => [
          `RED (${id}${index === 0 ? ', highest-risk first' : ''}): add tests/${id}.test.ts and tests/fixtures/${fixture}.json defining ${actor}; assert ${result}. Run \`bun run ${script} -- --fixture ${fixture}\` before editing ${edit}; expect test runner exit 1 because that accepted assertion fails.`,
          `GREEN (${id}): implement the accepted ${id} obligation in ${edit}; rerun \`bun run ${script} -- --fixture ${fixture}\` with the same actor and fixture; expect test runner exit 0 after asserting ${result}.`,
          `REFACTOR (${id}): ${id === 'documentation-contract' ? 'remove duplicated command explanations' : 'remove duplicate validation'} in ${edit} while preserving the accepted design; rerun \`bun run ${script} -- --fixture ${fixture}\` with the same actor and fixture; expect test runner exit 0 and the same assertions.`,
        ]);
      if (tasks.length === 0) throw new Error(`No concrete procedure for ${proofLine}`);
      const numberedTasks = tasks.map((task, index) => `${index + 1}. ${task}`).join('\n');
      return `${heading}${numberedTasks}\n`;
    },
  );
}

const complete = withConcreteTasks(original('complete-slice-record').execution_plan);
const one = withConcreteTasks(original('one-coherent-change').execution_plan);
const missingFields = new Map([
  ['missing-purpose', 'Purpose'],
  ['missing-boundary', 'Boundary'],
  ['missing-prerequisites', 'Prerequisites'],
  ['missing-proof', 'Proof'],
  ['missing-completion-signal', 'Completion signal'],
]);

function missingObligationPlan(testCase: ExecutionPlanConformanceCase): string | undefined {
  if (
    testCase.id.startsWith('missing-') &&
    testCase.id.endsWith('-obligation') &&
    testCase.expectation.finding_terms?.length === 1
  ) {
    const row = `- ${testCase.expectation.finding_terms[0]}: Complete delivery\n`;
    if (!one.includes(row)) throw new Error(`Missing expected obligation owner: ${row}`);
    return one.replace(row, '');
  }
  return undefined;
}

function acceptance(testCase: ExecutionPlanConformanceCase): SlicingAcceptanceCase {
  const field = missingFields.get(testCase.id);
  if (testCase.id === 'missing-proof') {
    const withoutProof = replaceRequired(complete, /^- Proof:.*\n/mu, '');
    const plan = replaceRequired(
      withoutProof,
      /#### Tasks and tests\n[\s\S]*?(?=\n## Obligation ownership)/u,
      '#### Tasks and tests\n\n1. In src/review/contract.ts, define the accepted typed judgment fields schema_version, dispatch_id, reviewer_agent, verdict, summary, findings, planning_destination and execution_plan_record. Output: the exported judgment contract contains exactly these accepted public fields.\n2. In src/review/command.ts, serialize that judgment on the packaged CLI review response and retain the identical judgment for the existing read command; keep the accepted shared authorization service and unchanged legacy storage bytes. Output: both response and retained judgment use the accepted contract without altering authorization or compatibility.\n3. No verification procedure is assigned to this slice.\n',
    );
    return {
      ...testCase,
      execution_plan: plan,
      expectation: { ...testCase.expectation, finding_subject: 'Typed review result' },
    };
  }
  if (field !== undefined) {
    const line = complete.split('\n').find(candidate => candidate.startsWith(`- ${field}:`));
    if (line === undefined) throw new Error(`Missing baseline field: ${field}`);
    return {
      ...testCase,
      execution_plan: replaceRequired(complete, line, `- ${field}: Not specified.`),
      expectation: { ...testCase.expectation, finding_subject: 'Typed review result' },
    };
  }
  if (testCase.id === 'many-mechanical-edits') {
    const mirrors = Array.from(
      { length: 12 },
      (_unused, index) => `generated/host-${index + 1}/review-contract.ts`,
    );
    const inventory = mirrors.map(path => `- ${path}`).join('\n');
    const metadata = [
      '#### Mirror inventory',
      '',
      'Canonical source: src/review/contract.ts. Generator owner: scripts/generate-review-contract-mirrors.ts, exposed as bun run generate:review-contract-mirrors; it writes exactly these twelve paths:',
      inventory,
      '',
      'The default test:schema-compatibility command collects both legacy-result and mirror-inventory fixtures.',
      '',
    ].join('\n');
    let plan = replaceRequired(
      withConcreteTasks(testCase.execution_plan),
      /^Rationale:.*$/mu,
      'Rationale: Twelve generated mirrors and their installation deliver one canonical contract with one cohesive proof set.',
    );
    plan = replaceRequired(plan, '#### Tasks and tests', `${metadata}#### Tasks and tests`);
    plan = replaceRequired(
      plan,
      /^1\. RED.*$/mu,
      '1. RED (data-compatibility and mirrors): add tests/data-compatibility.test.ts, tests/contract-mirrors.test.ts and both tests/fixtures/legacy-result.json and tests/fixtures/mirror-inventory.json. The latter lists exactly the twelve paths above. An installed-package consumer validates old/new judgments and reads every mirror. Before editing src/review/contract.ts, run `bun run test:schema-compatibility -- --fixture legacy-result` and `bun run test:schema-compatibility -- --fixture mirror-inventory`; expect exit 1 for an unsupported judgment or a stale/missing mirror. Assert legacy stored bytes are unchanged, new fields validate, inventory length is exactly 12, every path exists, and every mirror equals the canonical bytes. Zero mirrors must fail.',
    );
    plan = replaceRequired(
      plan,
      /^2\. GREEN.*$/mu,
      '2. GREEN (data-compatibility and mirrors): implement the accepted schema in src/review/contract.ts, then run `bun run generate:review-contract-mirrors` using scripts/generate-review-contract-mirrors.ts before any installed-package consumer runs. Rerun both exact step-1 commands with their same fixtures and actor; expect exit 0, unchanged legacy bytes, supported new fields and exactly twelve existing byte-identical mirrors.',
    );
    plan = replaceRequired(
      plan,
      /^3\. REFACTOR.*$/mu,
      '3. REFACTOR (data-compatibility and mirrors): remove duplicate schema/generator logic in src/review/contract.ts and scripts/generate-review-contract-mirrors.ts, regenerate the inventory, then rerun both exact step-1 commands with the same fixtures and installed-package consumer; expect exit 0 with all assertions unchanged.',
    );
    plan = replaceRequired(
      plan,
      /^- Completion signal:.*$/mu,
      '- Completion signal: all seven named proof commands, including both schema-compatibility fixtures, exit 0 at the current revision and all twelve mirrors match the canonical source.',
    );
    return { ...testCase, execution_plan: plan };
  }
  if (testCase.id === 'reopened-authorization-decision') {
    return {
      ...testCase,
      execution_plan: replaceRequired(
        one,
        '- One shared authorization service owns permission checks for every transport.: unchanged',
        '- Each transport owns its own independent authorization checks: changed from the accepted shared-service decision.',
      ),
      expectation: { ...testCase.expectation, finding_subject: 'decision' },
    };
  }
  if (testCase.id === 'two-independent-purposes') {
    return {
      ...testCase,
      execution_plan: replaceRequired(
        one,
        /^- Purpose:.*$/mu,
        '- Purpose: Package an independently useful inert canonical contract and separately activate the public review command; each outcome can ship and be proven without the other.',
      ),
      expectation: { ...testCase.expectation, finding_subject: 'Complete delivery' },
    };
  }
  if (testCase.id === 'line-count-only-rationale') {
    return {
      ...testCase,
      execution_plan: replaceRequired(
        one,
        /^Rationale:.*$/mu,
        'Rationale: This is reviewable only because it is below 400 changed lines.',
      ),
    };
  }
  const withoutOwner = missingObligationPlan(testCase);
  if (withoutOwner !== undefined) return { ...testCase, execution_plan: withoutOwner };
  return { ...testCase, execution_plan: withConcreteTasks(testCase.execution_plan) };
}

const slicingCaseIds = new Set([
  'one-coherent-change',
  'several-ordered-changes',
  'omitted-slicing-decision',
  'complete-slice-record',
  'dismissed-applicable-work',
  'missing-purpose',
  'missing-boundary',
  'missing-prerequisites',
  'missing-proof',
  'missing-completion-signal',
  'two-independent-purposes',
  'ordered-schema-before-reader',
  'unsafe-intermediate-merge',
  'many-mechanical-edits',
  'few-files-two-outcomes',
  'line-count-only-rationale',
  'all-obligations-assigned',
  'all-decisions-unchanged',
  'missing-behavior-obligation',
  'missing-migration-obligation',
  'missing-rollout-obligation',
  'missing-rollback-obligation',
  'missing-documentation-obligation',
  'missing-affected-surface-obligation',
  'reopened-authorization-decision',
]);

export const EXECUTION_PLAN_SLICING_CASES: readonly SlicingAcceptanceCase[] = [
  {
    ...original('one-coherent-change'),
    id: 'settled-authorization-proof-repair',
    scenario: acceptedScenarios,
    execution_plan: replaceRequired(
      one,
      '{"type":"command","cwd":".","argv":["bun","run","test:authorization-boundary"]}',
      '{"type":"command","cwd":".","argv":["node","-e","process.stdout.write(\'ok\')"]}',
    ).replaceAll('bun run test:authorization-boundary', 'node -e "process.stdout.write(\'ok\')"'),
    expectation: {
      verdict: 'request_changes',
      planning_destination: 'plan-execution',
      finding_subject: 'security-boundary',
      finding_terms: ['proof', 'boundary'],
    },
  },
  ...EXECUTION_PLAN_CONFORMANCE_CASES.filter(testCase => slicingCaseIds.has(testCase.id)).map(
    testCase => ({
      ...acceptance(testCase),
      scenario: acceptedScenarios,
    }),
  ),
  {
    ...original('unresolved-authorization-decision'),
    id: 'missing-authorization-ownership',
    scenario: replaceRequired(
      acceptedScenarios,
      'shared authorization service and review boundary',
      'authorization and review boundaries',
    ),
    implementation_plan: replaceRequired(
      original('one-coherent-change').implementation_plan,
      '- One shared authorization service owns permission checks for every transport.\n',
      '',
    ),
    execution_plan: replaceRequired(
      replaceRequired(
        one,
        /^(- Boundary:.*)$/mu,
        line =>
          `${line} The authorization ownership remains undecided between a shared service and per-transport checks before this slice can be implemented.`,
      ),
      '- One shared authorization service owns permission checks for every transport.: unchanged\n',
      '',
    )
      .replaceAll('accepted shared authorization service', 'authorization boundary')
      .replaceAll('; separate per-transport checks fail the shared-service assertion', ''),
    expectation: {
      verdict: 'request_changes',
      planning_destination: 'plan-implementation',
      finding_subject: 'Complete delivery',
      finding_terms: ['authorization', 'ownership'],
    },
  },
  {
    ...original('line-count-only-rationale'),
    id: 'file-count-only-rationale',
    scenario: acceptedScenarios,
    execution_plan: replaceRequired(
      one,
      /^Rationale:.*$/mu,
      'Rationale: This is reviewable only because it changes fewer than three files.',
    ),
  },
];
