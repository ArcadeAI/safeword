/**
 * Acceptance proof adapter for execution planning and PR slicing.
 *
 * The implementation already has real installed-CLI, hook, and semantic-review
 * integration tests. This adapter binds each saved feature scenario to the
 * existing proof that owns it instead of duplicating those fixtures in
 * Cucumber. Reviewer-semantic scenarios share one opt-in live conformance run;
 * corpus-shape checks cannot establish their semantic verdicts.
 */

import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { Before, defineStep } from '@cucumber/cucumber';

import { EXECUTION_PLAN_CONFORMANCE_CASES } from '../packages/cli/src/review/execution-plan-conformance.js';
import { reviewTimeoutMilliseconds } from '../packages/cli/src/review/runtime.js';

import { EXECUTION_PLAN_SLICING_CASES } from '../packages/cli/tests/fixtures/execution-plan-slicing-cases.js';

import type { SafewordWorld } from './world.js';

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI_PACKAGE = nodePath.join(PROJECT_ROOT, 'packages/cli');
const FEATURE_PATH = nodePath.join(
  PROJECT_ROOT,
  'features/turn-decisions-into-startable-work.feature',
);
const SLICING_FEATURE_PATH = nodePath.join(
  PROJECT_ROOT,
  'features/split-large-contributions-into-reviewable-prs.feature',
);
const TIMEOUT_MS =
  EXECUTION_PLAN_CONFORMANCE_CASES.length * (reviewTimeoutMilliseconds({}) + 60_000) + 180_000;

interface Proof {
  readonly expectedTests: number;
  readonly selector: string;
  readonly testFile: string;
  readonly supporting?: Proof;
}

const repairRecoveryProof: Proof = {
  expectedTests: 8,
  selector: 'routes .* repair to .* through the installed CLI',
  testFile: 'tests/integration/plan-design-approval.test.ts',
};

const LIVE_PROOF_FILE = 'tests/smoke/execution-plan.live.test.ts';

function semanticProof(...caseIds: string[]): Proof {
  for (const id of caseIds) {
    assert.ok(
      EXECUTION_PLAN_SLICING_CASES.some(testCase => testCase.id === id),
      `Unknown semantic case: ${id}`,
    );
  }
  return {
    expectedTests: caseIds.length + 1,
    selector: `requires one explicit reviewer identity and evidence destination|(?:^| )(?:${caseIds.join('|')})$`,
    testFile: LIVE_PROOF_FILE,
  };
}

const checklistSemanticScenario =
  'Applicable contributor work cannot be dismissed as not applicable';
const checklistSemanticSteps = [
  'an applicable test obligation is required by the accepted proof boundary',
  'Safeword reviews a checklist that marks the obligation as not applicable through the installed CLI',
  'the not-applicable disposition is rejected, the test obligation remains open, and the response names the accepted proof boundary',
  'a contribution contains several independently provable changes and its checklist has no pull-request slicing decision',
  'Safeword reviews the Execution Plan through the installed CLI',
  'the plan is denied, the item remains open, and the missing pull-request slicing decision is named with one concrete action to record it',
  'a contribution contains several dependency-ordered independently provable changes',
  'a contribution contains one coherent independently provable change',
  'Safeword completes its work-decomposition checklist item through the installed CLI',
  'the checklist references the coherent pull-request slices defined by the Execution Plan',
  'the checklist records one pull request and why another split would add no review value',
];

