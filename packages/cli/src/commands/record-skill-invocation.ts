/** Record current-run workflow proof without requiring project-local helpers. */

import { hasSafewordProjectMarker } from '../../templates/hooks/lib/namespace-root.js';
import { recordSkillInvocation } from '../../templates/hooks/record-skill-invocation.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import { ensureTransientStateIgnore } from '../project-state.js';

const SKILL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/u;

export function runRecordSkillInvocation(
  cwd: string,
  skillName: string | undefined,
  sessionId: string | undefined,
): Promise<CliResult> {
  if (skillName === undefined || !SKILL_NAME_PATTERN.test(skillName)) {
    return Promise.resolve(
      createResult({
        state: 'failed',
        errors: [
          {
            code: 'SKILL_INVOCATION_NAME_INVALID',
            message: 'project record-skill-invocation requires a valid skill name.',
            retryable: false,
          },
        ],
      }),
    );
  }

  if (!hasSafewordProjectMarker(cwd)) {
    return Promise.resolve(
      createResult({
        state: 'action_required',
        findings: [
          {
            code: 'PROJECT_NOT_ENROLLED',
            message: 'This repository is not enrolled with Safeword.',
            severity: 'warning',
          },
        ],
        nextActions: [{ command: 'safeword install', mutates: true, requiresHuman: true }],
      }),
    );
  }

  ensureTransientStateIgnore(cwd, 'skill-invocations.log');
  recordSkillInvocation(cwd, skillName, sessionId);
  return Promise.resolve(
    createResult({
      state: 'changed',
      changed: true,
      data: { command: 'project record-skill-invocation', skill: skillName },
    }),
  );
}
