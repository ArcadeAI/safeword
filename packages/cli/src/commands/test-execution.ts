import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import {
  readPersonalExecutionPreference,
  readProjectExecutionPreference,
} from '../test-execution/config.js';
import { resolveExecutionMode } from '../test-execution/mode.js';

const REMOTE_EXECUTION_AVAILABLE = false;

export function observeTestExecutionStatus(cwd: string): CliResult {
  const personal = readPersonalExecutionPreference(cwd);
  if (personal.error !== undefined) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'SAFEWORD_TEST_EXECUTION_INVALID',
          message: `Personal test-execution configuration at ${personal.path} ${personal.error}.`,
          retryable: false,
        },
      ],
    });
  }
  const project = readProjectExecutionPreference(cwd);
  const effective = resolveExecutionMode({ personal: personal.mode, project });
  const personalOrigin = nodePath.relative(cwd, personal.path);
  return createResult({
    state: 'healthy',
    data: {
      command: 'project test-execution status',
      effective,
      remote: { available: REMOTE_EXECUTION_AVAILABLE },
      scopes: [
        { source: 'command', mode: undefined },
        { source: 'personal', mode: personal.mode, path: personalOrigin },
        { source: 'project', mode: project, path: '.safeword/config.json' },
        { source: 'built-in', mode: 'local' },
      ],
    },
  });
}
