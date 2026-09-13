export const DELIVERY_CHECKLIST_CATEGORIES = [
  'outcome and scope',
  'resolved decisions',
  'dependency and pull-request decomposition',
  'testing',
  'data and compatibility',
  'monitoring and failure signals',
  'security and privacy',
  'rollout and rollback',
  'documentation',
  'ownership and human dependencies',
  'completion evidence',
] as const;

export type DeliveryChecklistCategory = (typeof DELIVERY_CHECKLIST_CATEGORIES)[number];
export type DeliveryChecklistOwner = 'contributor' | 'human';
export type DeliveryChecklistDisposition = 'open' | 'complete' | 'not_applicable' | 'pending_human';
export type DeliveryEvidenceClass =
  | 'current_revision_real_boundary'
  | 'reusable_earlier_revision'
  | 'partial_or_structural'
  | 'missing';
export type DeliveryProofMethod = 'command' | 'review_receipt';
export type DeliveryProofScope = 'unit' | 'integration' | 'E2E' | 'eval';
export type DeliveryProofQualification = 'real_boundary' | 'partial_or_structural';
export type DeliveryProofCurrency = 'current_required' | 'compatible_earlier_allowed';

export interface DeliveryCommandInvocation {
  readonly type: 'command';
  readonly cwd: string;
  readonly argv: readonly string[];
}

export interface DeliveryReviewInvocation {
  readonly type: 'review_receipt';
  readonly kind: string;
  readonly targets: readonly string[];
}

export interface DeliveryProofSpecification {
  readonly id: string;
  readonly method: DeliveryProofMethod;
  readonly scope: DeliveryProofScope;
  readonly boundary: string;
  readonly qualifiesAs: DeliveryProofQualification;
  readonly currency: DeliveryProofCurrency;
  readonly invocation: DeliveryCommandInvocation | DeliveryReviewInvocation;
}

export interface DeliveryChecklistItem {
  readonly id: string;
  readonly category: DeliveryChecklistCategory;
  readonly obligation: string;
  readonly owner: DeliveryChecklistOwner;
  readonly requiredProof: string;
  readonly disposition: DeliveryChecklistDisposition;
  readonly evidenceClass: DeliveryEvidenceClass;
  readonly revision: string;
  readonly evidence: string;
}

export type DeliveryChecklistResult =
  | { readonly ok: true; readonly items: readonly DeliveryChecklistItem[] }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly missingCategories?: readonly DeliveryChecklistCategory[];
    };

export type DeliveryProofSpecificationsResult =
  | { readonly ok: true; readonly specifications: readonly DeliveryProofSpecification[] }
  | { readonly ok: false; readonly code: string; readonly message: string };

const MARKER = '<!-- safeword:delivery-checklist:v1 -->';
const HEADERS = [
  'ID',
  'Category',
  'Obligation',
  'Owner',
  'Required proof',
  'Disposition',
  'Evidence class',
  'Revision',
  'Evidence, reason, or dependency',
] as const;
const PROOF_HEADERS = [
  'Proof ID',
  'Method',
  'Scope',
  'Boundary exercised',
  'Qualifies as',
  'Currency',
  'Invocation',
] as const;
const OWNERS = new Set<DeliveryChecklistOwner>(['contributor', 'human']);
const DISPOSITIONS = new Set<DeliveryChecklistDisposition>([
  'open',
  'complete',
  'not_applicable',
  'pending_human',
]);
const EVIDENCE_CLASSES = new Set<DeliveryEvidenceClass>([
  'current_revision_real_boundary',
  'reusable_earlier_revision',
  'partial_or_structural',
  'missing',
]);
const PROOF_METHODS = new Set<DeliveryProofMethod>(['command', 'review_receipt']);
const PROOF_SCOPES = new Set<DeliveryProofScope>(['unit', 'integration', 'E2E', 'eval']);
const PROOF_QUALIFICATIONS = new Set<DeliveryProofQualification>([
  'real_boundary',
  'partial_or_structural',
]);
const PROOF_CURRENCIES = new Set<DeliveryProofCurrency>([
  'current_required',
  'compatible_earlier_allowed',
]);

function invalid(code: string, message: string): DeliveryChecklistResult {
  return { ok: false, code, message };
}

function splitRow(line: string): string[] | undefined {
  if (!line.trimStart().startsWith('|') || !line.trimEnd().endsWith('|')) return undefined;
  const cells: string[] = [];
  let cell = '';
  let escaped = false;
  const body = line.trim().slice(1, -1);
  for (const character of body) {
    if (escaped) {
      cell += character;
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += character;
    }
  }
  if (escaped) cell += '\\';
  cells.push(cell.trim());
  return cells;
}

