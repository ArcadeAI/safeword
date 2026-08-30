import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { After, AfterAll, Given, Then, When } from '@cucumber/cucumber';
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';

import { generateClaudePluginAssets } from '../../src/claude-plugin/catalogue.js';
import {
  type CliResult,
  createResult,
  exitStatusFor,
  renderHumanResult,
  renderJsonResult,
} from '../../src/cli-protocol/result.js';
import { generateCodexPluginAssets } from '../../src/codex-plugin/catalogue.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';

interface CliExecution {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface CliFixture {
  directory: string;
  bin: string;
}

type ReviewContractName = 'finish-review' | 'quality-review';

interface ReviewWorld {
  reviewResult?: CliResult;
  originalData?: unknown;
  human?: string;
  verbose?: string;
  json?: string;
  distributedContract?: ReviewContractName;
  distributionFacet?: string;
  jsonBeforeHuman?: string;
  cliFixtureReady?: boolean;
  singleCliMode?: { name: string; result: CliExecution };
  realPresentation?: {
    coverage: string;
    verdict: string;
    mode: string;
    result: CliExecution;
  };
  requiredOutcome?: { name: string; result: CliExecution };
  blockedMode?: { name: string; result: CliExecution };
  originalRecovery?: unknown;
}

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const execFileAsync = promisify(execFile);
const fixtureControlVariables = new Set([
  'SAFEWORD_REVIEW_PROGRESS',
  'SAFEWORD_REVIEW_COVERAGE_FAIL',
  'SAFEWORD_REVIEW_COVERAGE_FAIL_CLAUDE',
  'SAFEWORD_REVIEW_COVERAGE_FAIL_CODEX',
  'SAFEWORD_REVIEW_COVERAGE_VERDICT',
  'SAFEWORD_REVIEW_COVERAGE_FINDING',
  'SAFEWORD_REVIEW_ALTERNATE_MODEL_CLAUDE',
  'SAFEWORD_REVIEW_ALTERNATE_MODEL_CODEX',
]);
const CHANGE_REQUEST_VERDICT = 'request_changes';
const CHANGE_REQUEST_FINDING = 'Needs work.';
const REAL_CLI_PROCESS_TIMEOUT_MS = 15_000;
const REAL_CLI_STEP_TIMEOUT_MS = 20_000;
const fixtureDirectories = new Set<string>();
const trustedFixtureRoot = repoRoot;
const ownedFixtureMarker = '.safeword-test-fixture';

function cleanupFixtureDirectories(): void {
  for (const directory of fixtureDirectories) rmSync(directory, { force: true, recursive: true });
  fixtureDirectories.clear();
}

process.once('exit', cleanupFixtureDirectories);
After(cleanupFixtureDirectories);
AfterAll(cleanupFixtureDirectories);

function createFixtureDirectory(prefix: string): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), prefix));
  fixtureDirectories.add(directory);
  return directory;
}

function createTrustedFixtureDirectory(prefix: string): string {
  // Reviewer discovery rejects executables outside the trusted project tree,
  // so these PATH stubs must live under cwd and be removed after each scenario.
  const directory = mkdtempSync(nodePath.join(trustedFixtureRoot, `.${prefix}`));
  writeFileSync(nodePath.join(directory, ownedFixtureMarker), 'owned by cucumber\n');
  fixtureDirectories.add(directory);
  return directory;
}

function sanitizedFixtureEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !fixtureControlVariables.has(name)),
  );
}

function changeRequestEnvironment(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    SAFEWORD_REVIEW_COVERAGE_FINDING: CHANGE_REQUEST_FINDING,
    SAFEWORD_REVIEW_COVERAGE_VERDICT: CHANGE_REQUEST_VERDICT,
    ...overrides,
  };
}

function optionalValue(value: string): string | undefined {
  return value === 'absent' ? undefined : value;
}

function definedFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function reviewerOutputField(
  output: string | undefined,
  reviewerAgent: string | undefined,
): Record<string, unknown> {
  if (output === undefined) return {};
  if (output === 'missing-verdict') {
    return {
      reviewer_output: definedFields({
        reviewer_agent: reviewerAgent,
        summary: 'Checked.',
        findings: [],
      }),
    };
  }
  return {
    reviewer_output: definedFields({
      reviewer_agent: reviewerAgent,
      ...(output === 'malformed'
        ? { verdict: 'looks_good' }
        : { verdict: output, summary: 'Checked.', findings: [] }),
    }),
  };
}

function makeReviewResult({
  status,
  author = 'codex',
  reviewer = 'codex',
  independence = 'degraded',
  verdict = 'approve',
  assignedReviewer,
  preferredFailure,
  policy,
  reviewerOutput = verdict,
  reviewerOutputAgent = reviewer,
  state,
}: {
  status: string;
  author?: string;
  reviewer?: string;
  independence?: string;
  verdict?: string;
  assignedReviewer?: string;
  preferredFailure?: string;
  policy?: string;
  reviewerOutput?: string;
  reviewerOutputAgent?: string;
  state?: string;
}): CliResult {
  const actualReviewer = optionalValue(reviewer);
  const output = optionalValue(reviewerOutput);
  const outputAgent = optionalValue(reviewerOutputAgent);
  const data = {
    command: 'review run',
    ...definedFields({ status: optionalValue(status) }),
    author_agent: author,
    independence,
    ...definedFields({
      actual_reviewer: actualReviewer,
      assigned_reviewer: assignedReviewer,
      preferred_failure: preferredFailure,
      review_policy: policy,
    }),
    ...reviewerOutputField(output, outputAgent),
  };
  return createResult({
    state: (state ?? (status === 'approved' ? 'healthy' : 'action_required')) as CliResult['state'],
    data,
  });
}

Given(
  'a {word} review authored by {word} and completed by {word} with {word} independence and {word} verdict',
  // eslint-disable-next-line max-params -- Cucumber validates callback arity against five expression parameters.
  function (
    this: ReviewWorld,
    status: string,
    author: string,
    reviewer: string,
    independence: string,
    verdict: string,
  ) {
    this.reviewResult = makeReviewResult({ status, author, reviewer, independence, verdict });
    this.originalData = structuredClone(this.reviewResult.data);
  },
);

Given(
  'a {word} {word}-authored review has {word}, actual reviewer {word}, and {word} independence',
  // eslint-disable-next-line max-params -- Cucumber validates callback arity against five expression parameters plus World.
  function (
    this: ReviewWorld,
    status: string,
    author: string,
    reviewerOutput: string,
    reviewer: string,
    independence: string,
  ) {
    this.reviewResult = makeReviewResult({
      status,
      author,
      reviewer,
      independence,
      reviewerOutput,
    });
  },
);

const inconsistentReviewFactories: Readonly<Record<string, () => CliResult>> = {
  'approved-with-policy': () => makeReviewResult({ status: 'approved', policy: 'prefer' }),
  'changes-with-policy': () =>
    makeReviewResult({
      status: 'changes_requested',
      verdict: 'request_changes',
      policy: 'prefer',
    }),
  'blocked-without-policy': () => makeReviewResult({ status: 'blocked' }),
  'blocked-invalid-policy': () => makeReviewResult({ status: 'blocked', policy: 'sometimes' }),
  'blocked-cross-agent': () =>
    makeReviewResult({
      status: 'blocked',
      reviewer: 'claude',
      independence: 'cross-agent',
      policy: 'require',
    }),
  'blocked-prefer-degraded': () => makeReviewResult({ status: 'blocked', policy: 'prefer' }),
  'approved-action-required': () =>
    makeReviewResult({ status: 'approved', state: 'action_required' }),
  'changes-healthy': () =>
    makeReviewResult({
      status: 'changes_requested',
      verdict: 'request_changes',
      state: 'healthy',
    }),
  'blocked-healthy': () =>
    makeReviewResult({ status: 'blocked', policy: 'require', state: 'healthy' }),
  'approved-none': () => makeReviewResult({ status: 'approved', independence: 'none' }),
  'changes-none': () =>
    makeReviewResult({
      status: 'changes_requested',
      verdict: 'request_changes',
      independence: 'none',
    }),
  'missing-status-degraded': () => makeReviewResult({ status: 'absent' }),
  'invalid-status-cross-agent': () =>
    makeReviewResult({
      status: 'complete',
      reviewer: 'claude',
      independence: 'cross-agent',
    }),
  'missing-verdict': () =>
    makeReviewResult({ status: 'approved', reviewerOutput: 'missing-verdict' }),
  'missing-output-reviewer': () =>
    makeReviewResult({ status: 'approved', reviewerOutputAgent: 'absent' }),
  'mismatched-output-reviewer': () =>
    makeReviewResult({
      status: 'approved',
      reviewer: 'claude',
      reviewerOutputAgent: 'codex',
      independence: 'cross-agent',
    }),
  'invalid-top-state': () => makeReviewResult({ status: 'approved', state: 'failed' }),
};