const proofs: Record<string, Proof> = {
  [checklistSemanticScenario]: semanticProof('dismissed-applicable-work'),
  'A large contribution cannot leave PR slicing unresolved': {
    ...semanticProof('omitted-slicing-decision'),
    supporting: {
      expectedTests: 1,
      selector: 'guides the author to record an unresolved pull-request slicing decision',
      testFile: 'tests/cli-protocol/review-wiring.test.ts',
    },
  },
  'The checklist records the appropriate PR-slicing outcome': {
    ...semanticProof('one-coherent-change', 'several-ordered-changes'),
    supporting: {
      expectedTests: 2,
      selector: 'returns the reviewed .* slicing outcome when its checklist item is completed',
      testFile: 'tests/integration/delivery-execution-prerequisite.test.ts',
    },
  },
  'Contribution shape produces an explicit slicing decision': semanticProof(
    'one-coherent-change',
    'several-ordered-changes',
  ),
  'An omitted slicing decision cannot pass Execution Plan review': semanticProof(
    'omitted-slicing-decision',
  ),
  'Installed review dispatch carries the canonical slicing contract': {
    expectedTests: 1,
    selector:
      'activates Execution Plan review only for a ticket-owned plan through an admitted route',
    testFile: 'tests/cli-protocol/review-wiring.test.ts',
  },
  'A complete pull-request slice receives a complete review record':
    semanticProof('complete-slice-record'),
  'An incomplete pull-request slice is rejected': semanticProof(
    'missing-purpose',
    'missing-boundary',
    'missing-prerequisites',
    'missing-proof',
    'missing-completion-signal',
  ),
  'A pull-request slice with two independent purposes is rejected': semanticProof(
    'two-independent-purposes',
  ),
  'A formally complete slice cannot leave a design decision to its implementer': semanticProof(
    'missing-authorization-ownership',
  ),
  'Ordered slices preserve a supported repository after every merge': semanticProof(
    'ordered-schema-before-reader',
  ),
  'A slice that becomes safe only after a later merge is rejected': semanticProof(
    'unsafe-intermediate-merge',
  ),
  'Conceptual scope determines reviewable slicing': semanticProof(
    'many-mechanical-edits',
    'few-files-two-outcomes',
  ),
  'Size counts alone cannot justify a slicing decision': semanticProof(
    'line-count-only-rationale',
    'file-count-only-rationale',
  ),
  'Accepted obligations remain assigned across pull-request slices': semanticProof(
    'all-obligations-assigned',
  ),
  'Accepted decisions remain unchanged across pull-request slices':
    semanticProof('all-decisions-unchanged'),
  'A slicing plan cannot discard an accepted obligation': semanticProof(
    'missing-behavior-obligation',
    'missing-migration-obligation',
    'missing-rollout-obligation',
    'missing-rollback-obligation',
    'missing-documentation-obligation',
    'missing-affected-surface-obligation',
  ),
  'A pull-request slice cannot rewrite an accepted approach decision': semanticProof(
    'reopened-authorization-decision',
  ),

  'Repeating approval cannot clear a recorded design repair': repairRecoveryProof,
  'Fresh review can recover an unchanged approach without inventing human authority':
    repairRecoveryProof,
  'Implementation Plan review state controls Execution Planning': {
    expectedTests: 14,
    selector:
      'Implementation Plan review admission controls Execution Planning|settles headless work as pending without prompting or changing phase',
    testFile: 'tests/integration/plan-design-approval.test.ts',
  },
  'Review routes preserve their actual provenance': {
    expectedTests: 13,
    selector: 'Implementation Plan review admission controls Execution Planning',
    testFile: 'tests/integration/plan-design-approval.test.ts',
  },
  'An unearned fallback receipt cannot authorize planning': {
    expectedTests: 1,
    selector: 'rejects an approving receipt with no achieved independence',
    testFile: 'tests/integration/plan-design-approval.test.ts',
  },
  'A self-authored independence claim cannot authorize planning': {
    expectedTests: 1,
    selector: 'rejects a self-authored cross-agent claim',
    testFile: 'tests/integration/plan-design-approval.test.ts',
  },
  'A fresh-context agent turns an accepted approach into the first RED': {
    expectedTests: 1,
    selector:
      'rejects an unstartable fourth step through the installed CLI, then reaches the named RED',
    testFile: 'tests/integration/plan-execution-journey.test.ts',
  },
  'A later unstartable step blocks an otherwise startable plan': {
    expectedTests: 1,
    selector:
      'rejects an unstartable fourth step through the installed CLI, then reaches the named RED',
    testFile: 'tests/integration/plan-execution-journey.test.ts',
  },
  'First-step availability and ordering control startability': {
    expectedTests: 4,
    selector:
      'keeps (blocked-first-prerequisite|no-executable-steps|risk-first-ordering|parallel-safe-after-probe)',
    testFile: 'tests/review/execution-plan-conformance.test.ts',
  },
  'Review-contract identity controls semantic approval': {
    expectedTests: 12,
    selector: 'Execution Plan review-contract identity',
    testFile: 'tests/review/execution-plan-contract-identity.test.ts',
  },
  'A discovered change returns only when it alters an accepted decision': {
    expectedTests: 2,
    selector:
      'keeps every authoritative scenario example|writes evidence only after every case passes',
    testFile: 'tests/review/execution-plan-conformance.test.ts',
  },
  'Project-local Execution Plan state controls coding authorization': {
    expectedTests: 3,
    selector:
      'rejects host-local notes|authorizes coding from current project-local reviewed plans|rejects stale project-local plans',
    testFile: 'tests/integration/coding-authorization.test.ts',
  },
  'A missing project-local plan names the project-local artifact to create': {
    expectedTests: 1,
    selector: 'rejects host-local notes when the project-local Execution Plan is missing',
    testFile: 'tests/integration/coding-authorization.test.ts',
  },
  'Decision specificity controls semantic approval': {
    expectedTests: 4,
    selector:
      'data-decision specificity case|keeps unresolved authorization as a named denial case',
    testFile: 'tests/review/execution-plan-conformance.test.ts',
  },
  'The structural gate reports artifact facts without a semantic verdict': {
    expectedTests: 4,
    selector: 'reports structural facts',
    testFile: 'tests/integration/delivery-execution-prerequisite.test.ts',
  },
  'Concrete proof content controls test-step startability': {
    expectedTests: 1,
    selector: 'reviews concrete proof steps through the installed CLI',
    testFile: 'tests/integration/plan-execution-journey.test.ts',
  },
  'Execution Plan currency controls coding authorization': {
    expectedTests: 1,
    selector: 'identifies every stable authorization input but ignores checklist progress',
    testFile: 'tests/integration/coding-authorization.test.ts',
  },
  'Execution Plan verdict and recorded assurance control coding authorization': {
    expectedTests: 7,
    selector:
      'authorizes coding from current project-local reviewed plans|rejects a semantic receipt|reports a semantic receipt|authorizes a permitted fallback|rejects a receipt with no validated|ignores an author-written|limits an approved result to coding authorization',
    testFile: 'tests/integration/coding-authorization.test.ts',
  },
  'Every accepted obligation must map to startable work': {
    expectedTests: 8,
    selector: 'named missing-obligation denial',
    testFile: 'tests/review/execution-plan-conformance.test.ts',
  },
  'Partial obligation mapping is not startable': {
    expectedTests: 2,
    selector: 'partial obligation-mapping denial',
    testFile: 'tests/review/execution-plan-conformance.test.ts',
  },
  'Complete obligation mapping permits semantic approval': {
    expectedTests: 1,
    selector: 'keeps complete obligation ownership as an approval case',
    testFile: 'tests/review/execution-plan-conformance.test.ts',
  },
  'Explicitly inapplicable obligations do not manufacture execution work': {
    expectedTests: 1,
    selector: 'keeps explicitly inapplicable optional work out of the execution plan',
    testFile: 'tests/review/execution-plan-conformance.test.ts',
  },
  'An execution step still proceeds through RED GREEN and REFACTOR': {
    expectedTests: 1,
    selector:
      'rejects an unstartable fourth step through the installed CLI, then reaches the named RED',
    testFile: 'tests/integration/plan-execution-journey.test.ts',
  },
  'Production code cannot precede the named RED': {
    expectedTests: 1,
    selector: 'reports the named RED after the public coding-authorization command authorizes it',
    testFile: 'tests/integration/coding-authorization-hook.test.ts',
  },
  'Evidence state controls the delivery claim': {
    expectedTests: 5,
    selector: 'current-to-target truthfulness case',
    testFile: 'tests/review/execution-plan-conformance.test.ts',
  },
  'Delivery evidence uses the canonical checklist taxonomy': {
    expectedTests: 2,
    selector: 'records retained proof and immediately reports|keeps supporting proof narrow',
    testFile: 'tests/integration/delivery-checklist-cli.test.ts',
  },
  'Canonical delivery-contract identity prevents local contract drift': {
    expectedTests: 2,
    selector: 'blocks stale-delivery-taxonomy|allows the packaged canonical pair',
    testFile: 'tests/review/execution-plan-contract-identity.test.ts',
  },
  'Partial structural evidence cannot authorize completion': {
    expectedTests: 1,
    selector: 'keeps structural proof incomplete through the installed CLI',
    testFile: 'tests/integration/coding-authorization.test.ts',
  },
  'The Execution Plan maps delivery obligations into owned review units': {
    expectedTests: 1,
    selector: 'keeps complete obligation ownership as an approval case',
    testFile: 'tests/review/execution-plan-conformance.test.ts',
  },
  'Canonical slicing-contract identity prevents local contract drift': {
    expectedTests: 2,
    selector: 'blocks stale-slicing-contract|allows the packaged canonical pair',
    testFile: 'tests/review/execution-plan-contract-identity.test.ts',
  },
  'Contribution shape controls pull-request decomposition': {
    expectedTests: 2,
    selector: 'records an explicit slicing outcome',
    testFile: 'tests/review/execution-plan-conformance.test.ts',
  },
  'A complete-looking task list cannot leave delivery obligations unowned': {
    expectedTests: 8,
    selector: 'named missing-obligation denial',
    testFile: 'tests/review/execution-plan-conformance.test.ts',
  },
  'Execution approval cannot impersonate a downstream approval': {
    expectedTests: 1,
    selector: 'limits an approved result to coding authorization without downstream authority',
    testFile: 'tests/integration/coding-authorization.test.ts',
  },
  'Measurement execution preserves the accepted promise and validity contract': {
    expectedTests: 2,
    selector:
      'keeps every authoritative scenario example|writes evidence only after every case passes',
    testFile: 'tests/review/execution-plan-conformance.test.ts',
  },
  'Review invalidation follows dependency direction': {
    expectedTests: 1,
    selector: 'identifies every stable authorization input but ignores checklist progress',
    testFile: 'tests/integration/coding-authorization.test.ts',
  },
  'An Execution Plan cannot stay current after its source approach changes': {
    expectedTests: 1,
    selector:
      'keeps coding blocked until a changed source approach and its execution plan are re-reviewed',
    testFile: 'tests/integration/coding-authorization.test.ts',
  },
  'Implementation-time replanning preserves valid progress and refreshes the affected plans':
    repairRecoveryProof,
  'Replanning reopens proof invalidated by the changed decision': {
    expectedTests: 1,
    selector:
      'reopens proof invalidated by a changed authorization contract and retains its audit receipt',
    testFile: 'tests/integration/delivery-checklist-cli.test.ts',
  },
  'Implementation cannot continue under a stale affected plan': {
    expectedTests: 1,
    selector: 'blocks production work under a stale affected plan and names plan repair first',
    testFile: 'tests/integration/coding-authorization-hook.test.ts',
  },
};

