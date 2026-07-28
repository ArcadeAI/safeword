import {
  type CliResult,
  createResult,
  type Finding,
  type NextAction,
} from '../cli-protocol/result.js';
import { checkHealth } from '../health.js';

function healthFindings(
  values: readonly string[],
  code: string,
  severity: Finding['severity'],
): Finding[] {
  return values.map(message => ({ code, message, severity }));
}

export async function observeStatus(cwd: string): Promise<CliResult> {
  try {
    const health = await checkHealth(cwd);
    if (!health.configured) {
      return createResult({
        state: 'action_required',
        findings: [
          {
            code: 'PROJECT_NOT_CONFIGURED',
            message: 'Safeword is not configured in this project.',
            severity: 'warning',
          },
        ],
        nextActions: [{ command: 'safeword setup', mutates: true, requiresHuman: false }],
        data: { configured: false, cli_version: health.cliVersion },
      });
    }

    const blockingFindings = [
      ...healthFindings(health.missingPacks, 'MISSING_LANGUAGE_PACK', 'error'),
      ...healthFindings(health.missingPackages, 'MISSING_PACKAGE', 'error'),
      ...healthFindings(health.issues, 'PROJECT_DRIFT', 'warning'),
    ];
    const findings = [
      ...blockingFindings,
      ...healthFindings(health.advisories, 'PROJECT_ADVISORY', 'info'),
    ];
    const nextActions: readonly NextAction[] =
      blockingFindings.length === 0
        ? []
        : [{ command: 'safeword plan', mutates: false, requiresHuman: false }];

    return createResult({
      state: blockingFindings.length === 0 ? 'healthy' : 'action_required',
      findings,
      nextActions,
      data: {
        configured: true,
        cli_version: health.cliVersion,
        project_version: health.projectVersion,
      },
    });
  } catch (statusError) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'STATUS_FAILED',
          message: statusError instanceof Error ? statusError.message : String(statusError),
          retryable: false,
        },
      ],
      nextActions: [
        {
          command: 'safeword doctor --verbose',
          mutates: false,
          requiresHuman: true,
        },
      ],
    });
  }
}