function isSeparator(cells: readonly string[]): boolean {
  return cells.every(cell => /^:?-{3,}:?$/u.test(cell));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProjectContainedPath(value: string): boolean {
  if (value === '' || value.startsWith('/') || value.startsWith('\\')) return false;
  if (/^[A-Za-z]:[\\/]/u.test(value) || value.includes('\0')) return false;
  return !value.split(/[\\/]/u).includes('..');
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every(key => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function parseJsonRecord(source: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(source);
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function parseCommandInvocation(
  value: Record<string, unknown>,
): DeliveryCommandInvocation | undefined {
  if (!hasOnlyKeys(value, ['type', 'cwd', 'argv']) || value.type !== 'command') return undefined;
  if (typeof value.cwd !== 'string' || !isProjectContainedPath(value.cwd)) return undefined;
  if (
    !Array.isArray(value.argv) ||
    value.argv.length === 0 ||
    value.argv.some(argument => typeof argument !== 'string' || argument === '')
  ) {
    return undefined;
  }
  return { type: 'command', cwd: value.cwd, argv: value.argv as string[] };
}

function parseReviewInvocation(
  value: Record<string, unknown>,
): DeliveryReviewInvocation | undefined {
  if (!hasOnlyKeys(value, ['type', 'kind', 'targets'])) return undefined;
  if (value.type !== 'review_receipt') return undefined;
  if (typeof value.kind !== 'string' || value.kind === '') return undefined;
  if (
    !Array.isArray(value.targets) ||
    value.targets.length === 0 ||
    value.targets.some(target => !(typeof target === 'string' && isProjectContainedPath(target)))
  ) {
    return undefined;
  }
  return { type: 'review_receipt', kind: value.kind, targets: value.targets as string[] };
}

function parseInvocation(
  method: DeliveryProofMethod,
  source: string,
): DeliveryCommandInvocation | DeliveryReviewInvocation | undefined {
  const value = parseJsonRecord(source);
  if (value === undefined) return undefined;
  return method === 'command' ? parseCommandInvocation(value) : parseReviewInvocation(value);
}

function parseProofSpecification(cells: readonly string[]): DeliveryProofSpecification | undefined {
  if (cells.length !== PROOF_HEADERS.length) return undefined;
  const [id, method, scope, boundary, qualifiesAs, currency, invocationSource] = cells as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  if (
    id === '' ||
    boundary === '' ||
    !PROOF_METHODS.has(method as DeliveryProofMethod) ||
    !PROOF_SCOPES.has(scope as DeliveryProofScope) ||
    !PROOF_QUALIFICATIONS.has(qualifiesAs as DeliveryProofQualification) ||
    !PROOF_CURRENCIES.has(currency as DeliveryProofCurrency)
  ) {
    return undefined;
  }
  const typedMethod = method as DeliveryProofMethod;
  const invocation = parseInvocation(typedMethod, invocationSource);
  if (invocation === undefined) return undefined;
  return {
    id,
    method: typedMethod,
    scope: scope as DeliveryProofScope,
    boundary,
    qualifiesAs: qualifiesAs as DeliveryProofQualification,
    currency: currency as DeliveryProofCurrency,
    invocation,
  };
}

function parseItem(cells: readonly string[]): DeliveryChecklistItem | undefined {
  if (cells.length !== HEADERS.length) return undefined;
  const [
    id,
    category,
    obligation,
    owner,
    requiredProof,
    disposition,
    evidenceClass,
    revision,
    evidence,
  ] = cells as [string, string, string, string, string, string, string, string, string];
  const fieldsAreValid = [
    id !== '',
    obligation !== '',
    DELIVERY_CHECKLIST_CATEGORIES.includes(category as DeliveryChecklistCategory),
    OWNERS.has(owner as DeliveryChecklistOwner),
    DISPOSITIONS.has(disposition as DeliveryChecklistDisposition),
    EVIDENCE_CLASSES.has(evidenceClass as DeliveryEvidenceClass),
  ].every(Boolean);
  if (!fieldsAreValid) return undefined;
  return {
    id,
    category: category as DeliveryChecklistCategory,
    obligation,
    owner: owner as DeliveryChecklistOwner,
    requiredProof,
    disposition: disposition as DeliveryChecklistDisposition,
    evidenceClass: evidenceClass as DeliveryEvidenceClass,
    revision,
    evidence,
  };
}

function tableStart(lines: readonly string[], markerIndex: number): number {
  const relative = lines.slice(markerIndex + 1).findIndex(line => line.trim() !== '');
  return relative === -1 ? -1 : markerIndex + relative + 1;
}

function validHeader(lines: readonly string[], start: number): boolean {
  const header = splitRow(lines[start] ?? '');
  const separator = splitRow(lines[start + 1] ?? '');
  return (
    header?.length === HEADERS.length &&
    header.every((value, index) => value === HEADERS[index]) &&
    separator?.length === HEADERS.length &&
    isSeparator(separator)
  );
}

function validProofHeader(lines: readonly string[], start: number): boolean {
  const header = splitRow(lines[start] ?? '');
  const separator = splitRow(lines[start + 1] ?? '');
  return (
    header?.length === PROOF_HEADERS.length &&
    header.every((value, index) => value === PROOF_HEADERS[index]) &&
    separator?.length === PROOF_HEADERS.length &&
    isSeparator(separator)
  );
}

function parseItems(lines: readonly string[], start: number): DeliveryChecklistResult {
  const items: DeliveryChecklistItem[] = [];
  const candidates = lines.slice(start + 2);
  for (const [index, line] of candidates.entries()) {
    if (line.trim() === '' || !line.trimStart().startsWith('|')) break;
    const item = parseItem(splitRow(line) ?? []);
    if (item === undefined) {
      return invalid(
        'invalid_delivery_checklist',
        `Delivery Checklist row ${index + 1} is invalid.`,
      );
    }
    items.push(item);
  }
  if (items.length === 0) {
    return invalid('invalid_delivery_checklist', 'The Delivery Checklist has no items.');
  }
  const invalidHandoff = items.find(
    item => item.owner === 'contributor' && item.disposition === 'pending_human',
  );
  if (invalidHandoff !== undefined) {
    return invalid(
      'invalid_owner_disposition',
      `Delivery Checklist item ${invalidHandoff.id} is contributor-owned and cannot be pending_human.`,
    );
  }
  const present = new Set(items.map(item => item.category));
  const missingCategories = DELIVERY_CHECKLIST_CATEGORIES.filter(
    category => !present.has(category),
  );
  if (missingCategories.length > 0) {
    return {
      ok: false,
      code: 'missing_categories',
      message: `Delivery Checklist is missing categories: ${missingCategories.join(', ')}.`,
      missingCategories,
    };
  }
  return { ok: true, items };
}

export function parseDeliveryChecklist(content: string): DeliveryChecklistResult {
  const lines = content.split(/\r?\n/u);
  const markerIndex = lines.findIndex(line => line.trim() === MARKER);
  if (markerIndex === -1) {
    return invalid(
      'missing_delivery_checklist',
      'execution-plan.md is missing the Delivery Checklist.',
    );
  }
  const start = tableStart(lines, markerIndex);
  if (start === -1 || !validHeader(lines, start)) {
    return invalid('invalid_delivery_checklist', 'The Delivery Checklist table header is invalid.');
  }
  return parseItems(lines, start);
}

function parseProofRows(
  lines: readonly string[],
  start: number,
): DeliveryProofSpecificationsResult {
  const specifications: DeliveryProofSpecification[] = [];
  const identifiers = new Set<string>();
  const candidates = lines.slice(start + 2);
  for (const [index, line] of candidates.entries()) {
    if (line.trim() === '' || !line.trimStart().startsWith('|')) break;
    const specification = parseProofSpecification(splitRow(line) ?? []);
    if (specification === undefined) {
      return {
        ok: false,
        code: 'invalid_proof_specifications',
        message: `Proof specifications row ${index + 1} is invalid.`,
      };
    }
    if (identifiers.has(specification.id)) {
      return {
        ok: false,
        code: 'duplicate_proof_id',
        message: `Proof ID ${specification.id} appears more than once.`,
      };
    }
    identifiers.add(specification.id);
    specifications.push(specification);
  }
  if (specifications.length === 0) {
    return {
      ok: false,
      code: 'invalid_proof_specifications',
      message: 'Proof specifications has no rows.',
    };
  }
  return { ok: true, specifications };
}

export function parseProofSpecifications(content: string): DeliveryProofSpecificationsResult {
  const lines = content.split(/\r?\n/u);
  const headingIndex = lines.findIndex(line => line.trim() === '## Proof specifications');
  if (headingIndex === -1) {
    return {
      ok: false,
      code: 'missing_proof_specifications',
      message: 'execution-plan.md is missing Proof specifications.',
    };
  }
  const start = tableStart(lines, headingIndex);
  if (start === -1 || !validProofHeader(lines, start)) {
    return {
      ok: false,
      code: 'invalid_proof_specifications',
      message: 'The Proof specifications table header is invalid.',
    };
  }
  return parseProofRows(lines, start);
}
