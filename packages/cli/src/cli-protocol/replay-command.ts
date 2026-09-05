export type ReplayOption = readonly [flag: string, value: string | undefined];

export function shellArgument(value: string): string {
  const escapedSingleQuote = `'"'"'`;
  return `'${value.split("'").join(escapedSingleQuote)}'`;
}

export function buildReplayCommand(input: {
  readonly command: string;
  readonly operands?: readonly string[];
  readonly options?: readonly ReplayOption[];
  readonly cwd: string;
}): string {
  return [
    input.command,
    ...(input.operands ?? []).map(operand => shellArgument(operand)),
    ...(input.options ?? []).flatMap(([flag, value]) =>
      value === undefined ? [] : [flag, shellArgument(value)],
    ),
    '--cwd',
    shellArgument(input.cwd),
  ].join(' ');
}

/**
 * `shellArgument` for values that may be absent; an absent value quotes to an
 * empty argument rather than disappearing from the command line.
 */
export function shellQuote(value: string | undefined): string {
  return shellArgument(value ?? '');
}
