export interface TestRunnerInvocation {
  arguments: string[];
  executable: string;
}

export function environmentPathKey(environment: Record<string, unknown>): string;

export function resolveWindowsVitest(
  searchPath: string,
  cliRoot: string,
  nodeExecutable?: string,
): TestRunnerInvocation;

export function resolveTestRunnerInvocation(
  command: string,
  args: string[],
  environment: Record<string, string | undefined>,
  cliRoot: string,
  platform?: string,
): TestRunnerInvocation;
