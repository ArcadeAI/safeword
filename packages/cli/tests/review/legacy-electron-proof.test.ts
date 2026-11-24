import { expect, it } from 'vitest';

import { evaluateElectronReport } from '../../src/review/retrospective-electron-report.js';

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

function killedReport() {
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
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    stats: { expected: 0, unexpected: 1, skipped: 0, flaky: 0 },
  };
}

it('accepts one mutant failure at the declared expectation', () => {
  const result = evaluateElectronReport(killedReport(), selection, 'failed', 1);
  expect(result.exitCode).toBe(1);
  expect(result.failure).toContain(selection.mutation.assertionLocation);
  expect(result.failure).toContain(selection.mutation.expectedFailure);
});
