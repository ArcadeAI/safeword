import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { loadBddProofCorpus, runBddProofCorpusOracle } from './fixtures/bdd-proof-corpus/oracle';

interface ReportStep {
  readonly keyword: string;
  readonly result: { readonly status: string; readonly error_message?: string };
}

interface ReportScenario {
  readonly steps: readonly ReportStep[];
  readonly tags: readonly { readonly name: string }[];
}

const defectTag = (mode: string): string => `@defect_mode_${mode.replaceAll('-', '_')}`;
const PROOF_PROCESS_TIMEOUT_MS = 30_000;
const CORPUS_TEST_TIMEOUT_MS =
  loadBddProofCorpus().cases.length * PROOF_PROCESS_TIMEOUT_MS + PROOF_PROCESS_TIMEOUT_MS;

function scenariosFor(
  report: readonly { readonly elements: readonly ReportScenario[] }[],
  tag: string,
) {
  const allScenarios = report.flatMap(item => item.elements);
  return allScenarios.filter(scenario => scenario.tags.some(candidate => candidate.name === tag));
}

function scenariosPassed(scenarios: readonly ReportScenario[]): boolean {
  return (
    scenarios.length > 0 &&
    scenarios.every(
      scenario =>
        scenario.steps.length > 0 && scenario.steps.every(step => step.result.status === 'passed'),
    )
  );
}

function scenariosFailedAtOutcome(scenarios: readonly ReportScenario[]): boolean {
  return (
    scenarios.length > 0 &&
    scenarios.every(scenario => {
      const failedSteps = scenario.steps.filter(step => step.result.status === 'failed');
      return (
        failedSteps.length > 0 &&
        failedSteps.every(
          step =>
            step.keyword.trim() === 'Then' &&
            !step.result.error_message?.includes('defect mode was not injected'),
        )
      );
    })
  );
}

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const corpusTemporaryRoot = nodePath.join(packageRoot, '.test-tmp');
mkdirSync(corpusTemporaryRoot, { recursive: true });

