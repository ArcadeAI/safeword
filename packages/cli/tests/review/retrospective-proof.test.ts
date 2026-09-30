import { describe, expect, it } from 'vitest';

import {
  type RetrospectiveProofRequest,
  runRetrospectiveProof,
} from '../../src/review/retrospective-proof.js';

const request: RetrospectiveProofRequest = {
  ticketId: 'CKWE2D',
  scenario: 'A nested project uses its committed generated marker',
  testFile: 'packages/cli/tests/cli-protocol/review-generated-targets.test.ts',
  testFullName:
    'generated review targets uses repository-relative paths for a project nested below the Git root',
  implementationPath: 'packages/cli/src/review/packet.ts',
  mutation: {
    before: 'const repoPaths = files.map(file => `${repoPrefix}${file.relative}`);',
    after: 'const repoPaths = files.map(file => file.relative);',
    expectedFailure: 'expected undefined to deeply equal',
    assertionLocation: 'review-generated-targets.test.ts:201',
  },
  supportFiles: ['packages/cli/src/review/scope.ts'],
};

describe('retrospective proof boundary', () => {
  it('rejects other tickets before Git inspection or test execution', () => {
    expect(() =>
      runRetrospectiveProof('/not/a/repository', { ...request, ticketId: 'OTHER1' }),
    ).toThrow('Only CKWE2D may use retrospective proof.');
  });

  it('rejects path traversal before Git inspection or test execution', () => {
    expect(() =>
      runRetrospectiveProof('/not/a/repository', {
        ...request,
        implementationPath: 'packages/cli/src/../secret.ts',
      }),
    ).toThrow('Retrospective proof paths must name CLI source and a CLI test.');
  });

  it('rejects a subdirectory as the source of a proof', () => {
    expect(() => runRetrospectiveProof(process.cwd(), request)).toThrow(
      'Retrospective proof requires the Git repository root.',
    );
  });
});
