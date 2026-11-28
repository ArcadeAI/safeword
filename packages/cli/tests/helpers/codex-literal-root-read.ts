import { parseShellCommandList } from '../../templates/hooks/lib/shell-segments.js';
import { parallelCommands } from './codex-parallel-read.js';

/** Inspect bounded shell syntax only; never evaluate a native tool input. */
function decodeJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported shell argument encoding', {
      cause: error,
    });
  }
}

/** Decode only the known native exec_command envelopes, once for all read matchers. */
export function readCommands(input: string): string[] {
  const parallel = parallelCommands(input, functionCommands);
  if (parallel) return parallel;
  const calls = input
    .matchAll(/\bawait tools\.exec_command\(\{\s*"cmd"\s*:\s*("(?:[^"\\]|\\.)*")/gu)
    .toArray();
  if (input.includes('tools.exec_command')) {
    if (
      calls.length === 0 ||
      calls.length !== input.matchAll(/\btools\.exec_command\(/gu).toArray().length ||
      calls.length !== input.matchAll(/"cmd"\s*:/gu).toArray().length
    )
      throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported shell argument encoding');
    return calls.map(match => decodeJson(match[1] ?? '""') as string);
  }
  if (input.trimStart().startsWith('{')) return functionCommands(input);
  return input.includes(String.raw`\"`) ? [] : [input];
}

function functionCommands(input: string): string[] {
  const value = decodeJson(input) as { cmd?: unknown; command?: unknown };
  if (value.command !== undefined)
    throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported shell argument encoding');
  if (value.cmd === undefined) return [];
  if (typeof value.cmd !== 'string' || input.matchAll(/"cmd"\s*:/gu).toArray().length !== 1)
    throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported shell argument encoding');
  return [value.cmd];
}

export function shellStatements(command: string, staticPrefix = false): string[] {
  const parts: string[] = [];
  let quote = '';
  let current = '';
  for (let index = 0; index < command.length; index++) {
    const char = command.charAt(index);
    // A dynamic suffix cannot invalidate completed literal inspections. Stop at
    // its first ambiguous byte; never inspect inside it or continue after it.
    if (staticPrefix && ambiguousPrefix(command.slice(index))) return parts;
    quote = nextQuote(quote, char);
    const delimiter = /^(?:&&|[;|\n])/u.exec(command.slice(index))?.[0];
    if (quote === '' && delimiter) {
      if (staticPrefix && !inspectionStatement(current)) return parts;
      parts.push(current.trim());
      current = '';
      index += delimiter.length - 1;
    } else current += char;
  }
  return finishStatements(parts, current, quote, staticPrefix);
}

function finishStatements(
  parts: string[],
  current: string,
  quote: string,
  staticPrefix: boolean,
): string[] {
  if (staticPrefix && !completeInspection(quote, current)) return parts;
  return quote === '' ? [...parts, current.trim()].filter(Boolean) : [];
}

function ambiguousPrefix(suffix: string): boolean {
  return (
    /[$`\\(){}<>#]/u.test(suffix.charAt(0)) ||
    suffix.startsWith('||') ||
    (suffix.startsWith('&') && !suffix.startsWith('&&'))
  );
}

function nextQuote(quote: string, char: string): string {
  if (!["'", '"'].includes(char)) return quote;
  if (quote === char) return '';
  return quote || char;
}

function completeInspection(quote: string, command: string): boolean {
  return quote === '' && inspectionStatement(command);
}

function inspectionStatement(command: string): boolean {
  return /^(?:pwd|git|rg|find|ls|sort|printf|cat|sed|head)(?:\s|$)/u.test(command.trim());
}

/** Only a complete, single literal operand counts in a dynamic command prefix. */
export function literalPrefixRead(command: string, target: string): boolean {
  return shellStatements(command, true).some(statement => {
    const reader = /^(cat|sed|head)\s+/u.exec(statement);
    if (!reader) return false;
    const flags = {
      cat: /^/u,
      sed: /^-n\s+'?\d+(?:,\d+)?p'?\s+/u,
      head: /^(?:-n\s+\d+\s+)?/u,
    };
    const remainder = statement.slice(reader[0].length);
    const options = flags[reader[1] as keyof typeof flags].exec(remainder);
    if (!options) return false;
    const read = /^(?:"([^"\n]+)"|'([^'\n]+)'|([/\w.-]+))$/u.exec(
      remainder.slice(options[0].length),
    );
    return read !== null && (read[1] ?? read[2] ?? read[3]) === target;
  });
}

export function literalRootRead(command: string, target: string): boolean {
  // Bounded syntax observation; caller checks completion/content, not arbitrary command safety.
  if (/\$\(|[`{}&]|-exec\b|printf\s+-v/u.test(command) || unsupportedGrouping(command))
    return false;
  const segments = parseShellCommandList(command);
  const assignment = literalRootBinding(segments.shift());
  if (!assignment) return false;
  const statements = rootInspectionStatements(segments);
  if (!statements) return false;
  const { name, root } = assignment;
  if (!name || !root) return false;
  if (statements.some(part => !/^(?:cat|sed|head|find|sort|printf|ls|rg|pwd)(?:\s|$)/u.test(part)))
    return false;
  // Reject reassignment anywhere, even after an otherwise matching read.
  if (
    statements.some(part =>
      part.matchAll(/\b([A-Za-z_]\w*)\s*=/gu).some(match => match[1] === name),
    )
  )
    return false;
  return statements.some(part => {
    const read = readOperand(part);
    return read?.[1] === name && `${root}${read[2]}` === target;
  });
}

/** Classify parentheses without decoding argv or changing the observed command. */
function unsupportedGrouping(command: string): boolean {
  if (/[()]/u.test(command) && /\$['"]/u.test(command)) return true;
  let quote = '';
  let escaped = false;
  for (const char of command) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote === '' && /[()]/u.test(char)) return true;
    quote = nextQuote(quote, char);
  }
  return quote !== '' || escaped;
}

function rootInspectionStatements(
  segments: ReturnType<typeof parseShellCommandList>,
): string[] | undefined {
  if (segments.some(part => ![undefined, ';', '|'].includes(part.operatorAfter))) return;
  if (segments.at(-1)?.command === 'git status --short') {
    if (segments.at(-2)?.operatorAfter !== ';') return;
    segments.pop();
  }
  return segments.map(part => part.command);
}

function literalRootBinding(
  segment: ReturnType<typeof parseShellCommandList>[number] | undefined,
): { name: string | undefined; root: string | undefined } | undefined {
  if (segment?.operatorAfter !== ';') return;
  const match = /^([A-Za-z_]\w*)=(?:'(\/[-\w./]+)'|"(\/[-\w./]+)"|(\/[-\w./]+))$/u.exec(
    segment.command,
  );
  return match ? { name: match[1], root: match[2] ?? match[3] ?? match[4] } : undefined;
}

function readOperand(statement: string): RegExpExecArray | undefined {
  const reader = /^(cat|sed|head)\s+/u.exec(statement);
  if (!reader) return undefined;
  const flags = {
    cat: /^/u,
    sed: /^-n '\d+(?:,\d+)?p'\s+/u,
    head: /^(?:-n \d+\s+)?/u,
  };
  const remainder = statement.slice(reader[0].length);
  const options = flags[reader[1] as keyof typeof flags].exec(remainder);
  if (!options) return undefined;
  return (
    /^\\?"\$([A-Za-z_]\w*)(\/[-\w./]+)\\?"$/u.exec(remainder.slice(options[0].length)) ?? undefined
  );
}
