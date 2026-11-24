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

it('identifies an unsupported live-build field without exposing its value', () => {
  const parse = () => parseElectronProofRequest({ ...request, build: '/live/private-build' });
  expect(parse).toThrow(/unsupported fields:.*build/u);
  expect(parse).not.toThrow(/private-build/u);
});

it('refuses an enrolled scenario paired with a different scenario test title', () => {
  expect(() =>
    parseElectronProofRequest({ ...request, scenario: 'Ordinary folders remain folders' }),
  ).toThrow(/Electron/u);
});

it('refuses nested test paths outside the enrolled flat Electron suite', () => {
  const testFile = request.testFile.replace('/electron/', '/electron/nested/');
  expect(() =>
    parseElectronProofRequest({
      ...request,
      testFile,
      mutation: { ...request.mutation, assertionLocation: `${testFile}:39` },
    }),
  ).toThrow(/Electron/u);
});

it.each<[string, unknown]>([
  ['another ticket', { ...request, ticketId: 'OTHER1' }],
  ['an unenrolled scenario', { ...request, scenario: 'New unreviewed behavior' }],
  ['an arbitrary command', { ...request, argv: ['sh', '-c', 'true'] }],
  ['an arbitrary working directory', { ...request, cwd: '/tmp' }],
  ['an author-selected runner', { ...request, runner: 'custom' }],
  ['a live build request', { ...request, build: '/live/dist' }],
  ['source traversal', { ...request, implementationPath: 'packages/desktop/src/../outside.ts' }],
  ['an absolute source path', { ...request, implementationPath: '/tmp/source.ts' }],
  ['a non-production mutation', { ...request, implementationPath: request.testFile }],
  ['a different test kind', { ...request, testFile: 'packages/desktop/tests/unit.test.ts' }],
  ['an ambiguous test declaration', { ...request, testLine: 0 }],
  ['a string test declaration', { ...request, testLine: '8' }],
  [
    'a foreign assertion',
    { ...request, mutation: { ...request.mutation, assertionLocation: 'other.ts:39' } },
  ],
  [
    'an unchanged mutation',
    { ...request, mutation: { ...request.mutation, after: request.mutation.before } },
  ],
  ['an empty mutation anchor', { ...request, mutation: { ...request.mutation, before: '' } }],
  [
    'an empty failure expectation',
    { ...request, mutation: { ...request.mutation, expectedFailure: ' ' } },
  ],
  ['an extra mutation command', { ...request, mutation: { ...request.mutation, command: 'true' } }],
  ['missing support inputs', { ...request, supportFiles: [] }],
  [
    'duplicate support inputs',
    { ...request, supportFiles: [...request.supportFiles, ...request.supportFiles] },
  ],
  ['an escaping support input', { ...request, supportFiles: ['../outside'] }],
  [
    'a control character in a support path',
    { ...request, supportFiles: ['packages/desktop/config\n.ts'] },
  ],
  // eslint-disable-next-line unicorn/no-null -- JSON null is an actual untyped request input.
  ['an untyped request', null],
])('refuses %s before preparing executable snapshots', (_name, input) => {
  expect(() => parseElectronProofRequest(input)).toThrow(/Electron/u);
});

function report(overrides: ReportOverrides = {}) {
  return {
    config: { projects: [{ id: '', name: '', repeatEach: 1, retries: 0, ...overrides.project }] },
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
                results: [
                  { status: 'passed', retry: 0, errors: [], annotations: [], ...overrides.result },
                ],
                ...overrides.test,
              },
            ],
            ...overrides.spec,
          },
        ],
        suites: [],
        ...overrides.suite,
      },
    ],
    errors: [],
    stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 },
    ...overrides.report,
  };
}

it('accepts exactly one normal original pass for the declared Electron selection', () => {
  expect(evaluateElectronReport(report(), selection, 'passed', 0)).toEqual({
    exitCode: 0,
    failure: '',
  });
});