const completedProofs = new WeakSet<SafewordWorld>();
const proofCache = new Map<string, Promise<{ exitCode: number; output: string }>>();
let buildPromise: Promise<void> | undefined;

function cachedProof(
  key: string,
  scenarioName: string,
  liveSemantic = false,
): Promise<{ exitCode: number; output: string }> {
  proofCache.set(key, proofCache.get(key) ?? runProof(scenarioName, liveSemantic));
  return proofCache.get(key)!;
}

function buildCli(): Promise<void> {
  buildPromise ??= execFileAsync('bun', ['run', 'build'], {
    cwd: CLI_PACKAGE,
    env: { ...process.env, NODE_OPTIONS: undefined },
  }).then(() => undefined);
  return buildPromise;
}

async function runProof(
  scenarioName: string,
  liveSemantic = false,
  selectedProof = proofs[scenarioName],
): Promise<{ exitCode: number; output: string }> {
  let proof = selectedProof;
  assert.ok(proof, `missing acceptance proof for ${scenarioName}`);
  const acceptance = proof.testFile === LIVE_PROOF_FILE;
  const semantic = liveSemantic || acceptance;
  if (semantic) {
    assert.equal(
      process.env.SAFEWORD_RUN_EXECUTION_PLAN_LIVE,
      '1',
      'Semantic acceptance requires SAFEWORD_RUN_EXECUTION_PLAN_LIVE=1; corpus shape is supporting evidence only.',
    );
    if (proof.testFile !== LIVE_PROOF_FILE)
      proof = {
        expectedTests: EXECUTION_PLAN_CONFORMANCE_CASES.length + 1,
        selector: 'live Execution Plan semantic conformance',
        testFile: 'tests/smoke/execution-plan.live.test.ts',
      };
  }
  await buildCli();
  const temporaryDirectory = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-7camad-'));
  const reportPath = nodePath.join(temporaryDirectory, 'report.json');
  const retainedDirectory = nodePath.join(PROJECT_ROOT, '.safeword/logs');
  if (semantic) mkdirSync(retainedDirectory, { recursive: true });
  const semanticResultsPath = nodePath.join(
    retainedDirectory,
    `4200-execution-plan-${nodePath.basename(temporaryDirectory)}.json`,
  );
  try {
    const result = await execFileAsync(
      process.execPath,
      [
        'scripts/run-vitest-with-build-lock.mjs',
        ...(semantic ? ['--config', 'vitest.live.config.ts'] : []),
        proof.testFile,
        '-t',
        proof.selector,
        '--reporter=json',
        `--outputFile=${reportPath}`,
      ],
      {
        cwd: CLI_PACKAGE,
        env: {
          ...process.env,
          NODE_OPTIONS: undefined,
          ...(semantic && {
            SAFEWORD_EXECUTION_PLAN_ACCEPTANCE: acceptance ? '1' : undefined,
            SAFEWORD_EXECUTION_PLAN_LIVE_CLI: '1',
            SAFEWORD_EXECUTION_PLAN_LIVE_REVIEWER:
              process.env.SAFEWORD_EXECUTION_PLAN_LIVE_REVIEWER ?? 'claude',
            SAFEWORD_EXECUTION_PLAN_LIVE_MODEL:
              process.env.SAFEWORD_EXECUTION_PLAN_LIVE_MODEL ?? 'opus',
            SAFEWORD_EXECUTION_PLAN_RESULTS_PATH: semanticResultsPath,
          }),
        },
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      numPassedTests?: number;
      numPendingTests?: number;
      testResults: { assertionResults: { fullName: string; status: string }[] }[];
    };
    if (semantic) {
      const selected = report.testResults
        .flatMap(file => file.assertionResults)
        .filter(test => new RegExp(proof.selector, 'u').test(test.fullName));
      assert.equal(
        selected.length,
        proof.expectedTests,
        'Every selected semantic case must be reported.',
      );
      assert.ok(
        selected.every(test => test.status === 'passed'),
        'Selected live semantic cases must pass, not skip.',
      );
    }
    assert.equal(
      report.numPassedTests,
      proof.expectedTests,
      `${scenarioName} selected ${String(report.numPassedTests)} passing tests; expected ${proof.expectedTests}`,
    );
    if (proof.supporting !== undefined) {
      const support = await runProof(scenarioName, false, proof.supporting);
      if (support.exitCode !== 0) return support;
    }
    return { exitCode: 0, output: `${result.stdout}${result.stderr}` };
  } catch (error: unknown) {
    const failure = error as {
      code?: number | string;
      message?: string;
      stderr?: string;
      stdout?: string;
    };
    return {
      exitCode: typeof failure.code === 'number' ? failure.code : 1,
      output: [
        failure.message ?? 'acceptance proof failed',
        failure.stdout,
        failure.stderr,
        ...(existsSync(reportPath) ? [readFileSync(reportPath, 'utf8')] : []),
      ]
        .filter(Boolean)
        .join('\n'),
    };
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

const featureSources = [FEATURE_PATH, SLICING_FEATURE_PATH].map(path => readFileSync(path, 'utf8'));
const scenarioNames = featureSources.flatMap(feature =>
  [...feature.matchAll(/^\s*Scenario(?: Outline)?: (.+)$/gmu)].map(match => match[1] as string),
);
assert.deepEqual(
  Object.keys(proofs).toSorted(),
  [
    ...new Set([
      ...scenarioNames,
      checklistSemanticScenario,
      'A large contribution cannot leave PR slicing unresolved',
      'The checklist records the appropriate PR-slicing outcome',
    ]),
  ].toSorted(),
);

Before(
  {
    tags: '@plan-implementability.TBU2.7CAMAD.R1 or @plan-implementability.TBU2.7CAMAD.R2 or @plan-implementability.TBU2.7CAMAD.R3 or @plan-implementability.TBU2.7CAMAD.R4 or @plan-implementability.TBU2.7CAMAD.R5 or @plan-implementability.TBU2.7CAMAD.R6 or @plan-implementability.TBU2.7CAMAD.R7 or @plan-implementability.TBU2.7CAMAD.R8 or @plan-implementability.TBU2.7CAMAD.R9 or @plan-implementability.TBU2.7CAMAD.R10 or @plan-implementability.TBU2.7CAMAD.R11 or @plan-implementability.TBU2.7CAMAD.R12 or @plan-implementability.TBU2.7CAMAD.R13 or @plan-implementability.TBU2.7CAMAD.R14 or @plan-implementability.TBU2.7CAMAD.R15 or @plan-implementability.TBU2.7CAMAD.R16 or @plan-implementability.TBU2.7CAMAD.R17 or @plan-implementability.TBU2.6XW8H7.R1 or @execution-plan-semantic',
    timeout: TIMEOUT_MS,
  },
  async function (
    this: SafewordWorld,
    scenario: { pickle: { name: string; tags: { name: string }[] } },
  ) {
    const scenarioName = scenario.pickle.name;
    const proof = proofs[scenarioName];
    assert.ok(proof, `missing acceptance proof for ${scenarioName}`);
    if (proof.testFile === LIVE_PROOF_FILE) {
      // Supporting checks are part of the proof identity, even with the same live selector.
      const key = JSON.stringify(proof);
      const result = await cachedProof(key, scenarioName, true);
      this.result = { stderr: result.output, stdout: '', exitCode: result.exitCode };
      completedProofs.add(this);
      return;
    }
    const corpusProof = proof.testFile === 'tests/review/execution-plan-conformance.test.ts';
    const live = corpusProof || scenario.pickle.tags.some(tag => tag.name === '@live');
    if (live) {
      const key = 'live-execution-plan-conformance';
      const result = await cachedProof(key, scenarioName, true);
      this.result = { stderr: result.output, stdout: '', exitCode: result.exitCode };
      completedProofs.add(this);
      if (result.exitCode !== 0) return;
    }
    // Supporting checks are part of the proof identity, even with the same live selector.
    const key = JSON.stringify(proof);
    const result = await cachedProof(key, scenarioName);
    this.result = { stderr: result.output, stdout: '', exitCode: result.exitCode };
    completedProofs.add(this);
  },
);

function expandedStepTexts(source: string): Set<string> {
  const expanded = new Set<string>();
  let outlineSteps: string[] | undefined;
  let exampleHeadings: string[] | undefined;

  for (const line of source.split(/\r?\n/u)) {
    if (/^\s*Scenario Outline:/u.test(line)) {
      outlineSteps = [];
      exampleHeadings = undefined;
      continue;
    }
    if (/^\s*Scenario:/u.test(line)) {
      outlineSteps = undefined;
      exampleHeadings = undefined;
      continue;
    }
    const step = /^\s*(?:Given|When|Then|And|But) (.+)$/u.exec(line)?.[1];
    if (step !== undefined) {
      if (outlineSteps === undefined) expanded.add(step);
      else outlineSteps.push(step);
      continue;
    }
    if (outlineSteps === undefined) continue;
    const cells = /^\s*\|(.+)\|\s*$/u
      .exec(line)?.[1]
      ?.split('|')
      .map(cell => cell.trim());
    if (cells === undefined) continue;
    if (exampleHeadings === undefined) {
      exampleHeadings = cells;
      continue;
    }
    for (const template of outlineSteps) {
      expanded.add(
        exampleHeadings.reduce(
          (text, heading, index) => text.replaceAll(`<${heading}>`, cells[index] ?? ''),
          template,
        ),
      );
    }
  }
  return expanded;
}

const existingSharedSteps = new Set(['the workflow enters Execution Planning']);
for (const stepText of new Set([
  ...featureSources.flatMap(feature => [...expandedStepTexts(feature)]),
  ...checklistSemanticSteps,
])) {
  if (existingSharedSteps.has(stepText)) continue;
  const literalStep = new RegExp(`^${stepText.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u');
  defineStep(literalStep, function (this: SafewordWorld) {
    assert.ok(completedProofs.has(this), 'acceptance proof was not run');
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  });
}
