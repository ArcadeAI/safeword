import type { CliResult } from './result.js';

export interface ProgressReporter {
  readonly start: (message: string, phase?: 'active' | 'preparation') => void;
  readonly heartbeat?: (message: string) => void;
  readonly stop: () => void;
}

export interface CommandInvocation {
  readonly cwd: string;
  readonly json?: boolean;
  readonly noInput: boolean;
  readonly offline: boolean;
  readonly options: Readonly<Record<string, unknown>>;
  readonly operands: readonly unknown[];
  readonly progress?: ProgressReporter;
}

export type CommandHandler = (invocation: CommandInvocation) => Promise<CliResult>;
