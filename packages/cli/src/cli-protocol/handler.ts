import type { CliResult } from './result.js';

export interface CommandInvocation {
  readonly cwd: string;
  readonly noInput: boolean;
  readonly offline: boolean;
  readonly options: Readonly<Record<string, unknown>>;
  readonly operands: readonly unknown[];
  readonly progress?: {
    readonly start: (message: string) => void;
    readonly stop: () => void;
  };
}

export type CommandHandler = (invocation: CommandInvocation) => Promise<CliResult>;
