import { spawn } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';

import type { RustCommandRunner, RustProcessInvocation, RustProcessResult } from './runner';

export function createDryRunCommandRunner(): RustCommandRunner {
  return {
    run: async (invocation: RustProcessInvocation): Promise<RustProcessResult> => ({
      exitCode: 0,
      stdout: `dry-run: ${invocation.argv.join(' ')}`,
      stderr: '',
      durationMs: 0,
    }),
  };
}

export function createNodeCommandRunner(): RustCommandRunner {
  return {
    run: async (invocation: RustProcessInvocation): Promise<RustProcessResult> => {
      if (invocation.argv.length === 0) {
        return {
          exitCode: 127,
          stdout: '',
          stderr: 'empty command invocation',
          durationMs: 0,
        };
      }

      const [command, ...args] = invocation.argv;
      const startedAt = performance.now();
      return await new Promise<RustProcessResult>(resolve => {
        let settled = false;
        let timedOut = false;
        let dockerCleanupId: string | undefined;
        let stdout = '';
        let stderr = '';
        let forceKill: NodeJS.Timeout | undefined;
        const child = spawn(command, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const timeout =
          invocation.timeoutSeconds === undefined
            ? undefined
            : setTimeout(
                () => {
                  timedOut = true;
                  dockerCleanupId = cleanupDockerContainerForInvocation(invocation.argv);
                  child.kill('SIGTERM');
                  forceKill = setTimeout(() => {
                    child.kill('SIGKILL');
                  }, 2_000);
                },
                Math.max(1, Math.round(invocation.timeoutSeconds * 1000)),
              );

        child.stdout?.on('data', chunk => {
          stdout += String(chunk);
        });
        child.stderr?.on('data', chunk => {
          stderr += String(chunk);
        });
        child.on('error', error => {
          if (settled) return;
          settled = true;
          if (timeout) clearTimeout(timeout);
          if (forceKill) clearTimeout(forceKill);
          removeDockerCidFile(invocation.argv);
          resolve({
            exitCode: 127,
            stdout,
            stderr: stderr ? `${stderr}\n${error.message}` : error.message,
            durationMs: elapsedSince(startedAt),
          });
        });
        child.on('close', code => {
          if (settled) return;
          settled = true;
          if (timeout) clearTimeout(timeout);
          if (forceKill) clearTimeout(forceKill);
          removeDockerCidFile(invocation.argv);
          if (timedOut) {
            resolve({
              exitCode: 124,
              stdout,
              stderr: appendTimeoutDiagnostics(stderr, invocation.timeoutSeconds, dockerCleanupId),
              durationMs: elapsedSince(startedAt),
            });
            return;
          }

          resolve({
            exitCode: code ?? 1,
            stdout,
            stderr,
            durationMs: elapsedSince(startedAt),
          });
        });
      });
    },
  };
}

function elapsedSince(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function appendLine(existing: string, line: string): string {
  return existing ? `${existing}\n${line}` : line;
}

function appendTimeoutDiagnostics(
  stderr: string,
  timeoutSeconds: number | undefined,
  dockerCleanupId: string | undefined,
): string {
  const withTimeout = appendLine(stderr, `command timed out after ${timeoutSeconds}s`);
  return dockerCleanupId
    ? appendLine(withTimeout, `removed timed-out Docker container ${dockerCleanupId}`)
    : withTimeout;
}

export function dockerCidFileForInvocation(argv: string[]): string | undefined {
  if (argv[0] !== 'docker' || argv[1] !== 'run') return undefined;
  const cidFileIndex = argv.indexOf('--cidfile');
  if (cidFileIndex === -1) return undefined;
  return argv[cidFileIndex + 1];
}

export function cleanupDockerContainerForInvocation(
  argv: string[],
  cleanup: (containerId: string) => void = forceRemoveDockerContainer,
): string | undefined {
  const cidFile = dockerCidFileForInvocation(argv);
  if (!cidFile || !existsSync(cidFile)) return undefined;

  const containerId = readFileSync(cidFile, 'utf8').trim();
  if (!containerId) return undefined;

  cleanup(containerId);
  return containerId;
}

function forceRemoveDockerContainer(containerId: string): void {
  spawnSync('docker', ['rm', '-f', containerId], { stdio: 'ignore' });
}

function removeDockerCidFile(argv: string[]): void {
  const cidFile = dockerCidFileForInvocation(argv);
  if (!cidFile || !existsSync(cidFile)) return;

  try {
    unlinkSync(cidFile);
  } catch {
    // Best effort cleanup. Stale cidfiles are also removed during cache prep.
  }
}
