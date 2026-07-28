import type { CliResult } from './result.js';

export interface CommandInvocation {
  readonly cwd: string;
  readonly noInput: boolean;
  readonly offline: boolean;
  readonly options: Readonly<Record<string, unknown>>;
  readonly operands: readonly unknown[];
}

export type CommandHandler = (invocation: CommandInvocation) => Promise<CliResult>;
