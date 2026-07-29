import {
  type CliResult,
  createResult,
  type Finding,
  type NextAction,
} from '../cli-protocol/result.js';
import { checkHealth } from '../health.js';
import { detectPackageManager } from '../utils/install.js';
import { compareVersions, isSafePackageVersion } from '../utils/version.js';

function healthFindings(
  values: readonly string[],
  code: string,
  severity: Finding['severity'],
): Finding[] {
  return values.map(message => ({ code, message, severity }));
}

function statusNextActions(
  blockingFindings: readonly Finding[],
  versionAction: NextAction | undefined,
): readonly NextAction[] {
  if (versionAction !== undefined) return [versionAction];
  return blockingFindings.length === 0
    ? []
    : [{ command: 'safeword plan', mutates: false, requiresHuman: false }];
}

function projectVersionFinding(
  cwd: string,
  projectVersion: string | undefined,
  cliVersion: string,
): { finding?: Finding; nextAction?: NextAction } {
  if (projectVersion === undefined) return {};
  if (!isSafePackageVersion(projectVersion)) {
    return {
      finding: {
        code: 'PROJECT_VERSION_UNSAFE',
        message:
          'Project version is not safe to use in a package install command; inspect .safeword/version.',
        severity: 'warning',
      },
    };
  }
  const comparison = compareVersions(projectVersion, cliVersion);
  if (comparison < 0) {
    return {
      finding: {
        code: 'PROJECT_UPDATE_AVAILABLE',
        message: `Project config v${projectVersion} can be upgraded to v${cliVersion}.`,
        severity: 'info',
      },
      nextAction: { command: 'safeword setup', mutates: true, requiresHuman: false },
    };
  }
  if (comparison <= 0) return {};
  const packageManager = detectPackageManager(cwd);
  const runUpgrade =
    packageManager === 'bun' || packageManager === 'yarn'
      ? `${packageManager} run safeword setup`
      : `${packageManager} exec safeword setup`;
  return {
    finding: {
      code: 'CLI_OLDER_THAN_PROJECT',
      message: `Project config (v${projectVersion}) is newer than CLI (v${cliVersion}).`,
      severity: 'warning',
    },
    nextAction: {
      command: `${packageManager} add -D safeword@${projectVersion} && ${runUpgrade}`,
      mutates: true,
      requiresHuman: false,
    },
  };
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
      ...healthFindings(
        health.missingPacks.map(pack => `${pack} language pack is not installed.`),
        'MISSING_LANGUAGE_PACK',
        'error',
      ),
      ...healthFindings(
        health.missingPackages.map(packageName => `${packageName} package is not installed.`),
        'MISSING_PACKAGE',
        'error',
      ),
      ...healthFindings(health.issues, 'PROJECT_DRIFT', 'warning'),
    ];
    const versionGuidance = projectVersionFinding(cwd, health.projectVersion, health.cliVersion);
    if (versionGuidance.finding?.severity === 'warning') {
      blockingFindings.push(versionGuidance.finding);
    }
    const findings = [
      {
        code: 'SAFEWORD_VERSION',
        message: `Safeword CLI v${health.cliVersion}; project config v${health.projectVersion ?? 'unknown'}.`,
        severity: 'info' as const,
      },
      ...blockingFindings,
      ...(versionGuidance.finding === undefined || versionGuidance.finding.severity === 'warning'
        ? []
        : [versionGuidance.finding]),
      ...healthFindings(health.advisories, 'PROJECT_ADVISORY', 'info'),
    ];
    const nextActions = statusNextActions(blockingFindings, versionGuidance.nextAction);

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
