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
