import { spawnSync } from 'node:child_process';
import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import {
  OPENCODE_EXPECTED_DISCOVERY,
  proveOpenCodeCatalogue,
  proveOpenCodeDenial,
} from './conformance-fixture.js';
import { openCodeProfilePaths, resolveOpenCodeConfigRoot } from './profile.js';

export const SUPPORTED_OPENCODE_VERSION = '1.18.23';

function resolveExecutable(environment: NodeJS.ProcessEnv): string | undefined {
  const extensions =
    process.platform === 'win32' ? (environment.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';') : [''];
  const pathEntries = (environment.PATH ?? '').split(nodePath.delimiter).filter(Boolean);
  for (const directory of pathEntries) {
    for (const extension of extensions) {
      const candidate = nodePath.resolve(directory, `opencode${extension.toLowerCase()}`);
      try {
        accessSync(candidate, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
        const resolved = realpathSync(candidate);
        if (statSync(resolved).isFile()) return resolved;
      } catch {
        // Keep searching PATH for a usable executable.
      }
    }
  }
  return undefined;
}

function executableRemediation(code: string, message: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [{ code, message, severity: 'error' }],
    nextActions: [
      {
        kind: 'human',
        instruction:
          'Install OpenCode 1.18.23 and make `opencode` executable on PATH, then rerun conformance.',
        mutates: false,
        requiresHuman: true,
      },
    ],
    data: { command: 'conformance', agent: 'opencode' },
  });
}

function profileRemediation(): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'OPENCODE_PROFILE_REQUIRED',
        message: 'The managed Safeword OpenCode profile must be installed before conformance.',
        severity: 'error',
      },
    ],
    nextActions: [
      {
        command: 'safeword install --agents=opencode',
        mutates: true,
        requiresHuman: true,
      },
    ],
    data: { command: 'conformance', agent: 'opencode' },
  });
}

function installedProfileRoot(environment: NodeJS.ProcessEnv): string | undefined {
  const root = resolveOpenCodeConfigRoot({
    platform: process.platform === 'win32' ? 'windows' : 'unix',
    env: environment,
  });
  if (root === undefined) return undefined;
  const paths = openCodeProfilePaths(root);
  try {
    return statSync(paths.plugin).isFile() && statSync(paths.identity).isFile() ? root : undefined;
  } catch {
    return undefined;
  }
}

type ExecutableBoundary = { readonly executable: string } | { readonly result: CliResult };

function executableBoundary(environment: NodeJS.ProcessEnv): ExecutableBoundary {
  const executable = resolveExecutable(environment);
  if (executable === undefined) {
    return {
      result: executableRemediation(
        'OPENCODE_EXECUTABLE_UNRESOLVED',
        'OpenCode is not executable from PATH.',
      ),
    };
  }

  const version = spawnSync(executable, ['--version'], {
    encoding: 'utf8',
    env: environment,
    timeout: 10_000,
  });
  if (version.status !== 0 || version.error !== undefined) {
    return {
      result: executableRemediation(
        'OPENCODE_EXECUTABLE_FAILED',
        'OpenCode exited before conformance could begin.',
      ),
    };
  }
  if (version.stdout.trim() !== SUPPORTED_OPENCODE_VERSION) {
    return {
      result: executableRemediation(
        'OPENCODE_VERSION_UNSUPPORTED',
        `OpenCode ${version.stdout.trim() || '<unknown>'} does not match the supported conformance fixture ${SUPPORTED_OPENCODE_VERSION}.`,
      ),
    };
  }
  return { executable };
}

export async function runOpenCodeConformance(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<CliResult> {
  const boundary = executableBoundary(environment);
  if ('result' in boundary) return boundary.result;
  const { executable } = boundary;

  if (installedProfileRoot(environment) === undefined) return profileRemediation();
  if (!proveOpenCodeCatalogue(executable, environment)) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'OPENCODE_CATALOGUE_CONFORMANCE_FAILED',
          message: 'OpenCode did not discover the required Safeword catalogue.',
          retryable: true,
        },
      ],
      data: { command: 'conformance', agent: 'opencode' },
    });
  }
  const denial = await proveOpenCodeDenial(executable, environment);
  if (!denial.denialSurfaced || !denial.sentinelAbsent) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'OPENCODE_DENIAL_CONFORMANCE_FAILED',
          message: 'OpenCode did not prove Safeword denial without a side effect.',
          retryable: true,
        },
      ],
      data: { command: 'conformance', agent: 'opencode' },
    });
  }

  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'OPENCODE_CONFORMANCE_INCOMPLETE',
        message: 'The OpenCode executable is valid, but real-process conformance has not run.',
        severity: 'error',
      },
    ],
    nextActions: [
      {
        command: 'safeword conformance --agents=opencode',
        mutates: true,
        requiresHuman: false,
      },
    ],
    data: {
      command: 'conformance',
      agent: 'opencode',
      discovery: OPENCODE_EXPECTED_DISCOVERY,
      denial: true,
    },
  });
}
