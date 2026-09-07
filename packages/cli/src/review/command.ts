import type { RedExecutionRequest, ReviewKind } from './contract.js';

function shellQuote(value: string): string {
  if (/^[\w./-]+$/u.test(value)) return value;
  const escaped = value.replaceAll("'", `'"'"'`);
  return `'${escaped}'`;
}

function contextArgument(target: string): string {
  return `--context ${shellQuote(target)}`;
}

export function retryCommand(
  kind: ReviewKind,
  targets: readonly string[],
  context: readonly string[] = [],
  execution?: RedExecutionRequest,
): string {
  // `--` ends option parsing, so a reviewed file named `--help` or `-r` reaches
  // the command as a target rather than as a flag.
  const quoted = targets.map(target => shellQuote(target)).join(' ');
  const contextOption =
    context.length === 0 ? '' : ` ${context.map(target => contextArgument(target)).join(' ')}`;
  const executionOptions =
    execution === undefined
      ? ''
      : [
          ` --scenario ${shellQuote(execution.scenario)}`,
          ` --proof-cwd ${shellQuote(execution.cwd)}`,
          ` --evidence-class ${execution.evidenceClass}`,
          ` --expected-failure ${shellQuote(execution.expectedFailure)}`,
          ` --execution-timeout ${execution.timeoutMs}`,
          ` --execute ${shellQuote(JSON.stringify(execution.argv))}`,
        ].join('');
  return `safeword review run ${kind}${contextOption}${executionOptions} -- ${quoted}`;
}
