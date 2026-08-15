import nodePath from 'node:path';

function matchesSegment(value: string, pattern: string): boolean {
  let positions = new Set([0]);
  for (const token of pattern) {
    // eslint-disable-next-line security/detect-possible-timing-attacks -- Local path operands are not secrets.
    if (token === '*') {
      const expanded = new Set(positions);
      for (const start of positions) {
        for (let index = start + 1; index <= value.length; index += 1) expanded.add(index);
      }
      positions = expanded;
    } else {
      positions = new Set(
        [...positions]
          .filter(index => index < value.length && (token === '?' || value[index] === token))
          .map(index => index + 1),
      );
    }
  }
  return positions.has(value.length);
}

export function matchesWorkspacePattern(relative: string, pattern: string): boolean {
  const values = relative.split(nodePath.sep).filter(Boolean);
  const patterns = pattern.replaceAll('\\', '/').split('/').filter(Boolean);
  const visit = (valueIndex: number, patternIndex: number): boolean => {
    const part = patterns[patternIndex];
    if (part === undefined) return valueIndex === values.length;
    if (part === '**') {
      return (
        visit(valueIndex, patternIndex + 1) ||
        (valueIndex < values.length && visit(valueIndex + 1, patternIndex))
      );
    }
    return (
      valueIndex < values.length &&
      matchesSegment(values[valueIndex] ?? '', part) &&
      visit(valueIndex + 1, patternIndex + 1)
    );
  };
  return visit(0, 0);
}
