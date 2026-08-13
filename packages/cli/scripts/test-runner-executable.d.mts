export interface TestRunnerInvocation {
  arguments: string[];
  executable: string;
}

export function resolveWindowsVitest(
  searchPath: string,
  cliRoot: string,
  nodeExecutable?: string,
): TestRunnerInvocation;
