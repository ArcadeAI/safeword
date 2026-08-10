export type ExecutionMode = 'local' | 'remote-preferred';
export type ExecutionModeSource = 'command' | 'personal' | 'project' | 'built-in';

export interface ExecutionModeInput {
  readonly command?: ExecutionMode;
  readonly personal?: ExecutionMode;
  readonly project?: ExecutionMode;
}

export interface ResolvedExecutionMode {
  readonly mode: ExecutionMode;
  readonly source: ExecutionModeSource;
}

/** Resolve one request's execution preference without reading or mutating state. */
export function resolveExecutionMode(input: ExecutionModeInput): ResolvedExecutionMode {
  if (input.command !== undefined) return { mode: input.command, source: 'command' };
  if (input.personal !== undefined) return { mode: input.personal, source: 'personal' };
  if (input.project !== undefined) return { mode: input.project, source: 'project' };
  return { mode: 'local', source: 'built-in' };
}
