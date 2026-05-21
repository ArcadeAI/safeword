// Parser + classifier for SHA-or-skip checkbox annotations (ticket J7VBGJ).
// Used by the write-time gate, the commit-time gate, and the done gate to
// answer one question consistently: "what does this checkbox claim?"
//
// RED-phase stub. Bodies throw until GREEN.

export type LedgerStep = 'RED' | 'GREEN' | 'REFACTOR' | 'cross-scenario';

export interface CheckboxAnnotation {
  step: LedgerStep;
  checked: boolean;
  annotation: string;
}

export type AnnotationKind =
  | { kind: 'none' }
  | { kind: 'skip'; reason: string }
  | { kind: 'sha'; value: string };

export function parseCheckboxAnnotation(_line: string): CheckboxAnnotation | null {
  throw new Error('parseCheckboxAnnotation: not implemented (RED stub)');
}

export function classifyAnnotation(_annotation: string): AnnotationKind {
  throw new Error('classifyAnnotation: not implemented (RED stub)');
}

export function isValidSkipReason(_reason: string): boolean {
  throw new Error('isValidSkipReason: not implemented (RED stub)');
}
