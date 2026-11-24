import { expect, it } from 'vitest';

import { evaluateElectronReport } from '../../src/review/retrospective-electron-report.js';
import { parseElectronProofRequest } from '../../src/review/retrospective-electron-request.js';

const selection = {
  testFile: 'packages/desktop/tests/electron/89-soul-cased-suffix.electron.spec.ts',
  testLine: 8,
  testFullName:
    ' 89-soul-cased-suffix.electron.spec.ts A differently cased soul suffix opens as a package',
  mutation: {
    expectedFailure: '"revision": 1',
    assertionLocation: 'packages/desktop/tests/electron/89-soul-cased-suffix.electron.spec.ts:39',
  },
};

const request = {
  ...selection,
  ticketId: 'SGWMBS',
  scenario: 'A differently cased soul suffix opens as a package',
  implementationPath: 'packages/desktop/src/renderer/src/services/tabLifecycle.ts',
  mutation: {
    ...selection.mutation,
    before: "...(opened.kind === 'package' ? { package: packageTabState(opened) } : {}),",
    after:
      "...(opened.kind === 'package' && tabPath.endsWith('.soul') ? { package: packageTabState(opened) } : {}),",
  },
  supportFiles: ['packages/desktop/playwright-electron.config.ts'],
};

it('accepts the typed request for one enrolled historical Electron scenario', () => {
  expect(parseElectronProofRequest(request)).toEqual(request);
});

function report() {
  return {
    config: { projects: [{ id: '', name: '', repeatEach: 1, retries: 0 }] },
    suites: [
      {
        title: '89-soul-cased-suffix.electron.spec.ts',
        specs: [
          {
            title: 'A differently cased soul suffix opens as a package',
            file: '89-soul-cased-suffix.electron.spec.ts',
            line: 8,
            tests: [
              {
                projectId: '',
                projectName: '',
                expectedStatus: 'passed',
                status: 'expected',
                annotations: [],
                results: [{ status: 'passed', retry: 0, errors: [], annotations: [] }],
              },
            ],
          },
        ],
        suites: [],
      },
    ],
    errors: [],
    stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 },
  };
}

it('accepts exactly one normal original pass for the declared Electron selection', () => {
  expect(evaluateElectronReport(report(), selection, 'passed', 0)).toEqual({
    exitCode: 0,
    failure: '',
  });
});

interface ReportOverrides {
  report?: Record<string, unknown>;
  project?: Record<string, unknown>;
  suite?: Record<string, unknown>;
  spec?: Record<string, unknown>;
  test?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: Record<string, unknown>;
}

function killedReport(overrides: ReportOverrides = {}) {
  const original = report();
  const suite = original.suites[0];
  const spec = suite?.specs[0];
  const test = spec?.tests[0];
  const result = test?.results[0];
  if (!suite || !spec || !test || !result)
    throw new Error('The original report fixture is incomplete.');
  const failure = `Error: expect(received).toContain(expected)\nExpected substring: ${selection.mutation.expectedFailure}\nReceived string: "{}"\n    at ${selection.mutation.assertionLocation}:3`;
  return {
    ...original,
    config: { projects: [{ ...original.config.projects[0], ...overrides.project }] },
    suites: [
      {
        ...suite,
        specs: [
          {
            ...spec,
            tests: [
              {
                ...test,
                status: 'unexpected',
                results: [
                  {
                    ...result,
                    status: 'failed',
                    errors: [
                      {
                        message: failure,
                        location: {
                          file: `/isolated/source/${selection.testFile}`,
                          line: 39,
                          column: 3,
                        },
                        ...overrides.error,
                      },
                    ],
                    ...overrides.result,
                  },
                ],
                ...overrides.test,
              },
            ],
            ...overrides.spec,
          },
        ],
        ...overrides.suite,
      },
    ],
    stats: { expected: 0, unexpected: 1, skipped: 0, flaky: 0 },
    ...overrides.report,
  };
}

it('accepts one mutant failure at the declared expectation', () => {
  const result = evaluateElectronReport(killedReport(), selection, 'failed', 1);
  expect(result.exitCode).toBe(1);
  expect(result.failure).toContain(selection.mutation.assertionLocation);
  expect(result.failure).toContain(selection.mutation.expectedFailure);
});

// These are characterization checks of the strict evaluator, not claimed new RED runs.
it.each<[string, ReportOverrides]>([
  ['a different test title', { spec: { title: 'another scenario' } }],
  ['a different declaration file', { spec: { file: 'another.electron.spec.ts' } }],
  ['a different declaration line', { spec: { line: 9 } }],
  ['a different project', { test: { projectName: 'other' } }],
  ['an expected failure annotation', { test: { expectedStatus: 'failed' } }],
  ['a skip annotation', { test: { annotations: [{ type: 'skip' }] } }],
  ['a fixme result annotation', { result: { annotations: [{ type: 'fixme' }] } }],
  ['retry recovery', { result: { retry: 1 } }],
  ['configured retries', { project: { retries: 1 } }],
  ['configured repetition', { project: { repeatEach: 2 } }],
  ['a flaky outcome', { test: { status: 'flaky' } }],
  ['a skipped execution', { result: { status: 'skipped' } }],
  ['a global test timeout', { result: { status: 'timedOut' } }],
  ['an interrupted execution', { result: { status: 'interrupted' } }],
  ['a surviving mutation', { result: { status: 'passed' } }],
  ['a global setup error', { report: { errors: [{ message: 'setup failed' }] } }],
  [
    'a different assertion location',
    { error: { location: { file: `/copy/${selection.testFile}`, line: 40 } } },
  ],
  [
    'an uncaught exception',
    { error: { message: `TypeError: broken fixture at ${selection.mutation.assertionLocation}` } },
  ],
  ['no selected tests', { report: { suites: [] } }],
  [
    'multiple selected tests',
    { report: { suites: [...killedReport().suites, ...killedReport().suites] } },
  ],
  ['missing execution results', { test: { results: [] } }],
  ['missing structured errors', { result: { errors: [] } }],
  ['a malformed structured report', { report: { suites: 'not an array' } }],
])('refuses %s as mutation evidence', (_name, overrides) => {
  expect(() => evaluateElectronReport(killedReport(overrides), selection, 'failed', 1)).toThrow(
    /Electron/u,
  );
});

it('accepts matcher wait exhaustion at the exact expectation with expected and received values', () => {
  const failure = `Error: expect(locator).toContainText(expected) failed\nTimeout: 5000ms\nExpected string: ${selection.mutation.expectedFailure}\nReceived string: "{}"\n    at ${selection.mutation.assertionLocation}:3`;
  expect(
    evaluateElectronReport(killedReport({ error: { message: failure } }), selection, 'failed', 1),
  ).toEqual({ exitCode: 1, failure });
});

it.each([0, -1, NaN])('refuses non-failing process status %s for a mutation', exitCode => {
  expect(() => evaluateElectronReport(killedReport(), selection, 'failed', exitCode)).toThrow(
    /Electron/u,
  );
});
