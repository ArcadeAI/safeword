import { setWorldConstructor, World } from '@cucumber/cucumber';

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Shared state for the acceptance steps: a temp project dir and the last CLI run. */
export class SafewordWorld extends World {
  temporaryDirectory = '';
  result: CliResult = { stdout: '', stderr: '', exitCode: 0 };
}

setWorldConstructor(SafewordWorld);