Given('an inconsistent {word} review tuple', function (this: ReviewWorld, reviewCase: string) {
  const factory = inconsistentReviewFactories[reviewCase];
  assert.ok(factory, `Unknown inconsistent review tuple: ${reviewCase}`);
  this.reviewResult = factory();
});

Given('an exhausted prefer-policy review result', function (this: ReviewWorld) {
  const result = makeReviewResult({
    status: 'blocked',
    reviewer: 'absent',
    independence: 'none',
    reviewerOutput: 'absent',
    policy: 'prefer',
  });
  this.reviewResult = {
    ...result,
    findings: [
      {
        code: 'REVIEW_ROUTES_EXHAUSTED',
        message: 'Every typed reviewer route was exhausted.',
        severity: 'warning',
      },
    ],
  };
});

Given(
  'a blocked require-policy review has standard coverage and {word} verdict',
  function (this: ReviewWorld, verdict: string) {
    const result = makeReviewResult({ status: 'blocked', verdict, policy: 'require' });
    const output = (result.data as Record<string, unknown>).reviewer_output as Record<
      string,
      unknown
    >;
    output.findings = [{ severity: 'warning', message: 'Existing finding.' }];
    this.reviewResult = {
      ...result,
      findings: [{ code: 'REVIEWER_FINDING', message: 'Existing finding.', severity: 'warning' }],
    };
  },
);

Given(
  'an approved standard review by {word} assigned to {word} after {word}',
  function (this: ReviewWorld, author: string, assignedReviewer: string, preferredFailure: string) {
    this.reviewResult = makeReviewResult({
      status: 'approved',
      author,
      reviewer: author,
      assignedReviewer: optionalValue(assignedReviewer),
      ...(optionalValue(preferredFailure) !== undefined && { preferredFailure }),
    });
  },
);

Given(
  'a changes-requested standard review assigned to {word} after {word}',
  function (this: ReviewWorld, assignedReviewer: string, preferredFailure: string) {
    this.reviewResult = makeReviewResult({
      status: 'changes_requested',
      verdict: 'request_changes',
      assignedReviewer,
      preferredFailure,
    });
  },
);

interface NonEligibleReviewFixture {
  result: CliResult;
  recovery: { command: string; description: string; requiresHuman: boolean }[];
}

const nonEligibleCommon = { assignedReviewer: 'claude', preferredFailure: 'not_installed' };

function sentinelRecovery(): NonEligibleReviewFixture['recovery'] {
  return [
    {
      command: 'sentinel review command',
      description: 'Existing recovery.',
      requiresHuman: true,
    },
  ];
}

const nonEligibleReviewFactories: Readonly<Record<string, () => NonEligibleReviewFixture>> = {
  independent: () => ({
    result: makeReviewResult({
      status: 'approved',
      reviewer: 'claude',
      independence: 'cross-agent',
      ...nonEligibleCommon,
    }),
    recovery: [],
  }),
  required: () => ({
    result: makeReviewResult({ status: 'blocked', policy: 'require', ...nonEligibleCommon }),
    recovery: sentinelRecovery(),
  }),
  exhausted: () => ({
    result: makeReviewResult({
      status: 'blocked',
      reviewer: 'absent',
      independence: 'none',
      reviewerOutput: 'absent',
      policy: 'prefer',
      ...nonEligibleCommon,
    }),
    recovery: sentinelRecovery(),
  }),
  incomplete: () => ({
    result: makeReviewResult({
      status: 'approved',
      reviewerOutput: 'absent',
      ...nonEligibleCommon,
    }),
    recovery: [],
  }),
};

function nonEligibleReviewResult(reviewCase: string): NonEligibleReviewFixture {
  const factory = nonEligibleReviewFactories[reviewCase];
  assert.ok(factory, `Unknown non-eligible review fixture: ${reviewCase}`);
  return factory();
}

Given(
  'an {word} review result cannot offer an independent-coverage upgrade',
  function (this: ReviewWorld, reviewCase: string) {
    const { result, recovery } = nonEligibleReviewResult(reviewCase);
    this.reviewResult = { ...result, recovery };
    this.originalRecovery = structuredClone(recovery);
  },
);

Given('reviewer prose mentions {string}', function (this: ReviewWorld, prose: string) {
  assert.ok(this.reviewResult);
  this.reviewResult = {
    ...this.reviewResult,
    findings: [{ code: 'REVIEWER_FINDING', message: prose, severity: 'info' }],
  };
});

function renderOrdinaryReview(world: ReviewWorld): void {
  assert.ok(world.reviewResult);
  world.human = renderHumanResult(world.reviewResult);
}

function renderOrdinaryAndVerboseReview(world: ReviewWorld): void {
  renderOrdinaryReview(world);
  assert.ok(world.reviewResult);
  world.verbose = renderHumanResult(world.reviewResult, { verbose: true });
}

When('the typed review result is rendered for a person', function (this: ReviewWorld) {
  renderOrdinaryReview(this);
});

When('verbose review details are rendered', function (this: ReviewWorld) {
  renderOrdinaryAndVerboseReview(this);
});

When('human and JSON review results are rendered', function (this: ReviewWorld) {
  assert.ok(this.reviewResult);
  this.jsonBeforeHuman = renderJsonResult(this.reviewResult);
  this.human = renderHumanResult(this.reviewResult, { verbose: true });
  this.json = renderJsonResult(this.reviewResult);
});

Then('its review data keys are exactly {string}', function (this: ReviewWorld, expected: string) {
  const envelope = JSON.parse(this.json ?? '{}') as { data?: Record<string, unknown> };
  assert.ok(envelope.data);
  assert.deepEqual(
    Object.keys(envelope.data).toSorted((left, right) => left.localeCompare(right)),
    expected.split(','),
  );
});

Then(
  'its machine values are state {word}, status {word}, independence {word}, actual {word}, assigned {word}, and verdict {word}',
  // eslint-disable-next-line max-params -- Cucumber validates callback arity against six expression parameters plus World.
  function (
    this: ReviewWorld,
    state: string,
    status: string,
    independence: string,
    actual: string,
    assigned: string,
    verdict: string,
  ) {
    const envelope = JSON.parse(this.json ?? '{}') as {
      state?: string;
      data?: {
        status?: string;
        independence?: string;
        actual_reviewer?: string;
        assigned_reviewer?: string;
        reviewer_output?: { verdict?: string };
      };
    };
    assert.ok(envelope.data);
    assert.deepEqual(
      {
        state: envelope.state,
        status: envelope.data.status,
        independence: envelope.data.independence,
        actual: envelope.data.actual_reviewer ?? 'absent',
        assigned: envelope.data.assigned_reviewer ?? 'absent',
        verdict: envelope.data.reviewer_output?.verdict ?? 'absent',
      },
      { state, status, independence, actual, assigned, verdict },
    );
  },
);

Then(
  'the JSON has the exact public envelope keys and no presentation fields',
  function (this: ReviewWorld) {
    const envelope = JSON.parse(this.json ?? '{}') as Record<string, unknown>;
    assert.deepEqual(
      Object.keys(envelope).toSorted((left, right) => left.localeCompare(right)),
      [
        'changed',
        'data',
        'effects',
        'errors',
        'findings',
        'next_actions',
        'ok',
        'recovery',
        'schema_version',
        'state',
      ],
    );
    const serialized = JSON.stringify(envelope);
    for (const field of ['coverage', 'coverage_message', 'review_details', 'upgrade_suggestion']) {
      assert.equal(serialized.includes(`"${field}"`), false, field);
    }
  },
);

