import type { CliResult } from './result.js';

export type ProgressPhase = 'active' | 'preparation';

export interface ProgressReporter {
  readonly managed?: boolean;
  readonly start: (message: string, phase?: ProgressPhase) => void;
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
