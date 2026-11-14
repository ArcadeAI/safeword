import { type ChildProcess, spawn } from 'node:child_process';

const MAX_STDOUT_CHARACTERS = 256 * 1024;
const MAX_STDERR_CHARACTERS = 64 * 1024;

export interface GoLintOutput {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Own the child and exact temporary config for both normal and signal exits. */
export function goLintProcess(cleanup: () => void) {
  let child: ChildProcess | undefined;
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  const dispose = (): void => {
    for (const signal of signals) process.removeListener(signal, onSignal);
  };
  const onSignal = (signal: NodeJS.Signals): void => {
    child?.kill(signal);
    try {
      cleanup();
    } catch (error) {
      process.stderr.write(`Go lint temporary config cleanup failed: ${String(error)}\n`);
    }
    dispose();
    process.kill(process.pid, signal);
  };
  for (const signal of signals) process.on(signal, onSignal);
  return {
    dispose,
    run(args: string[], cwd: string): Promise<GoLintOutput> {
      return new Promise((resolve, reject) => {
        child = spawn('golangci-lint', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        let truncated = false;
        child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
          if (stdout.length < MAX_STDOUT_CHARACTERS) stdout += chunk;
          else truncated = true;
        });
        child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
          if (stderr.length < MAX_STDERR_CHARACTERS) stderr += chunk;
        });
        child.on('error', reject);
        child.on('close', code => {
          child = undefined;
          const notice = truncated ? '\n[Further package diagnostics were truncated.]' : '';
          resolve({ code, stdout: `${stdout.trim()}${notice}`, stderr: stderr.trim() });
        });
      });
    },
  };
}
