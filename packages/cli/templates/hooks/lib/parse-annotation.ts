// Parser + classifier for SHA-or-skip checkbox annotations (ticket J7VBGJ).
// Used by the write-time gate, the commit-time gate, and the done gate to
// answer one question consistently: "what does this checkbox claim?"

type LedgerStep = 'RED' | 'GREEN' | 'REFACTOR' | 'cross-scenario';

export interface CheckboxAnnotation {
  step: LedgerStep;
  checked: boolean;
  annotation: string;
}

export type AnnotationKind =
  | { kind: 'none' }
  | { kind: 'skip'; reason: string }
  | { kind: 'sha'; value: string };

// Matches a recognized step checkbox line, capturing the checkmark, the step
// keyword, and any trailing annotation. Word boundary after the step keyword
// prevents `REDish` / `cross-scenarios` from accidentally matching.
const CHECKBOX_LINE = /^\s*- \[([ xX])\] (RED|GREEN|REFACTOR|cross-scenario)\b\s*(.*)$/;

const SKIP_PREFIX = /^skip:(.*)$/i;

export function parseCheckboxAnnotation(line: string): CheckboxAnnotation | null {
  const match = CHECKBOX_LINE.exec(line);
  if (!match) return null;
  // Regex guarantees these groups exist when match succeeds; defaults satisfy
  // tsconfig.json noUncheckedIndexedAccess without changing semantics.
  const [, mark = '', step = '', rest = ''] = match;
  return {
    step: step as LedgerStep,
    checked: mark.toLowerCase() === 'x',
    annotation: rest.trim(),
  };
}

export function classifyAnnotation(annotation: string): AnnotationKind {
  if (annotation === '') return { kind: 'none' };
  const skipMatch = SKIP_PREFIX.exec(annotation);
  if (skipMatch) {
    return { kind: 'skip', reason: (skipMatch[1] ?? '').trim() };
  }
  return { kind: 'sha', value: annotation };
}

export function isValidSkipReason(reason: string): boolean {
  return reason.trim().length > 0;
}

/**
 * A git abbreviated-or-full object name: 7–40 hex chars. Used to reject
 * malformed annotations before they reach `git cat-file` — both as a clearer
 * ledger error and as defense-in-depth against shell metacharacters in a
 * file-derived annotation (the git call itself uses execFileSync, no shell).
 */
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

export function isValidSha(value: string): boolean {
  return SHA_PATTERN.test(value);
}
