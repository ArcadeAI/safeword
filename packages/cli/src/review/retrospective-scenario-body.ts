import { createHash } from 'node:crypto';

function scenarioTitle(line: string): string | undefined {
  const trimmed = line.trimStart();
  const prefixes = ['Scenario Outline:', 'Scenario Template:', 'Scenario:', 'Example:'];
  const prefix = prefixes.find(candidate => trimmed.startsWith(candidate));
  if (prefix !== undefined) return trimmed.slice(prefix.length).trim();
  return undefined;
}

function isBoundary(line: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith('Rule:') || trimmed.startsWith('Feature:');
}

interface Boundary {
  readonly index: number;
  readonly title?: string;
}

function scenarioBoundaries(lines: readonly string[]): Boundary[] {
  const boundaries: Boundary[] = [];
  let docstringFence: '"""' | '```' | undefined;
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trimStart();
    if (docstringFence !== undefined) {
      if (trimmed.startsWith(docstringFence)) docstringFence = undefined;
      continue;
    }
    if (trimmed.startsWith('"""') || trimmed.startsWith('```')) {
      docstringFence = trimmed.startsWith('"""') ? '"""' : '```';
      continue;
    }
    const title = scenarioTitle(line);
    if (title !== undefined || isBoundary(line)) boundaries.push({ index, title });
  }
  return boundaries;
}

/** Digest the exact text of one uniquely named Gherkin scenario block. */
export function scenarioBodyDigest(feature: string, heading: string): string | undefined {
  const lines = feature.split(/(?<=\n)/u);
  const boundaries = scenarioBoundaries(lines);
  const matches = boundaries.flatMap((boundary, index) =>
    boundary.title === heading
      ? [lines.slice(boundary.index, boundaries[index + 1]?.index ?? lines.length).join('')]
      : [],
  );
  const [match] = matches;
  return matches.length === 1 && match !== undefined
    ? createHash('sha256').update(match).digest('hex')
    : undefined;
}
