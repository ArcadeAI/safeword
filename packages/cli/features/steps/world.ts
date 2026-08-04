import { setWorldConstructor, World } from '@cucumber/cucumber';

// `tsx` only needs NODE_OPTIONS while Cucumber imports the TypeScript support
// code. Do not leak that preload into fixture subprocesses whose temporary
// projects cannot resolve this workspace dependency.
delete process.env.NODE_OPTIONS;

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Shared state for the acceptance steps: a temp project dir and the last CLI run. */
export class SafewordWorld extends World {
  temporaryDirectory = '';
  fakeCodexBin?: string;
  result: CliResult = { stdout: '', stderr: '', exitCode: 0 };
}

setWorldConstructor(SafewordWorld);
