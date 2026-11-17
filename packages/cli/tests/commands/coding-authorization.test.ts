import { describe, expect, it } from 'vitest';

import { createResult } from '../../src/cli-protocol/result.js';
import { projectCodingAuthorization } from '../../src/commands/coding-authorization.js';

describe('coding authorization projection', () => {
  it('fails closed when a healthy prerequisite omits its status', () => {
    const result = projectCodingAuthorization(
      createResult({
        state: 'healthy',
        data: { command: 'ticket execution-prerequisite', grants_authority: false },
      }),
      'ABC123',
    );

    expect(result).toMatchObject({
      state: 'action_required',
      data: { coding_authorization: 'denied', grants_authority: false },
      findings: [
        {
          code: 'invalid_execution_prerequisite_result',
          severity: 'warning',
        },
      ],
    });
  });
});
