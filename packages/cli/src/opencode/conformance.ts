import { spawnSync } from 'node:child_process';
import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';

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

export function runOpenCodeConformance(environment: NodeJS.ProcessEnv = process.env): CliResult {
  const executable = resolveExecutable(environment);
  if (executable === undefined) {
    return executableRemediation(
      'OPENCODE_EXECUTABLE_UNRESOLVED',
      'OpenCode is not executable from PATH.',
    );
  }

  const version = spawnSync(executable, ['--version'], {
    encoding: 'utf8',
    env: environment,
    timeout: 10_000,
  });
  if (version.status !== 0 || version.error !== undefined) {
    return executableRemediation(
      'OPENCODE_EXECUTABLE_FAILED',
      'OpenCode exited before conformance could begin.',
    );
  }
  if (version.stdout.trim() !== SUPPORTED_OPENCODE_VERSION) {
    return executableRemediation(
      'OPENCODE_VERSION_UNSUPPORTED',
      `OpenCode ${version.stdout.trim() || '<unknown>'} does not match the supported conformance fixture ${SUPPORTED_OPENCODE_VERSION}.`,
    );
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
    data: { command: 'conformance', agent: 'opencode' },
  });
}
