/** Execute an allowlisted helper from the installed Safeword package. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import { hasSafewordProjectMarker } from '../../templates/hooks/lib/namespace-root.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import { projectRuntimeHelperDefinition } from '../project-runtime-helpers.js';
import { ensureTransientStateIgnore } from '../project-state.js';

interface ProjectRuntimeRunnerResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

type ProjectRuntimeRunner = (
  runtime: string,
  args: readonly string[],
  options: {
    cwd: string;
    encoding: 'utf8';
    env: NodeJS.ProcessEnv;
  },
) => ProjectRuntimeRunnerResult;

function completedResult(
  helper: string,
  status: number | null,
  stdout: string,
  stderr: string,
): CliResult {
  const exitCode = status ?? 1;
  if (exitCode !== 0)
    return createResult({
      state: 'failed',
      exitCode,
      errors: [
        {
          code: 'PROJECT_RUNTIME_FAILED',
          message: (stderr || stdout || `${helper} failed`).trim(),
          retryable: false,
        },
      ],
    });
  return createResult({
    state: 'healthy',
    presentation: { kind: 'raw', body: stdout },
    data: { command: 'project runtime', helper },
  });
}

function packageRoot(): string {
  const runtimeDirectory = nodePath.basename(import.meta.dirname);
  return runtimeDirectory === 'dist' || runtimeDirectory === 'runtime'
    ? nodePath.dirname(import.meta.dirname)
    : nodePath.resolve(import.meta.dirname, '../..');
}

function packagedCliPath(): string {
  const runtimeDirectory = nodePath.basename(import.meta.dirname);
  return nodePath.join(
    packageRoot(),
    runtimeDirectory === 'runtime' ? 'runtime' : 'dist',
    'cli.js',
  );
}

function projectRuntimeEnvironment(projectDirectory: string): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_PROJECT_DIR: projectDirectory,
  };
  const reentrantCli = packagedCliPath();
  if (existsSync(reentrantCli)) environment.SAFEWORD_PLUGIN_CLI = reentrantCli;
  return environment;
}

export function runProjectRuntime(
  cwd: string,
  helper: string | undefined,
  args: readonly string[],
  runner: ProjectRuntimeRunner = spawnSync,
): Promise<CliResult> {
  const definition = projectRuntimeHelperDefinition(helper);
  if (helper === undefined || definition === undefined)
    return Promise.resolve(
      createResult({
        state: 'failed',
        errors: [
          {
            code: 'PROJECT_RUNTIME_HELPER_INVALID',
            message: `Unknown packaged project helper: ${helper ?? '(missing)'}.`,
            retryable: false,
          },
        ],
      }),
    );
  const projectDirectory = hasSafewordProjectMarker(cwd)
    ? cwd
    : (process.env.CLAUDE_PROJECT_DIR ?? cwd);
  const [relativePath, runtime] = definition;
  const script = nodePath.join(packageRoot(), relativePath);
  if (!existsSync(script))
    return Promise.resolve(
      createResult({
        state: 'failed',
        errors: [
          {
            code: 'PROJECT_RUNTIME_MISSING',
            message: `Packaged helper is missing: ${script}`,
            retryable: false,
          },
        ],
      }),
    );
  if (!hasSafewordProjectMarker(projectDirectory))
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
  if (helper === 'write-review-stamp')
    ensureTransientStateIgnore(projectDirectory, 'skill-invocations.log');
  const result = runner(runtime, [script, ...args], {
    cwd: projectDirectory,
    encoding: 'utf8',
    env: projectRuntimeEnvironment(projectDirectory),
  });
  return Promise.resolve(completedResult(helper, result.status, result.stdout, result.stderr));
}
