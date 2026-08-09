import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

const STARTS = [
  '<!-- safeword:compatibility:start -->',
  '{/* safeword:compatibility:start */}',
] as const;
const ENDS = ['<!-- safeword:compatibility:end -->', '{/* safeword:compatibility:end */}'] as const;
const DEPRECATED_COMMAND = /`setup(?:\s|`)|\bsafeword(?:@latest)?\s+setup\b/iu;

export interface TerminologyFinding {
  readonly file: string;
  readonly line: number;
  readonly code:
    | 'CLI_TERMINOLOGY_DEPRECATED_OPERATIVE_TEXT'
    | 'CLI_TERMINOLOGY_UNCLOSED_COMPATIBILITY'
    | 'CLI_TERMINOLOGY_REVERSED_COMPATIBILITY'
    | 'CLI_TERMINOLOGY_NESTED_COMPATIBILITY';
}

interface DelimiterTransition {
  readonly insideCompatibility: boolean;
  readonly code?: TerminologyFinding['code'];
}

function delimiterTransition(
  line: string,
  insideCompatibility: boolean,
): DelimiterTransition | undefined {
  if (STARTS.some(marker => line.includes(marker))) {
    return insideCompatibility
      ? { insideCompatibility, code: 'CLI_TERMINOLOGY_NESTED_COMPATIBILITY' }
      : { insideCompatibility: true };
  }
  if (ENDS.some(marker => line.includes(marker))) {
    return insideCompatibility
      ? { insideCompatibility: false }
      : { insideCompatibility, code: 'CLI_TERMINOLOGY_REVERSED_COMPATIBILITY' };
  }
  return undefined;
}

export function checkCliTerminology(file: string, source: string): TerminologyFinding[] {
  const findings: TerminologyFinding[] = [];
  let insideCompatibility = false;
  const lines = source.split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const transition = delimiterTransition(line, insideCompatibility);
    if (transition !== undefined) {
      insideCompatibility = transition.insideCompatibility;
      if (transition.code !== undefined) {
        findings.push({ file, line: lineNumber, code: transition.code });
      }
      continue;
    }
    if (!insideCompatibility && DEPRECATED_COMMAND.test(line)) {
      findings.push({
        file,
        line: lineNumber,
        code: 'CLI_TERMINOLOGY_DEPRECATED_OPERATIVE_TEXT',
      });
    }
  }
  if (insideCompatibility) {
    findings.push({
      file,
      line: lines.length,
      code: 'CLI_TERMINOLOGY_UNCLOSED_COMPATIBILITY',
    });
  }
  return findings;
}

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const inventory = [
  'README.md',
  'plugin/README.md',
  'packages/website/src/content/docs/reference/cli.mdx',
  'packages/website/src/content/docs/reference/configuration.mdx',
  'packages/cli/src/parity.ts',
] as const;

if (import.meta.main) {
  const findings = inventory
    .flatMap(file => checkCliTerminology(file, readFileSync(nodePath.join(repoRoot, file), 'utf8')))
    .toSorted((left, right) =>
      `${left.file}:${left.line}`.localeCompare(`${right.file}:${right.line}`),
    );
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} ${finding.code}`);
  }
  if (findings.length > 0) process.exitCode = 1;
}