Then('the first review line is {string}', function (this: ReviewWorld, expected: string) {
  assert.equal(this.human?.split('\n', 1)[0], expected);
});

Then('the first review line begins {string}', function (this: ReviewWorld, expected: string) {
  assert.ok(this.human?.split('\n', 1)[0]?.startsWith(expected));
});

Then('the typed provenance is unchanged', function (this: ReviewWorld) {
  assert.deepEqual(this.reviewResult?.data, this.originalData);
});

Then('review policy is absent', function (this: ReviewWorld) {
  assert.equal((this.reviewResult?.data as Record<string, unknown>).review_policy, undefined);
});

Then('no completed coverage phrase is shown', function (this: ReviewWorld) {
  const presentation = (this.human ?? '').replaceAll(
    'required independent coverage is unsatisfied',
    '',
  );
  assert.doesNotMatch(
    presentation,
    /Review (?:complete|changes requested)|\b(?:standard|independent) coverage\b/u,
  );
});

Then('the declared inconsistent cases exactly match the executable rejection domain', () => {
  const feature = readFileSync(
    nodePath.join(repoRoot, 'packages/cli/features/clarify-review-coverage.feature'),
    'utf8',
  );
  const parser = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  );
  const document = parser.parse(feature);
  const scenario = document.feature?.children
    .map(child => child.scenario)
    .find(
      candidate =>
        candidate?.name ===
        'Presentation rejects inconsistent policy and status as completed coverage',
    );
  assert.ok(scenario, 'Missing inconsistent-policy presentation scenario outline');
  const declared = scenario.examples
    .flatMap(example => {
      const caseColumn = example.tableHeader?.cells.findIndex(cell => cell.value === 'case') ?? -1;
      assert.notEqual(caseColumn, -1, 'Missing case column in inconsistent-policy examples');
      return example.tableBody.map(row => row.cells[caseColumn]?.value);
    })
    .filter((value): value is string => value !== undefined)
    .toSorted((left, right) => left.localeCompare(right));
  assert.deepEqual(
    declared,
    Object.keys(inconsistentReviewFactories).toSorted((left, right) => left.localeCompare(right)),
  );
});

Then('the result remains blocked with no actual reviewer', function (this: ReviewWorld) {
  assert.equal(this.reviewResult?.state, 'action_required');
  assert.equal((this.reviewResult?.data as Record<string, unknown>).status, 'blocked');
  assert.equal((this.reviewResult?.data as Record<string, unknown>).actual_reviewer, undefined);
});

Then('review policy remains prefer', function (this: ReviewWorld) {
  assert.equal((this.reviewResult?.data as Record<string, unknown>).review_policy, 'prefer');
});

Then('it retains the REVIEW_ROUTES_EXHAUSTED finding', function (this: ReviewWorld) {
  assert.ok(
    this.reviewResult?.findings.some(finding => finding.code === 'REVIEW_ROUTES_EXHAUSTED'),
  );
});

Then('the command exit status is {int}', function (this: ReviewWorld, expected: number) {
  assert.ok(this.reviewResult);
  assert.equal(exitStatusFor(this.reviewResult), expected);
});

Then('the result remains blocked with degraded independence', function (this: ReviewWorld) {
  assert.equal(this.reviewResult?.state, 'action_required');
  assert.equal((this.reviewResult?.data as Record<string, unknown>).status, 'blocked');
  assert.equal((this.reviewResult?.data as Record<string, unknown>).independence, 'degraded');
});

Then('review policy remains require', function (this: ReviewWorld) {
  assert.equal((this.reviewResult?.data as Record<string, unknown>).review_policy, 'require');
});

Then(
  'the raw {word} verdict and findings are preserved',
  function (this: ReviewWorld, verdict: string) {
    const output = (this.reviewResult?.data as Record<string, unknown>).reviewer_output as {
      verdict?: string;
      findings?: unknown[];
    };
    assert.equal(output.verdict, verdict);
    assert.deepEqual(output.findings, [{ severity: 'warning', message: 'Existing finding.' }]);
    assert.ok(
      this.reviewResult?.findings.some(
        finding => finding.code === 'REVIEWER_FINDING' && finding.message === 'Existing finding.',
      ),
    );
  },
);

Then('the optional suggestion is {string}', function (this: ReviewWorld, expected: string) {
  assert.equal(this.verbose?.split('\n').at(-1), expected);
  assert.equal((this.verbose?.match(/To add independent coverage/gu) ?? []).length, 1);
});

Then('ordinary output contains no upgrade suggestion', function (this: ReviewWorld) {
  assert.doesNotMatch(this.human ?? '', /To add independent coverage/u);
});

Then('no optional suggestion is shown', function (this: ReviewWorld) {
  assert.doesNotMatch(this.verbose ?? '', /To add independent coverage/u);
});

Then('structured recovery is unchanged', function (this: ReviewWorld) {
  assert.deepEqual(this.reviewResult?.recovery, this.originalRecovery);
});

Then(
  'JSON retains degraded independence and both reviewer identities',
  function (this: ReviewWorld) {
    const wire = JSON.parse(this.json ?? '{}') as { data?: Record<string, unknown> };
    assert.deepEqual(
      {
        independence: wire.data?.independence,
        assigned: wire.data?.assigned_reviewer,
        actual: wire.data?.actual_reviewer,
      },
      { independence: 'degraded', assigned: 'claude', actual: 'codex' },
    );
  },
);

Then('JSON contains no human upgrade suggestion', function (this: ReviewWorld) {
  assert.doesNotMatch(this.json ?? '', /To add independent coverage/u);
});

Then('the complete JSON envelope is unchanged by human rendering', function (this: ReviewWorld) {
  assert.deepEqual(JSON.parse(this.json ?? '{}'), JSON.parse(this.jsonBeforeHuman ?? '{}'));
});

Then('requested changes remain the first review line', function (this: ReviewWorld) {
  assert.equal(this.verbose?.split('\n', 1)[0], 'Review changes requested — standard coverage.');
});

function createCliFixture(): CliFixture {
  const directory = createFixtureDirectory('safeword-coverage-bdd-');
  const bin = createTrustedFixtureDirectory('safeword-coverage-bin-');
  writeFileSync(nodePath.join(directory, 'spec.md'), `bounded review input ${directory}\n`);
  return { directory, bin };
}

function reviewerInvocationValidation(agent: 'claude' | 'codex'): string {
  const dynamic = undefined;
  const expected: readonly (string | undefined)[] =
    agent === 'claude'
      ? [
          '-p',
          '--output-format',
          'json',
          '--json-schema',
          dynamic,
          '--no-session-persistence',
          '--disable-slash-commands',
          '--setting-sources',
          '',
          '--strict-mcp-config',
          '--tools',
          '',
        ]
      : [
          'exec',
          '--json',
          '--sandbox',
          'read-only',
          '--skip-git-repo-check',
          '--ephemeral',
          '--ignore-user-config',
          '--ignore-rules',
          '--disable',
          'hooks',
          '--config',
          'mcp_servers={}',
          '--output-schema',
          dynamic,
          '-',
        ];
  const checks = expected.map((argument, index) => {
    const position = index + 1;
    const predicate =
      argument === undefined ? '[ -n "$1" ]' : `[ "$1" = ${shellSingleQuoted(argument)} ]`;
    return String.raw`[ "$#" -gt 0 ] && ${predicate} || { printf 'invalid ${agent} review argument at position ${position}\n' >&2; exit 64; }
shift`;
  });
  const trailingModel =
    agent === 'claude'
      ? String.raw`if [ "$#" -gt 0 ]; then
[ "$#" -eq 2 ] && [ "$1" = "--model" ] && [ -n "$2" ] || { printf 'invalid claude model arguments\n' >&2; exit 64; }
shift 2
fi`
      : '';
  return `${checks.join('\n')}\n${trailingModel}\n[ "$#" -eq 0 ] || { printf 'unexpected extra ${agent} review arguments\\n' >&2; exit 64; }`;
}

function shellSingleQuoted(value: string): string {
  const escapedQuote = ["'", '"', "'", '"', "'"].join('');
  return `'${value.split("'").join(escapedQuote)}'`;
}