function executeProof(
  feature: string,
  proof: string,
  defectModes: readonly string[],
): {
  readonly baselinePassed: boolean;
  readonly baselineFailedInSetup: boolean;
  readonly defectResults: Readonly<Record<string, boolean>>;
  readonly defectsFailedAtOutcome: Readonly<Record<string, boolean>>;
  readonly exitStatus: number | null;
  readonly exitStatusMatchesReport: boolean;
  readonly output: string;
} {
  const directory = mkdtempSync(nodePath.join(corpusTemporaryRoot, 'bdd-proof-corpus-'));
  try {
    const baselinePath = nodePath.join(directory, 'baseline.feature');
    const stepsPath = nodePath.join(directory, 'steps.ts');
    const harnessPath = nodePath.join(directory, 'harness.ts');
    const configPath = nodePath.join(directory, 'cucumber.mjs');
    const reportPath = nodePath.join(directory, 'report.json');
    writeFileSync(baselinePath, `@baseline\n${feature}`);
    const defectPaths = defectModes.map((mode, index) => {
      const path = nodePath.join(directory, `defect-${index}.feature`);
      writeFileSync(path, `@defect ${defectTag(mode)}\n${feature}`);
      return path;
    });
    writeFileSync(stepsPath, proof);
    writeFileSync(configPath, 'export default {};\n');
    writeFileSync(
      harnessPath,
      `import { Before } from '@cucumber/cucumber';
Before({ tags: '@baseline' }, () => { process.env.BDD_CORPUS_DEFECT = '0'; });
${defectModes
  .map(
    mode =>
      `Before({ tags: '${defectTag(mode)}' }, () => { process.env.BDD_CORPUS_DEFECT = ${JSON.stringify(mode)}; });`,
  )
  .join('\n')}
`,
    );
    const cucumber = nodePath.join(packageRoot, 'node_modules/@cucumber/cucumber/bin/cucumber.js');
    const cli = nodePath.join(packageRoot, 'dist/cli.js');
    if (!existsSync(cli)) throw new Error(`BDD corpus requires built CLI: ${cli}`);
    const execution = spawnSync(
      process.execPath,
      [
        cucumber,
        '--config',
        nodePath.relative(packageRoot, configPath),
        '--import',
        harnessPath,
        '--import',
        stepsPath,
        '--format',
        `json:${reportPath}`,
        baselinePath,
        ...defectPaths,
      ],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        timeout: PROOF_PROCESS_TIMEOUT_MS,
        env: {
          ...process.env,
          BDD_CORPUS_REVIEW_RUNTIME: pathToFileURL(
            nodePath.join(packageRoot, 'src/review/runtime.ts'),
          ).href,
          BDD_CORPUS_REVIEW_ENVIRONMENT: pathToFileURL(
            nodePath.join(packageRoot, 'src/review/environment.ts'),
          ).href,
          BDD_CORPUS_RESULT_RUNTIME: pathToFileURL(
            nodePath.join(packageRoot, 'src/cli-protocol/result.ts'),
          ).href,
          BDD_CORPUS_FIXTURE_RUNNER: pathToFileURL(
            nodePath.join(packageRoot, 'tests/fixtures/bdd-proof-corpus/fixture-runner.ts'),
          ).href,
          BDD_CORPUS_ACTOR_ADAPTER: pathToFileURL(
            nodePath.join(packageRoot, 'tests/fixtures/bdd-proof-corpus/actor-adapter.ts'),
          ).href,
          BDD_CORPUS_PACKAGE_ROOT: packageRoot,
          BDD_CORPUS_CLI: cli,
          // Preserve CI runtime flags while adding the loader required by materialized proof sources.
          NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import tsx`.trim(),
        },
      },
    );
    if (execution.error) throw execution.error;
    const output = `${execution.stdout}\n${execution.stderr}`;
    if (execution.signal) throw new Error(`Cucumber terminated by ${execution.signal}\n${output}`);
    if (!existsSync(reportPath)) throw new Error(output);
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      readonly elements: readonly ReportScenario[];
    }[];
    const baselineScenarios = scenariosFor(report, '@baseline');
    const baselinePassed = scenariosPassed(baselineScenarios);
    const defectResults = Object.fromEntries(
      defectModes.map(mode => [mode, scenariosPassed(scenariosFor(report, defectTag(mode)))]),
    );
    const defectsFailedAtOutcome = Object.fromEntries(
      defectModes.map(mode => [
        mode,
        scenariosFailedAtOutcome(scenariosFor(report, defectTag(mode))),
      ]),
    );
    const reportPassed = baselinePassed && Object.values(defectResults).every(Boolean);
    return {
      baselinePassed,
      baselineFailedInSetup:
        baselineScenarios.length > 0 &&
        baselineScenarios.every(scenario => {
          const hooks = scenario.steps.filter(step => step.keyword.trim() === 'Before');
          const productSteps = scenario.steps.filter(step => step.keyword.trim() !== 'Before');
          return (
            hooks.some(step => step.result.status === 'failed') &&
            productSteps.length > 0 &&
            productSteps.every(step => step.result.status === 'skipped')
          );
        }),
      defectResults,
      defectsFailedAtOutcome,
      exitStatus: execution.status,
      exitStatusMatchesReport:
        execution.status !== null &&
        (reportPassed ? execution.status === 0 : execution.status !== 0),
      output,
    };
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

describe('BDD proof regression corpus (issue #2335)', () => {
  it('loads versioned, deterministic cases with a named verdict and rationale', () => {
    const corpus = loadBddProofCorpus();

    expect(corpus.schemaVersion).toBe(2);
    expect(corpus.cases).toHaveLength(22);
    expect(new Set(corpus.cases.map(testCase => testCase.id)).size).toBe(corpus.cases.length);
    expect(corpus.cases.every(testCase => testCase.reason.length > 20)).toBe(true);
    expect(corpus.cases.every(testCase => testCase.feature.includes('Feature:'))).toBe(true);
    expect(corpus.cases.every(testCase => testCase.proof.includes('@cucumber/cucumber'))).toBe(
      true,
    );
  });

  it('keeps every claimed behavior valid Gherkin', () => {
    const corpus = loadBddProofCorpus();
    const parser = new Parser(
      new AstBuilder(IdGenerator.incrementing()),
      new GherkinClassicTokenMatcher(),
    );

    const featureNames = corpus.cases.map(testCase => parser.parse(testCase.feature).feature?.name);
    expect(featureNames).toHaveLength(22);
    expect(featureNames.every(name => name !== undefined)).toBe(true);
    expect(new Set(featureNames)).toEqual(
      new Set([
        'Review CLI distribution',
        'Refuse an invalid token',
        'Price discounts',
        'Account lifecycle',
        'Publish a package',
        'Live editor activation',
        'Token validation',
        'Shipping quotes',
        'Account isolation',
        'Review result contract',
        'CLI process outcomes',
        'Shared actor adapter contract',
        'Reviewer collaborator protocol',
        'Build source-map provenance',
        'Claude-only fixture isolation',
        'Installed plugin outcome',
        'Hermetic CLI fixture execution',
      ]),
    );
  });

  it('keeps every materialized proof syntactically valid TypeScript', () => {
    const corpus = loadBddProofCorpus();
    for (const testCase of corpus.cases) {
      const result = ts.transpileModule(testCase.proof, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        fileName: `${testCase.id}.steps.ts`,
        reportDiagnostics: true,
      });
      expect(result.diagnostics ?? [], testCase.id).toEqual([]);
    }
  });

  it('balances hollow proofs with neighboring controls', () => {
    const corpus = loadBddProofCorpus();

    expect(corpus.cases.filter(testCase => testCase.expectedVerdict === 'reject')).toHaveLength(11);
    expect(corpus.cases.filter(testCase => testCase.expectedVerdict === 'accept')).toHaveLength(11);
  });

  it('fails the exact historical umbrella-verdict implementation', () => {
    const corpus = loadBddProofCorpus();
    const historicalCase = corpus.cases.find(
      testCase => testCase.id === 'historical-umbrella-verdict',
    );

    expect(historicalCase).toMatchObject({
      expectedVerdict: 'reject',
      pattern: 'umbrella-verdict',
      neighboringValidCase: 'real-cli-exit-code',
      provenance: 'ArcadeAI/safeword#2328-pre-hardening',
    });
  });

  it('requires every regression to name a neighboring valid design', () => {
    const corpus = loadBddProofCorpus();
    const acceptedIds = new Set(
      corpus.cases
        .filter(testCase => testCase.expectedVerdict === 'accept')
        .map(testCase => testCase.id),
    );

    expect(
      corpus.cases
        .filter(testCase => testCase.expectedVerdict === 'reject')
        .map(testCase => testCase.neighboringValidCase)
        .every(control => control !== undefined && acceptedIds.has(control)),
    ).toBe(true);
  });

  it('reports a classifier disagreement as an oracle failure', () => {
    const corpus = loadBddProofCorpus();

    expect(
      runBddProofCorpusOracle(corpus, () => 'accept').failures.map(failure => failure.id),
    ).toEqual([
      'historical-umbrella-verdict',
      'no-op-step',
      'feature-driven-registration',
      'shared-order-dependent-state',
      'setup-failure-as-product-red',
      'simulated-host-as-live-evidence',
      'permissive-reviewer-argv',
      'entrypoint-only-build-freshness',
      'host-state-contamination',
      'success-content-in-failure-envelope',
      'direct-cli-fixture-bypass',
    ]);
  });

  it(
    'executes every proof and distinguishes an injected defect',
    () => {
      const corpus = loadBddProofCorpus();

      const result = runBddProofCorpusOracle(corpus, testCase => {
        const execution = executeProof(testCase.feature, testCase.proof, testCase.defectModes);
        expect(execution.exitStatusMatchesReport, `${testCase.id}\n${execution.output}`).toBe(true);
        if (testCase.baselineFailure === 'setup') {
          expect(execution.baselinePassed, `${testCase.id}\n${execution.output}`).toBe(false);
          expect(execution.baselineFailedInSetup, `${testCase.id}\n${execution.output}`).toBe(true);
          expect(execution.exitStatus, `${testCase.id}\n${execution.output}`).not.toBe(0);
          return 'reject';
        }
        expect(execution.baselinePassed, `${testCase.id}\n${execution.output}`).toBe(true);
        return Object.entries(execution.defectResults).every(
          ([mode, passed]) => !passed && execution.defectsFailedAtOutcome[mode],
        )
          ? 'accept'
          : 'reject';
      });

      expect(result).toEqual({ passed: 22, failures: [] });
    },
    CORPUS_TEST_TIMEOUT_MS,
  );

  it('pairs every #2328 regression with a trustworthy boundary control', () => {
    const corpus = loadBddProofCorpus();
    const cases = new Map(corpus.cases.map(testCase => [testCase.id, testCase]));

    expect(
      [
        'permissive-reviewer-argv',
        'entrypoint-only-build-freshness',
        'host-state-contamination',
        'success-content-in-failure-envelope',
        'direct-cli-fixture-bypass',
      ].map(id => {
        const testCase = cases.get(id);
        return [id, testCase?.expectedVerdict, testCase?.neighboringValidCase];
      }),
    ).toEqual([
      ['permissive-reviewer-argv', 'reject', 'exact-reviewer-argv'],
      ['entrypoint-only-build-freshness', 'reject', 'complete-build-freshness'],
      ['host-state-contamination', 'reject', 'sanitized-agent-scoped-host'],
      ['success-content-in-failure-envelope', 'reject', 'typed-success-before-content'],
      ['direct-cli-fixture-bypass', 'reject', 'approved-fixture-runner'],
    ]);
  });
});