it('identifies a global renderer port failure even when no selected test could start', () => {
  const setupFailure = report({
    report: { suites: [], errors: [{ message: 'Renderer EADDRINUSE at the owned test port' }] },
  });
  expect(() => evaluateElectronReport(setupFailure, selection, 'passed', 1)).toThrow(/EADDRINUSE/u);
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

const declaredFailure = `Error: expect(received).toContain(expected)\nExpected substring: ${selection.mutation.expectedFailure}\nReceived string: "{}"\n    at ${selection.mutation.assertionLocation}:3`;

function killedReport(overrides: ReportOverrides = {}) {
  const original = report();
  const suite = original.suites[0];
  const spec = suite?.specs[0];
  const test = spec?.tests[0];
  const result = test?.results[0];
  if (!suite || !spec || !test || !result)
    throw new Error('The original report fixture is incomplete.');
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
                        message: declaredFailure,
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

it('normalizes terminal colors inside a declared Playwright matcher failure', () => {
  const escape = String.fromCodePoint(27);
  const failure = declaredFailure
    .replace('expect(received).', () => `expect(${escape}[31mreceived${escape}[39m).${escape}[22m`)
    .replace('Expected substring:', () => `${escape}[32mExpected substring:${escape}[39m`)
    .replace('Received string:', () => `${escape}[31mReceived string:${escape}[39m`);
  expect(
    evaluateElectronReport(killedReport({ error: { message: failure } }), selection, 'failed', 1),
  ).toEqual({ exitCode: 1, failure: declaredFailure });
});

it('includes the actual refused matcher message in its diagnostic', () => {
  const failure = declaredFailure.replace(
    selection.mutation.expectedFailure,
    'a different expected value',
  );
  expect(() =>
    evaluateElectronReport(killedReport({ error: { message: failure } }), selection, 'failed', 1),
  ).toThrow(failure);
});

it('accepts the object-difference format emitted by the locked Playwright equality matcher', () => {
  // Captured from a standalone @playwright/test 1.62.1 expect(...).toEqual(...)
  // call. This is formatter-contract evidence, not an Electron mutation run.
  const failure = [
    'Error: expect(received).toEqual(expected) // deep equality',
    '',
    '- Expected  - 3',
    '+ Received  + 1',
    '',
    '  Object {',
    '-   "package": Object {',
    '-     "revision": 1,',
    '-   },',
    '+   "package": undefined,',
    '  }',
    `    at ${selection.mutation.assertionLocation}:3`,
  ].join('\n');
  expect(
    evaluateElectronReport(killedReport({ error: { message: failure } }), selection, 'failed', 1),
  ).toEqual({ exitCode: 1, failure });
});

// These are characterization checks of the strict evaluator, not claimed new RED runs.
it.each<[string, ReportOverrides]>([
  [
    'a different expected value',
    {
      error: {
        message: declaredFailure.replace(
          selection.mutation.expectedFailure,
          'another expected value',
        ),
      },
    },
  ],
  [
    'a foreign assertion file at the declared line',
    { error: { location: { file: '/isolated/helper.ts', line: 39, column: 3 } } },
  ],
  [
    'a message without the declared location',
    {
      error: {
        message: declaredFailure.replace(selection.mutation.assertionLocation, 'helper.ts:39'),
      },
    },
  ],
  [
    'a message without an expectation header',
    {
      error: {
        message: declaredFailure.replace(
          'expect(received).toContain(expected)',
          'package operation',
        ),
      },
    },
  ],
  [
    'a message without an expected-value label',
    { error: { message: declaredFailure.replace('Expected substring:', 'Wanted substring:') } },
  ],
  [
    'a message without a received-value label',
    { error: { message: declaredFailure.replace('Received string:', 'Observed string:') } },
  ],
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

it.each<[string, ReportOverrides, number]>([
  ['a failed result', { result: { status: 'failed' } }, 0],
  ['a timed out result', { result: { status: 'timedOut' } }, 0],
  ['a skipped result', { result: { status: 'skipped' } }, 0],
  ['an interrupted result', { result: { status: 'interrupted' } }, 0],
  ['a nonzero process exit despite a passing report', {}, 1],
  [
    'errors despite passing statuses',
    { result: { errors: [{ message: 'uncaught original error' }] } },
    0,
  ],
  ['an unexpected test outcome', { test: { status: 'unexpected' } }, 0],
  ['a flaky test outcome', { test: { status: 'flaky' } }, 0],
  [
    'a wrong passing count',
    { report: { stats: { expected: 0, unexpected: 0, skipped: 0, flaky: 0 } } },
    0,
  ],
  [
    'an unexpected count',
    { report: { stats: { expected: 1, unexpected: 1, skipped: 0, flaky: 0 } } },
    0,
  ],
  [
    'a skipped count',
    { report: { stats: { expected: 1, unexpected: 0, skipped: 1, flaky: 0 } } },
    0,
  ],
  ['a flaky count', { report: { stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 1 } } }, 0],
])('refuses %s as a normal original pass', (_name, overrides, exitCode) => {
  expect(() => evaluateElectronReport(report(overrides), selection, 'passed', exitCode)).toThrow(
    /Electron/u,
  );
});

it('refuses a coherent failing original execution', () => {
  expect(() => evaluateElectronReport(killedReport(), selection, 'passed', 1)).toThrow(/Electron/u);
});

it('accepts an explicit absent-locator mismatch at the reviewed behavioral expectation', () => {
  // Actual Playwright 1.62.1 shape captured from the drift-save mutation.
  // The engine reports the received empty locator as an error, without a Received label.
  const failure = [
    'Error: expect(locator).toBeVisible() failed',
    '',
    'Locator: getByText(/requires repair/i)',
    'Expected: visible',
    'Timeout: 10000ms',
    'Error: element(s) not found',
    '',
    `    at ${selection.mutation.assertionLocation}:3`,
  ].join('\n');
  const selected = {
    ...selection,
    mutation: { ...selection.mutation, expectedFailure: 'requires repair' },
  };
  expect(
    evaluateElectronReport(killedReport({ error: { message: failure } }), selected, 'failed', 1),
  ).toEqual({ exitCode: 1, failure });
});

it.each([
  ['a browser launch error', 'Error: browser closed'],
  ['a locator timeout without an explicit received absence', 'Timeout: waiting for locator'],
])('refuses %s instead of a locator mismatch', (_name, actual) => {
  const failure = [
    'Error: expect(locator).toBeVisible() failed',
    'Locator: getByText(/requires repair/i)',
    'Expected: visible',
    actual,
    `    at ${selection.mutation.assertionLocation}:3`,
  ].join('\n');
  const selected = {
    ...selection,
    mutation: { ...selection.mutation, expectedFailure: 'requires repair' },
  };
  expect(() =>
    evaluateElectronReport(killedReport({ error: { message: failure } }), selected, 'failed', 1),
  ).toThrow(/Electron/u);
});

it.each([
  ['missing locator', 'Error: expect(locator).toBeVisible() failed', ''],
  [
    'a negative matcher',
    'Error: expect(locator).not.toBeVisible() failed',
    'Locator: getByText(/requires repair/i)',
  ],
  [
    'an unsupported matcher',
    'Error: expect(locator).toHaveText(expected) failed',
    'Locator: getByText(/requires repair/i)',
  ],
])('refuses %s on the absent-locator evidence path', (_name, header, locator) => {
  const failure = [
    header,
    locator,
    'Expected: visible',
    'Error: element(s) not found',
    `    at ${selection.mutation.assertionLocation}:3`,
  ].join('\n');
  const selected = {
    ...selection,
    mutation: { ...selection.mutation, expectedFailure: 'requires repair' },
  };
  expect(() =>
    evaluateElectronReport(killedReport({ error: { message: failure } }), selected, 'failed', 1),
  ).toThrow(/Electron/u);
});