function installStandardReviewerFixture(): CliFixture {
  const fixture = createCliFixture();
  const { bin } = fixture;
  const executable = nodePath.join(bin, 'codex');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if [ "$#" -gt 0 ] && [ "$1" = "--version" ]; then printf 'codex 1.0.0\n'; exit 0; fi
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '--json --sandbox --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --disable --config --output-schema'
  exit 0
fi
${reviewerInvocationValidation('codex')}
payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | /usr/bin/grep -o '"dispatch_id":"[^"]*"' | /usr/bin/head -n 1 | /usr/bin/cut -d '"' -f 4)
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"codex","verdict":"approve","summary":"reviewed","findings":[]}\n' "$dispatch_id"
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return fixture;
}

function installCoverageReviewer(bin: string, agent: 'claude' | 'codex'): void {
  const executable = nodePath.join(bin, agent);
  const capabilities =
    agent === 'claude'
      ? '--output-format --json-schema --no-session-persistence --disable-slash-commands --setting-sources --strict-mcp-config --tools --model'
      : '--json --sandbox --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --disable --config --output-schema';
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if [ "$#" -gt 0 ] && [ "$1" = "--version" ]; then printf '${agent} 1.0.0\n'; exit 0; fi
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then printf '%s\n' '${capabilities}'; exit 0; fi
${reviewerInvocationValidation(agent)}
failure=$(printenv SAFEWORD_REVIEW_COVERAGE_FAIL_${agent.toUpperCase()} || printenv SAFEWORD_REVIEW_COVERAGE_FAIL || true)
payload=$(cat)
if [ "$failure" = "1" ]; then printf 'review failed\n' >&2; exit 7; fi
dispatch_id=$(printf '%s' "$payload" | /usr/bin/grep -o '"dispatch_id":"[^"]*"' | /usr/bin/head -n 1 | /usr/bin/cut -d '"' -f 4)
verdict=$(printenv SAFEWORD_REVIEW_COVERAGE_VERDICT || true)
if [ -z "$verdict" ]; then verdict=approve; fi
finding=$(printenv SAFEWORD_REVIEW_COVERAGE_FINDING || true)
if [ -n "$finding" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"${agent}","verdict":"%s","summary":"reviewed","findings":[{"severity":"error","message":"%s"}]}\n' "$dispatch_id" "$verdict" "$finding"
else
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"${agent}","verdict":"%s","summary":"reviewed","findings":[]}\n' "$dispatch_id" "$verdict"
fi
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
}

