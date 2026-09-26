/**
 * Acceptance proof adapter for 7CAMAD.
 *
 * The implementation already has real installed-CLI, hook, and semantic-review
 * integration tests. This adapter binds each saved feature scenario to the
 * narrow existing proof that owns it instead of duplicating those fixtures in
 * Cucumber. Scenario outlines share one proof run across their example rows.
 */

import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { Before, defineStep } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI_PACKAGE = nodePath.join(PROJECT_ROOT, 'packages/cli');
const FEATURE_PATH = nodePath.join(
  PROJECT_ROOT,
  'features/turn-decisions-into-startable-work.feature',
);
const TIMEOUT_MS = 180_000;

interface Proof {
  readonly expectedTests: number;
  readonly selector: string;
  readonly testFile: string;
}

const proofs: Record<string, Proof> = {
  'Implementation Plan review state controls Execution Planning': {
    expectedTests: 13,
    selector: 'Implementation Plan review admission controls Execution Planning',
    testFile: 'tests/integration/plan-design-approval.test.ts',
  },
  'Review routes preserve their actual provenance': {
    expectedTests: 13,
    selector: 'Implementation Plan review admission controls Execution Planning',
    testFile: 'tests/integration/plan-design-approval.test.ts',
  },
  'An unearned fallback receipt cannot authorize planning': {
    expectedTests: 1,
    selector: 'rejects assurance text that disagrees with the authenticated review',
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
    expectedTests: 6,
    selector:
      'authorizes coding from current project-local reviewed plans|rejects a semantic receipt|reports a semantic receipt|authorizes a permitted fallback|rejects a receipt with no validated|ignores an author-written',
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
    selector: 'rejects a contributor obligation whose required proof is not a real-boundary proof',
    testFile: 'tests/execution-plan/delivery-checklist.test.ts',
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
  'Implementation-time replanning preserves valid progress and refreshes the affected plans': {
    expectedTests: 2,
    selector: 'implementation-time discoveries return to the affected planning phase',
    testFile: 'tests/integration/plan-design-approval.test.ts',
  },
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

const proofCache = new Map<string, Promise<{ exitCode: number; output: string }>>();
let buildPromise: Promise<void> | undefined;

function buildCli(): Promise<void> {
  buildPromise ??= execFileAsync('bun', ['run', 'build'], {
    cwd: CLI_PACKAGE,
    env: { ...process.env, NODE_OPTIONS: undefined },
  }).then(() => undefined);
  return buildPromise;
}

async function runProof(scenarioName: string): Promise<{ exitCode: number; output: string }> {
  const proof = proofs[scenarioName];
  assert.ok(proof, `missing acceptance proof for ${scenarioName}`);
  await buildCli();
  const temporaryDirectory = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-7camad-'));
  const reportPath = nodePath.join(temporaryDirectory, 'report.json');
  try {
    const result = await execFileAsync(
      nodePath.join(CLI_PACKAGE, 'node_modules/.bin/vitest'),
      [
        'run',
        proof.testFile,
        '-t',
        proof.selector,
        '--reporter=json',
        `--outputFile=${reportPath}`,
      ],
      {
        cwd: CLI_PACKAGE,
        env: { ...process.env, NODE_OPTIONS: undefined, TMPDIR: temporaryDirectory },
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { numPassedTests?: number };
    assert.equal(
      report.numPassedTests,
      proof.expectedTests,
      `${scenarioName} selected ${String(report.numPassedTests)} passing tests; expected ${proof.expectedTests}`,
    );
    return { exitCode: 0, output: `${result.stdout}${result.stderr}` };
  } catch (error: unknown) {
    const failure = error as { code?: number; message?: string; stderr?: string; stdout?: string };
    return {
      exitCode: failure.code ?? 1,
      output: failure.stderr || failure.stdout || failure.message || 'acceptance proof failed',
    };
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

const feature = readFileSync(FEATURE_PATH, 'utf8');
const scenarioNames = [...feature.matchAll(/^\s*Scenario(?: Outline)?: (.+)$/gmu)].map(
  match => match[1] as string,
);
assert.deepEqual(Object.keys(proofs).toSorted(), [...new Set(scenarioNames)].toSorted());

Before(
  {
    tags: '@plan-implementability.TBU2.7CAMAD.R1 or @plan-implementability.TBU2.7CAMAD.R2 or @plan-implementability.TBU2.7CAMAD.R3 or @plan-implementability.TBU2.7CAMAD.R4 or @plan-implementability.TBU2.7CAMAD.R5 or @plan-implementability.TBU2.7CAMAD.R6 or @plan-implementability.TBU2.7CAMAD.R7 or @plan-implementability.TBU2.7CAMAD.R8 or @plan-implementability.TBU2.7CAMAD.R9 or @plan-implementability.TBU2.7CAMAD.R10 or @plan-implementability.TBU2.7CAMAD.R11 or @plan-implementability.TBU2.7CAMAD.R12 or @plan-implementability.TBU2.7CAMAD.R13 or @plan-implementability.TBU2.7CAMAD.R14 or @plan-implementability.TBU2.7CAMAD.R15 or @plan-implementability.TBU2.7CAMAD.R16 or @plan-implementability.TBU2.7CAMAD.R17',
    timeout: TIMEOUT_MS,
  },
  async function (this: SafewordWorld, scenario: { pickle: { name: string } }) {
    const scenarioName = scenario.pickle.name;
    proofCache.set(scenarioName, proofCache.get(scenarioName) ?? runProof(scenarioName));
    const result = await proofCache.get(scenarioName)!;
    this.result = { stderr: result.output, stdout: '', exitCode: result.exitCode };
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
for (const stepText of expandedStepTexts(feature)) {
  if (existingSharedSteps.has(stepText)) continue;
  defineStep(stepText, function (this: SafewordWorld) {
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  });
}
