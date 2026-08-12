import type { ReviewKind } from './contract.js';

function shellQuote(value: string): string {
  if (/^[\w./-]+$/u.test(value)) return value;
  const escaped = value.replaceAll("'", `'"'"'`);
  return `'${escaped}'`;
}

export function retryCommand(
  kind: ReviewKind,
  targets: readonly string[],
  context: readonly string[] = [],
): string {
  // `--` ends option parsing, so a reviewed file named `--help` or `-r` reaches
  // the command as a target rather than as a flag.
  const quoted = targets.map(target => shellQuote(target)).join(' ');
  const contextOption =
    context.length === 0 ? '' : ` --context ${context.map(target => shellQuote(target)).join(' ')}`;
  return `safeword review run ${kind}${contextOption} -- ${quoted}`;
}
