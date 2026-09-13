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
  return cells.length === HEADERS.length && cells.every(cell => /^:?-{3,}:?$/u.test(cell));
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
    header !== undefined &&
    header.every((value, index) => value === HEADERS[index]) &&
    separator !== undefined &&
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
