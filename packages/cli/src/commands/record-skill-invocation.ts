/** Record current-run workflow proof without requiring project-local helpers. */

import { ENROLLMENT_CHOICE_MESSAGE } from '../../templates/hooks/lib/enrollment-boundary.js';
import { recordSkillInvocation } from '../../templates/hooks/record-skill-invocation.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import { resolveProjectContext } from '../project-context/resolver.js';

const SKILL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/u;

export function runRecordSkillInvocation(
  cwd: string,
  skillName: string | undefined,
  sessionId: string | undefined,
  options: { readonly interactive?: boolean } = {},
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

  const resolution = resolveProjectContext(cwd);
  if (resolution.kind !== 'ready' || resolution.context.authority !== 'local') {
    return Promise.resolve(
      createResult({
        state: 'action_required',
        findings: [
          {
            code: 'ENROLLMENT_CHOICE_REQUIRED',
            message: ENROLLMENT_CHOICE_MESSAGE,
            severity: 'info',
          },
        ],
        nextActions:
          options.interactive === false
            ? []
            : [{ command: 'safeword install', mutates: true, requiresHuman: true }],
      }),
    );
  }

  if (!recordSkillInvocation(cwd, skillName, sessionId)) {
    return Promise.resolve(
      createResult({
        state: 'healthy',
        findings: [
          {
            code: 'SKILL_INVOCATION_IDENTITY_MISSING',
            message: 'No invocation proof was recorded because this run has no identity.',
            severity: 'info',
          },
        ],
      }),
    );
  }
  return Promise.resolve(
    createResult({
      state: 'changed',
      changed: true,
      presentation: { kind: 'raw', body: `[skill-invocation-log] ${skillName} ✓\n` },
      data: { command: 'project record-skill-invocation', skill: skillName },
    }),
  );
}