async function runFixtureCli(
  fixture: CliFixture,
  arguments_: string[],
  environment: Record<string, string> = {},
): Promise<CliExecution> {
  try {
    const result = await execFileAsync(
      process.execPath,
      [nodePath.join(repoRoot, 'packages/cli/dist/cli.js'), ...arguments_],
      {
        cwd: fixture.directory,
        env: {
          ...sanitizedFixtureEnvironment(),
          HOME: fixture.directory,
          NODE_ENV: 'test',
          PATH: `${fixture.bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'codex',
          SAFEWORD_NO_UPDATE_CHECK: '1',
          XDG_CONFIG_HOME: nodePath.join(fixture.directory, '.config'),
          ...environment,
        },
        timeout: REAL_CLI_PROCESS_TIMEOUT_MS,
        killSignal: 'SIGKILL',
      },
    );
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error) {
    const failed = error as {
      stdout?: string;
      stderr?: string;
      code?: number | string | null;
      signal?: NodeJS.Signals | null;
    };
    const diagnostics = [
      failed.stderr,
      typeof failed.code === 'string' ? `Spawn error: ${failed.code}` : undefined,
      failed.signal === undefined || failed.signal === null
        ? undefined
        : `Process terminated by signal: ${failed.signal}`,
    ].filter((value): value is string => value !== undefined && value.length > 0);
    return {
      stdout: failed.stdout ?? '',
      stderr: diagnostics.join('\n'),
      exitCode: typeof failed.code === 'number' ? failed.code : 1,
    };
  }
}

function markCliFixtureReady(this: ReviewWorld): void {
  assert.equal(existsSync(nodePath.join(repoRoot, 'packages/cli/dist/cli.js')), true);
  this.cliFixtureReady = true;
}

Given('isolated real CLI fixtures can complete with standard coverage', markCliFixtureReady);

function reviewRunArguments(directory: string, ...resultOptions: string[]): string[] {
  return [
    'review',
    'run',
    'quality-review',
    'spec.md',
    ...resultOptions,
    '--no-input',
    '--cwd',
    directory,
  ];
}

function fixtureArguments(name: string, directory: string): string[] {
  const suffix = reviewRunArguments(directory);
  if (name === 'ordinary') return suffix;
  if (name === 'verboseBefore') return ['--verbose', ...suffix];
  if (name === 'verboseAfter') {
    return [
      'review',
      'run',
      '--verbose',
      'quality-review',
      'spec.md',
      '--no-input',
      '--cwd',
      directory,
    ];
  }
  if (name === 'quiet') return ['--quiet', '--verbose', ...suffix];
  if (name === 'json') return ['--json', '--verbose', ...suffix];
  if (name === 'help') return ['review', 'run', '--help'];
  assert.fail(`Unknown review fixture mode: ${name}`);
}

function assertBlockedJsonMode(result: CliExecution): void {
  assert.equal(result.stderr, '');
  assert.equal((result.stdout.match(/\n/gu) ?? []).length, 1);
  const envelope = JSON.parse(result.stdout) as {
    state?: string;
    data?: Record<string, unknown>;
  };
  assert.equal(envelope.state, 'action_required');
  assert.equal(envelope.data?.status, 'blocked');
  assert.equal(envelope.data?.review_policy, 'require');
  assert.doesNotMatch(result.stdout, /Review incomplete/u);
}

function assertBlockedQuietMode(result: CliExecution): void {
  assert.equal(result.exitCode, 2);
  assert.equal(result.stderr, '');
  assert.match(
    result.stdout,
    /^Review incomplete — required independent coverage is unsatisfied\.\n/u,
  );
  assert.match(result.stdout, /No independent check was recorded\.\n$/u);
}

function assertOneVerboseSuggestion(result: CliExecution): void {
  const suggestion = 'To add independent coverage, install or update Claude, then retry review.';
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.split('\n', 1)[0], 'Review complete — standard coverage.');
  assert.ok(result.stdout.includes(suggestion));
  const completeOutput = `${result.stdout}\n${result.stderr}`;
  assert.equal((completeOutput.match(/To add independent coverage/gu) ?? []).length, 1);
}

function assertSuccessfulOrdinaryMode(result: CliExecution): void {
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.split('\n', 1)[0], 'Review complete — standard coverage.');
  assert.doesNotMatch(result.stdout, /To add independent coverage|degraded|warning/u);
  assert.doesNotMatch(result.stderr, /To add independent coverage|degraded|warning/u);
}

function assertSuccessfulJsonMode(result: CliExecution): void {
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, '');
  assert.doesNotMatch(result.stdout, /To add independent coverage/u);
  assert.equal((result.stdout.match(/\n/gu) ?? []).length, 1);
  const parsed = JSON.parse(result.stdout) as { data?: { independence?: string } };
  assert.equal(parsed.data?.independence, 'degraded');
}

function assertSuccessfulHelpMode(result: CliExecution): void {
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, '');
  for (const requiredLine of [
    'Usage: safeword review run [options] <kind> <targets...>',
    'Run an independent adversarial review',
    '--json',
    '--no-input',
    '--cwd <path>',
    '--quiet',
    '--offline',
    '-v, --verbose',
    '--agent-handoff',
    '-h, --help',
  ]) {
    assert.ok(result.stdout.includes(requiredLine), requiredLine);
  }
  assert.doesNotMatch(result.stdout, /standard coverage|To add independent coverage/u);
}

const SUCCESSFUL_MODE_ASSERTIONS: Readonly<Record<string, (result: CliExecution) => void>> = {
  ordinary: assertSuccessfulOrdinaryMode,
  'verbose-before': assertOneVerboseSuggestion,
  'verbose-after': assertOneVerboseSuggestion,
  quiet: result => {
    assert.deepEqual(result, { stdout: '', stderr: '', exitCode: 0 });
  },
  JSON: assertSuccessfulJsonMode,
  help: assertSuccessfulHelpMode,
};

function successfulModeArgumentName(mode: string): string {
  if (mode === 'verbose-before') return 'verboseBefore';
  if (mode === 'verbose-after') return 'verboseAfter';
  return mode === 'JSON' ? 'json' : mode;
}

When(
  'successful review runs in {word} mode',
  { timeout: REAL_CLI_STEP_TIMEOUT_MS },
  async function (this: ReviewWorld, mode: string) {
    assert.equal(this.cliFixtureReady, true);
    const fixture = installStandardReviewerFixture();
    this.singleCliMode = {
      name: mode,
      result: await runFixtureCli(
        fixture,
        fixtureArguments(successfulModeArgumentName(mode), fixture.directory),
      ),
    };
  },
);

Then(
  'successful {word} output preserves its channel contract',
  function (this: ReviewWorld, mode: string) {
    assert.equal(this.singleCliMode?.name, mode);
    assert.ok(this.singleCliMode);
    const assertion = SUCCESSFUL_MODE_ASSERTIONS[mode];
    assert.ok(assertion, mode);
    assertion(this.singleCliMode.result);
  },
);

Given(
  'isolated real CLI fixtures can complete with standard or independent coverage',
  markCliFixtureReady,
);

When(
  'a real {word} review with {word} verdict runs in {word} mode',
  { timeout: REAL_CLI_STEP_TIMEOUT_MS },
  async function (this: ReviewWorld, coverage: string, verdict: string, mode: string) {
    assert.equal(this.cliFixtureReady, true);
    assert.ok(coverage === 'standard' || coverage === 'independent');
    assert.ok(verdict === 'approve' || verdict === 'request_changes');
    assert.ok(mode === 'ordinary' || mode === 'verbose');
    const fixture = installPreferredReviewerFixture();
    const environment: Record<string, string> = {};
    if (coverage === 'standard') environment.SAFEWORD_REVIEW_COVERAGE_FAIL_CLAUDE = '1';
    if (verdict === CHANGE_REQUEST_VERDICT) Object.assign(environment, changeRequestEnvironment());
    this.realPresentation = {
      coverage,
      verdict,
      mode,
      result: await runFixtureCli(
        fixture,
        fixtureArguments(mode === 'verbose' ? 'verboseBefore' : 'ordinary', fixture.directory),
        environment,
      ),
    };
  },
);

Then(
  'its public output reports {word} coverage with {word} verdict',
  function (this: ReviewWorld, coverage: string, verdict: string) {
    const execution = this.realPresentation;
    assert.ok(execution);
    assert.equal(execution.coverage, coverage);
    assert.equal(execution.verdict, verdict);
    const statusText = verdict === 'approve' ? 'Review complete' : 'Review changes requested';
    assert.equal(execution.result.exitCode, verdict === 'approve' ? 0 : 2, execution.result.stdout);
    assert.equal(
      execution.result.stdout.split('\n', 1)[0],
      `${statusText} — ${coverage} coverage.`,
    );
    assert.ok(execution.result.stdout.includes('reviewed'));
    if (verdict === CHANGE_REQUEST_VERDICT) {
      assert.ok(execution.result.stdout.includes(CHANGE_REQUEST_FINDING));
    }
    const hasSuggestion = execution.result.stdout.includes('To add independent coverage');
    assert.equal(
      hasSuggestion,
      coverage === 'standard' && verdict === 'approve' && execution.mode === 'verbose',
    );
  },
);

Given(
  'a completed {word} {word} review with an existing summary and finding',
  function (this: ReviewWorld, status: string, coverage: string) {
    const independent = coverage === 'independent';
    const result = makeReviewResult({
      status,
      reviewer: independent ? 'claude' : 'codex',
      independence: independent ? 'cross-agent' : 'degraded',
      verdict: status === 'approved' ? 'approve' : 'request_changes',
      assignedReviewer: 'claude',
      preferredFailure: 'not_installed',
    });
    this.reviewResult = {
      ...result,
      findings: [
        { code: 'REVIEWER_SUMMARY', message: 'Existing summary.', severity: 'info' },
        { code: 'REVIEWER_FINDING', message: 'Existing finding.', severity: 'warning' },
      ],
    };
  },
);

When('ordinary and verbose review content is rendered', function (this: ReviewWorld) {
  renderOrdinaryAndVerboseReview(this);
});

Then(
  'the summary and finding follow {string} in order',
  function (this: ReviewWorld, firstLine: string) {
    assert.deepEqual(this.human?.split('\n'), [
      firstLine,
      'Existing summary.',
      'Existing finding.',
    ]);
    assert.deepEqual(this.verbose?.split('\n').slice(0, 3), [
      firstLine,
      'Existing summary.',
      'Existing finding.',
    ]);
  },
);

Then('verbose output ends with {string}', function (this: ReviewWorld, lastLine: string) {
  assert.equal(this.verbose?.split('\n').at(-1), lastLine);
});

function installRequiredReviewerFixture(): CliFixture {
  return installPreferredReviewerFixture('require');
}

function installPreferredReviewerFixture(policy?: 'require'): CliFixture {
  const fixture = createCliFixture();
  installCoverageReviewer(fixture.bin, 'codex');
  installCoverageReviewer(fixture.bin, 'claude');
  if (policy !== undefined) {
    mkdirSync(nodePath.join(fixture.directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(fixture.directory, '.safeword/config.json'),
      JSON.stringify({ crossAgentReview: policy }),
    );
  }
  return fixture;
}

async function runRequiredFixture(
  environment: Record<string, string> = {},
  mode: 'json' | 'quiet' = 'json',
): Promise<CliExecution> {
  const fixture = installRequiredReviewerFixture();
  return runFixtureCli(
    fixture,
    reviewRunArguments(fixture.directory, mode === 'json' ? '--json' : '--quiet'),
    environment,
  );
}

async function runPreferredChangesFixture(): Promise<CliExecution> {
  const fixture = installPreferredReviewerFixture();
  return runFixtureCli(
    fixture,
    reviewRunArguments(fixture.directory, '--json'),
    changeRequestEnvironment({ SAFEWORD_REVIEW_COVERAGE_FAIL_CLAUDE: '1' }),
  );
}

Given('isolated real CLI fixtures can exercise machine schemas', markCliFixtureReady);

const realSchemaOutcomeRunners: Readonly<Record<string, () => Promise<CliExecution>>> = {
  approved: async () => {
    const fixture = installStandardReviewerFixture();
    return runFixtureCli(fixture, reviewRunArguments(fixture.directory, '--json'));
  },
  changes_requested: runPreferredChangesFixture,
  blocked_degraded: () =>
    runRequiredFixture(changeRequestEnvironment({ SAFEWORD_REVIEW_COVERAGE_FAIL_CLAUDE: '1' })),
  exhausted: () => runRequiredFixture({ SAFEWORD_REVIEW_COVERAGE_FAIL: '1' }),
};

When(
  'a real review ends as {word}',
  { timeout: REAL_CLI_STEP_TIMEOUT_MS },
  async function (this: ReviewWorld, outcome: string) {
    assert.equal(this.cliFixtureReady, true);
    const runOutcome = realSchemaOutcomeRunners[outcome];
    assert.ok(runOutcome, `Unknown real review outcome: ${outcome}`);
    const result = await runOutcome();
    assert.equal(result.exitCode, outcome === 'approved' ? 0 : 2, JSON.stringify(result));
    assert.equal(result.stderr, '');
    this.json = result.stdout;
  },
);

Given('isolated real CLI fixtures can require independent review', markCliFixtureReady);

function parseExecutionEnvelope(result: CliExecution): {
  state?: string;
  findings?: { code?: string; message?: string }[];
  recovery?: { command?: string }[];
  data: Record<string, unknown>;
} {
  const envelope = JSON.parse(result.stdout) as {
    state?: string;
    findings?: { code?: string; message?: string }[];
    recovery?: { command?: string }[];
    data?: Record<string, unknown>;
  };
  assert.ok(envelope.data);
  return { ...envelope, data: envelope.data };
}

function assertRequiredIndependent(result: CliExecution): void {
  assert.equal(result.exitCode, 0);
  const envelope = parseExecutionEnvelope(result);
  assert.deepEqual(
    {
      status: envelope.data.status,
      independence: envelope.data.independence,
      reviewer: envelope.data.actual_reviewer,
      policy: envelope.data.review_policy,
    },
    { status: 'approved', independence: 'cross-agent', reviewer: 'claude', policy: undefined },
  );
}

function assertPreservedChangeRequest(envelope: ReturnType<typeof parseExecutionEnvelope>): void {
  const output = envelope.data.reviewer_output as {
    verdict?: string;
    findings?: { severity?: string; message?: string }[];
  };
  assert.equal(output.verdict, CHANGE_REQUEST_VERDICT);
  assert.deepEqual(output.findings, [{ severity: 'error', message: CHANGE_REQUEST_FINDING }]);
  assert.ok(
    envelope.findings?.some(
      finding => finding.code === 'REVIEWER_FINDING' && finding.message === CHANGE_REQUEST_FINDING,
    ),
  );
}

function assertRequiredIndependentChanges(result: CliExecution): void {
  assert.equal(result.exitCode, 2);
  const envelope = parseExecutionEnvelope(result);
  assert.deepEqual(
    {
      state: envelope.state,
      status: envelope.data.status,
      independence: envelope.data.independence,
      assigned: envelope.data.assigned_reviewer,
      actual: envelope.data.actual_reviewer,
      policy: envelope.data.review_policy,
    },
    {
      state: 'action_required',
      status: 'changes_requested',
      independence: 'cross-agent',
      assigned: 'claude',
      actual: 'claude',
      policy: undefined,
    },
  );
  assertPreservedChangeRequest(envelope);
  assert.deepEqual(envelope.recovery, []);
}

function assertRequiredSameAgent(result: CliExecution): void {
  assert.equal(result.exitCode, 2);
  const envelope = parseExecutionEnvelope(result);
  assert.deepEqual(
    {
      state: envelope.state,
      status: envelope.data.status,
      policy: envelope.data.review_policy,
      independence: envelope.data.independence,
      assigned: envelope.data.assigned_reviewer,
      actual: envelope.data.actual_reviewer,
    },
    {
      state: 'action_required',
      status: 'blocked',
      policy: 'require',
      independence: 'degraded',
      assigned: 'claude',
      actual: 'codex',
    },
  );
  assertPreservedChangeRequest(envelope);
}

function assertRequiredExhausted(result: CliExecution): void {
  assert.equal(result.exitCode, 2);
  const envelope = parseExecutionEnvelope(result);
  assert.deepEqual(
    {
      state: envelope.state,
      status: envelope.data.status,
      policy: envelope.data.review_policy,
      independence: envelope.data.independence,
      reviewer: envelope.data.actual_reviewer,
    },
    {
      state: 'action_required',
      status: 'blocked',
      policy: 'require',
      independence: 'none',
      reviewer: undefined,
    },
  );
  assert.deepEqual(
    envelope.recovery?.map(item => item.command),
    ['safeword review run quality-review -- spec.md'],
  );
}

function assertRequiredUnsupportedAuthor(result: CliExecution): void {
  assert.equal(result.exitCode, 2);
  const envelope = parseExecutionEnvelope(result);
  assert.deepEqual(
    {
      state: envelope.state,
      status: envelope.data.status,
      policy: envelope.data.review_policy,
      independence: envelope.data.independence,
      author: envelope.data.author_agent,
    },
    {
      state: 'action_required',
      status: 'blocked',
      policy: 'require',
      independence: 'none',
      author: 'cursor',
    },
  );
  assert.deepEqual(
    envelope.recovery?.map(item => item.command),
    ['safeword review run quality-review -- spec.md'],
  );
  assert.ok(
    readFileSync(
      nodePath.join(repoRoot, 'packages/cli/templates/skills/finish-review/SKILL.md'),
      'utf8',
    ).includes("Include the coordinator's recovery command exactly as provided."),
  );
}

const REQUIRED_OUTCOME_ASSERTIONS: Readonly<Record<string, (result: CliExecution) => void>> = {
  independent: assertRequiredIndependent,
  'independent-changes': assertRequiredIndependentChanges,
  'same-agent': assertRequiredSameAgent,
  exhausted: assertRequiredExhausted,
  'unsupported-author': assertRequiredUnsupportedAuthor,
};

function requiredOutcomeEnvironment(outcome: string): Record<string, string> {
  if (outcome === 'independent-changes') {
    return changeRequestEnvironment();
  }
  if (outcome === 'same-agent') {
    return changeRequestEnvironment({ SAFEWORD_REVIEW_COVERAGE_FAIL_CLAUDE: '1' });
  }
  if (outcome === 'exhausted') return { SAFEWORD_REVIEW_COVERAGE_FAIL: '1' };
  if (outcome === 'unsupported-author') return { SAFEWORD_AGENT_RUNTIME: 'cursor' };
  assert.equal(outcome, 'independent');
  return {};
}

When(
  'required review runs with {word} in isolation',
  { timeout: REAL_CLI_STEP_TIMEOUT_MS },
  async function (this: ReviewWorld, outcome: string) {
    assert.equal(this.cliFixtureReady, true);
    this.requiredOutcome = {
      name: outcome,
      result: await runRequiredFixture(requiredOutcomeEnvironment(outcome)),
    };
  },
);

Then(
  'required {word} preserves its assurance contract',
  function (this: ReviewWorld, outcome: string) {
    assert.equal(this.requiredOutcome?.name, outcome);
    assert.ok(this.requiredOutcome);
    const assertion = REQUIRED_OUTCOME_ASSERTIONS[outcome];
    assert.ok(assertion, outcome);
    assertion(this.requiredOutcome.result);
  },
);

When(
  'a blocked required review runs in {word} mode',
  { timeout: REAL_CLI_STEP_TIMEOUT_MS },
  async function (this: ReviewWorld, mode: string) {
    assert.equal(this.cliFixtureReady, true);
    assert.ok(mode === 'quiet' || mode === 'JSON');
    this.blockedMode = {
      name: mode,
      result: await runRequiredFixture(
        { SAFEWORD_REVIEW_COVERAGE_FAIL: '1' },
        mode === 'JSON' ? 'json' : 'quiet',
      ),
    };
  },
);

Then(
  'blocked {word} output preserves its channel contract',
  function (this: ReviewWorld, mode: string) {
    assert.equal(this.blockedMode?.name, mode);
    const result = this.blockedMode?.result;
    assert.ok(result);
    assert.equal(result.exitCode, 2, JSON.stringify(result));
    const combined = `${result.stdout}\n${result.stderr}`;
    assert.doesNotMatch(combined, /To add independent coverage/u);
    if (mode === 'JSON') assertBlockedJsonMode(result);
    else assertBlockedQuietMode(result);
  },
);

const distributedContracts = {
  'finish-review': {
    canonical: 'packages/cli/templates/skills/finish-review/SKILL.md',
    generated: [
      'plugin/skills/finish-review/SKILL.md',
      'packages/cli/codex-plugin/skills/finish-review/SKILL.md',
    ],
    dogfood: ['.safeword/skills/finish-review/SKILL.md', '.claude/skills/finish-review/SKILL.md'],
    cursor: {
      command: {
        source: 'packages/cli/templates/commands/finish-review.md',
        destination: '.cursor/commands/finish-review.md',
      },
      rule: {
        source: 'packages/cli/templates/cursor/rules/safeword-finish-review.mdc',
        destination: '.cursor/rules/safeword-finish-review.mdc',
      },
    },
  },
  'quality-review': {
    canonical: 'packages/cli/templates/skills/quality-review/SKILL.md',
    generated: [
      'plugin/skills/quality-review/SKILL.md',
      'packages/cli/codex-plugin/skills/quality-review/SKILL.md',
    ],
    dogfood: ['.safeword/skills/quality-review/SKILL.md', '.claude/skills/quality-review/SKILL.md'],
    cursor: {
      command: {
        source: 'packages/cli/templates/commands/quality-review.md',
        destination: '.cursor/commands/quality-review.md',
      },
      rule: {
        source: 'packages/cli/templates/cursor/rules/safeword-quality-reviewing.mdc',
        destination: '.cursor/rules/safeword-quality-reviewing.mdc',
      },
    },
  },
} as const;

function distributedContractPaths(name: ReviewContractName): readonly string[] {
  const contract = distributedContracts[name];
  return [
    contract.canonical,
    ...contract.generated,
    ...contract.dogfood,
    ...Object.values(contract.cursor).flatMap(edge => [edge.source, edge.destination]),
  ];
}

const mandatoryFinishPolicyBlock = `Under \`prefer\`, map \`approve\` to \`State: approved\` and \`request_changes\` to
\`State: action required\`; an \`approve\` verdict is not action required under
\`prefer\`. Under \`require\`, always use
\`Policy: require unsatisfied\` and \`State: action required\`, regardless of the
supplemental verdict. A \`request_changes\` verdict must never be reported as
approval.

- Under \`prefer\`, supplemental findings complete the requested review with the
  verdict above. Do not call them standard or independent coverage and do not
  write machine provenance or a review stamp.
- Under \`require\`, report the supplemental findings as additional feedback, keep
  the coordinator's unsatisfied-independence verdict action required, and say:
  "Required independent coverage remains unsatisfied. Use an environment with a
  usable independent reviewer. Alternatively, explicitly choose \`prefer\`."
  Include the coordinator's recovery command exactly as provided.

Never describe either supplemental route as completed standard or independent
coverage, and never write an
independent review stamp from this workflow.`;

const mandatoryQualityPolicyBlock = `Keep optional setup advice quiet by default. When the user asks
\`Show review coverage details.\`, report the typed result's achieved coverage,
raw independence, and actual reviewer when present. Derive at most one
optional upgrade from typed \`assigned_reviewer\` and \`preferred_failure\`.
Preserve a blocked or \`require\`-unsatisfied result, and never invent
provenance, completed coverage, or a recovery command.`;

function normalizeContract(content: string): string {
  return content.replaceAll(/\s+/gu, ' ').trim();
}

function mandatoryPolicyBlock(name: keyof typeof distributedContracts): string {
  return normalizeContract(
    name === 'finish-review' ? mandatoryFinishPolicyBlock : mandatoryQualityPolicyBlock,
  );
}

const contradictoryPolicyClaims = [
  /(?:required independent coverage|independence requirement|assurance requirement).{1,24}(?:\bmet\b|(?<!un)satisfied|fulfilled)/iu,
  /\breview (?:succeeded|passed)\b/iu,
  /\b(?:invent|replace|rewrite|synthesize) (?:the )?(?:coordinator's )?recovery command\b/iu,
  /\b(?:record|emit|claim) (?:machine )?provenance\b/iu,
];

function assertNoContradictoryPolicyClaims(content: string, relativePath: string): void {
  for (const pattern of contradictoryPolicyClaims) {
    assert.doesNotMatch(content, pattern, relativePath);
  }
}

function contractBody(content: string): string {
  if (!content.startsWith('---\n')) return content.trim();
  const closingDelimiter = content.indexOf('\n---\n', 4);
  const body = closingDelimiter === -1 ? '' : content.slice(closingDelimiter + 5).trim();
  assert.ok(body, 'Contract frontmatter must be followed by a body');
  return body;
}

function distributedContractContent(
  relativePath: string,
  expectedContract: ReviewContractName,
): string {
  const content = readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');
  const pointer = contractPointerTarget(content);
  if (pointer !== undefined) {
    assert.ok(
      pointer.includes(`/skills/${expectedContract}/`),
      `${relativePath} points to the wrong review contract: ${pointer}`,
    );
  }
  return pointer === undefined ? content : readFileSync(nodePath.join(repoRoot, pointer), 'utf8');
}

function contractPointerTarget(content: string): string | undefined {
  return /^(?:Read and follow the instructions in |@)(\.safeword\/skills\/(?:finish-review|quality-review)\/SKILL\.md)$/u.exec(
    contractBody(content),
  )?.[1];
}

function assertPointerOnlyWrapper(
  relativePath: string,
  expectedContract: ReviewContractName,
): void {
  const content = readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');
  const pointer = contractPointerTarget(content);
  if (pointer === undefined) return;
  assert.ok(
    pointer.includes(`/skills/${expectedContract}/`),
    `${relativePath} points to the wrong review contract: ${pointer}`,
  );
  assertNoContradictoryPolicyClaims(normalizeContract(content), relativePath);
}

Given(
  'the distributed {word} review contract surfaces',
  function (this: ReviewWorld, name: string) {
    assert.ok(name === 'finish-review' || name === 'quality-review');
    this.distributedContract = name;
  },
);

When('their host-fallback wording is inspected', function (this: ReviewWorld) {
  assert.ok(this.distributedContract);
});

When('their machine-coverage claims are inspected', function (this: ReviewWorld) {
  assert.ok(this.distributedContract);
});

Then(
  'effective instructions for every surface contain {string}',
  function (this: ReviewWorld, expected: string) {
    assert.ok(this.distributedContract);
    const contractPaths = distributedContractPaths(this.distributedContract);
    for (const relativePath of contractPaths) {
      assert.ok(
        distributedContractContent(relativePath, this.distributedContract).includes(expected),
        relativePath,
      );
    }
  },
);

Then('every surface preserves its policy boundary clauses', function (this: ReviewWorld) {
  assert.ok(this.distributedContract);
  const contractPaths = distributedContractPaths(this.distributedContract);
  for (const relativePath of contractPaths) {
    assertPointerOnlyWrapper(relativePath, this.distributedContract);
    const content = normalizeContract(
      distributedContractContent(relativePath, this.distributedContract),
    );
    const mandatoryBlock = mandatoryPolicyBlock(this.distributedContract);
    assert.ok(content.includes(mandatoryBlock), relativePath);
    const remainder = content.replaceAll(mandatoryBlock, '');
    assertNoContradictoryPolicyClaims(remainder, relativePath);
  }
});

Then(
  'no surface claims completed coverage outside its mandatory denial clauses',
  function (this: ReviewWorld) {
    assert.equal(this.distributedContract, 'finish-review');
    const contractPaths = distributedContractPaths('finish-review');
    const allowedClauses = [
      'Do not call them standard or independent coverage and do not write machine provenance or a review stamp.',
      'Required independent coverage remains unsatisfied.',
      'Never describe either supplemental route as completed standard or independent coverage, and never write an independent review stamp from this workflow.',
    ];
    for (const relativePath of contractPaths) {
      assertPointerOnlyWrapper(relativePath, 'finish-review');
      const content = normalizeContract(distributedContractContent(relativePath, 'finish-review'));
      let remainder = content;
      for (const clause of allowedClauses) {
        assert.ok(content.includes(clause), relativePath);
        remainder = remainder.replaceAll(clause, '');
      }
      assert.doesNotMatch(
        remainder,
        /\b(?:standard(?: or independent)?|independent|completed standard(?: or independent)?|completed machine|machine-validated) coverage\b/iu,
        relativePath,
      );
      const policyRemainder = remainder.replaceAll(mandatoryPolicyBlock('finish-review'), '');
      assertNoContradictoryPolicyClaims(policyRemainder, relativePath);
    }
  },
);

Given('the canonical review contract distribution graph', function (this: ReviewWorld) {
  this.distributionFacet = undefined;
});
When('the {word} distribution facet is inspected', function (this: ReviewWorld, facet: string) {
  this.distributionFacet = facet;
});

function assertCursorPointerTargets(): void {
  const cursorPointers = {
    'packages/cli/templates/commands/finish-review.md':
      'Read and follow the instructions in .safeword/skills/finish-review/SKILL.md',
    'packages/cli/templates/commands/quality-review.md':
      'Read and follow the instructions in .safeword/skills/quality-review/SKILL.md',
    'packages/cli/templates/cursor/rules/safeword-finish-review.mdc':
      '@.safeword/skills/finish-review/SKILL.md',
    'packages/cli/templates/cursor/rules/safeword-quality-reviewing.mdc':
      '@.safeword/skills/quality-review/SKILL.md',
  };
  for (const [relativePath, pointer] of Object.entries(cursorPointers)) {
    assert.ok(readFileSync(nodePath.join(repoRoot, relativePath), 'utf8').includes(pointer));
  }
}

function assertDogfoodContractEdges(): void {
  for (const contract of Object.values(distributedContracts)) {
    const canonical = readFileSync(nodePath.join(repoRoot, contract.canonical), 'utf8');
    for (const relativePath of contract.dogfood) {
      assert.equal(
        readFileSync(nodePath.join(repoRoot, relativePath), 'utf8'),
        canonical,
        relativePath,
      );
    }
  }
}

function assertCursorContractEdges(): void {
  const cursorEdges = Object.values(distributedContracts).flatMap(contract =>
    Object.values(contract.cursor),
  );
  for (const { source, destination } of cursorEdges) {
    assert.equal(
      readFileSync(nodePath.join(repoRoot, destination), 'utf8'),
      readFileSync(nodePath.join(repoRoot, source), 'utf8'),
      destination,
    );
  }
  assertCursorPointerTargets();
}

function generatedReviewAssets(): {
  claudeAssets: ReturnType<typeof generateClaudePluginAssets>;
  codexAssets: ReturnType<typeof generateCodexPluginAssets>;
} {
  const templatesRoot = nodePath.join(repoRoot, 'packages/cli/templates');
  // Pinned like the Claude generator below: the shipped Codex catalogue is
  // built with the CLI version, so comparing against it needs the same input.
  const codexAssets = generateCodexPluginAssets(
    nodePath.join(templatesRoot, 'skills'),
    packageVersion(),
  );
  const claudeAssets = generateClaudePluginAssets({
    cliBundle: readFileSync(nodePath.join(repoRoot, 'plugin/runtime/cli.js'), 'utf8'),
    sourceRoot: nodePath.join(repoRoot, 'packages/cli/src'),
    templatesRoot,
    version: packageVersion(),
  });
  return { claudeAssets, codexAssets };
}

const contractNames = ['finish-review', 'quality-review'];
const expectedClaudeReviewPaths = [
  'skills/finish-review/REVIEWER.md',
  'skills/finish-review/SKILL.md',
  'skills/quality-review/SKILL.md',
];

function assertGeneratedReviewPackages(): void {
  const { claudeAssets, codexAssets } = generatedReviewAssets();
  assert.deepEqual(
    claudeAssets
      .map(asset => asset.relativePath)
      .filter(path => /skills\/(?:finish-review|quality-review)\//u.test(path))
      .toSorted((left, right) => left.localeCompare(right)),
    expectedClaudeReviewPaths,
  );
  assert.deepEqual(
    codexAssets
      .map(asset => asset.relativePath)
      .filter(path => /skills\/(?:finish-review|quality-review)\//u.test(path))
      .toSorted((left, right) => left.localeCompare(right)),
    [
      'skills/finish-review/references/REVIEWER.md',
      'skills/finish-review/SKILL.md',
      'skills/quality-review/SKILL.md',
    ],
  );
  for (const name of contractNames) {
    const relativePath = `skills/${name}/SKILL.md`;
    const codex = codexAssets.find(asset => asset.relativePath === relativePath);
    const claude = claudeAssets.find(asset => asset.relativePath === relativePath);
    assert.equal(
      readFileSync(nodePath.join(repoRoot, 'packages/cli/codex-plugin', relativePath), 'utf8'),
      codex?.content,
    );
    assert.equal(
      readFileSync(nodePath.join(repoRoot, 'plugin', relativePath), 'utf8'),
      claude?.content,
    );
  }
}

function assertReviewInventory(): void {
  const inventory = JSON.parse(
    readFileSync(nodePath.join(repoRoot, 'plugin/inventory.json'), 'utf8'),
  ) as { assets: { path: string; sha256: string }[] };
  assert.deepEqual(
    inventory.assets
      .map(asset => asset.path)
      .filter(path => /skills\/(?:finish-review|quality-review)\//u.test(path))
      .toSorted((left, right) => left.localeCompare(right)),
    expectedClaudeReviewPaths,
  );
  for (const name of contractNames) {
    const relativePath = `skills/${name}/SKILL.md`;
    const content = readFileSync(nodePath.join(repoRoot, 'plugin', relativePath));
    const asset = inventory.assets.find(candidate => candidate.path === relativePath);
    assert.equal(asset?.sha256, createHash('sha256').update(content).digest('hex'), relativePath);
  }
}

function assertReviewManifests(): void {
  const claudeManifest = JSON.parse(
    readFileSync(nodePath.join(repoRoot, 'plugin/.claude-plugin/plugin.json'), 'utf8'),
  ) as { skills?: string[] };
  const codexManifest = JSON.parse(
    readFileSync(
      nodePath.join(repoRoot, 'packages/cli/codex-plugin/.codex-plugin/plugin.json'),
      'utf8',
    ),
  ) as { skills?: string };
  assert.deepEqual(claudeManifest.skills, ['./skills']);
  const claudeSkillsRoot = claudeManifest.skills?.[0];
  assert.ok(claudeSkillsRoot);
  assert.equal(codexManifest.skills, './skills/');
  for (const name of contractNames) {
    const claudeSkill: string = readFileSync(
      nodePath.join(repoRoot, 'plugin', claudeSkillsRoot, name, 'SKILL.md'),
      'utf8',
    );
    const codexSkill: string = readFileSync(
      nodePath.join(
        repoRoot,
        'packages/cli/codex-plugin',
        codexManifest.skills ?? '',
        name,
        'SKILL.md',
      ),
      'utf8',
    );
    assert.ok(claudeSkill.startsWith('---\n'));
    assert.ok(codexSkill.startsWith('---\n'));
    assert.ok(claudeSkill.includes(`\nname: ${name}\n`));
    assert.ok(codexSkill.includes(`\nname: ${name}\n`));
  }
}

function packageVersion(): string {
  const packageContent = readFileSync(nodePath.join(repoRoot, 'packages/cli/package.json'), 'utf8');
  return (JSON.parse(packageContent) as { version: string }).version;
}

function assertInstalledReviewDestinations(): void {
  const expected = {
    '.safeword/skills/finish-review/SKILL.md': 'skills/finish-review/SKILL.md',
    '.safeword/skills/finish-review/REVIEWER.md': 'skills/finish-review/REVIEWER.md',
    '.safeword/skills/quality-review/SKILL.md': 'skills/quality-review/SKILL.md',
    '.claude/skills/finish-review/SKILL.md': 'skills/finish-review/SKILL.md',
    '.claude/skills/finish-review/REVIEWER.md': 'skills/finish-review/REVIEWER.md',
    '.claude/skills/quality-review/SKILL.md': 'skills/quality-review/SKILL.md',
    '.cursor/commands/finish-review.md': 'commands/finish-review.md',
    '.cursor/commands/quality-review.md': 'commands/quality-review.md',
    '.cursor/rules/safeword-finish-review.mdc': 'cursor/rules/safeword-finish-review.mdc',
    '.cursor/rules/safeword-quality-reviewing.mdc': 'cursor/rules/safeword-quality-reviewing.mdc',
  };
  for (const [destination, template] of Object.entries(expected)) {
    assert.equal(SAFEWORD_SCHEMA.ownedFiles[destination]?.template, template, destination);
  }
  const actual = Object.entries(SAFEWORD_SCHEMA.ownedFiles)
    .filter(
      ([, entry]) =>
        entry.template !== undefined &&
        /^(?:skills\/(?:finish-review|quality-review)\/|commands\/(?:finish-review|quality-review)\.md$|cursor\/rules\/safeword-(?:finish-review|quality-reviewing)\.mdc$)/u.test(
          entry.template,
        ),
    )
    .map(([destination]) => destination)
    .toSorted((left, right) => left.localeCompare(right));
  assert.deepEqual(
    actual,
    Object.keys(expected).toSorted((left, right) => left.localeCompare(right)),
  );
}

Then('the {word} distribution facet is current', function (this: ReviewWorld, facet: string) {
  assert.equal(this.distributionFacet, facet);
  switch (facet) {
    case 'dogfood': {
      assertDogfoodContractEdges();
      break;
    }
    case 'cursor': {
      assertCursorContractEdges();
      break;
    }
    case 'generated-packages': {
      assertGeneratedReviewPackages();
      break;
    }
    case 'inventory': {
      assertReviewInventory();
      break;
    }
    case 'manifests': {
      assertReviewManifests();
      break;
    }
    case 'registrations': {
      assertInstalledReviewDestinations();
      break;
    }
    default: {
      assert.fail(`Unknown review distribution facet: ${facet}`);
    }
  }
});
