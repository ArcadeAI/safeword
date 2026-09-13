import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';

import type { ExecutionPlanDeliveryDefinition } from '../review/contract.js';

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

export type DeliveryPlanContractResult =
  | Extract<DeliveryChecklistResult, { readonly ok: false }>
  | Extract<DeliveryProofSpecificationsResult, { readonly ok: false }>
  | {
      readonly ok: true;
      readonly items: readonly DeliveryChecklistItem[];
      readonly specifications: readonly DeliveryProofSpecification[];
    };

export type DeliveryChecklistUpdateResult =
  { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string };
type DeliveryChecklistUpdateFailure = Extract<
  DeliveryChecklistUpdateResult,
  { readonly ok: false }
>;

export interface DeliveryStableChecklistItem {
  readonly id: string;
  readonly category: DeliveryChecklistCategory;
  readonly obligation: string;
  readonly owner: DeliveryChecklistOwner;
  readonly requiredProof: string;
  readonly reviewedDisposition?: {
    readonly disposition: 'not_applicable' | 'pending_human';
    readonly detail: string;
  };
}

export interface DeliveryStableDefinition {
  readonly schemaVersion: 1;
  readonly designApprovalGate: boolean;
  readonly specifications: readonly DeliveryProofSpecification[];
  readonly items: readonly DeliveryStableChecklistItem[];
}

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

function unescapedPipeOffsets(line: string): number[] {
  const offsets: number[] = [];
  let escaped = false;
  let index = 0;
  while (index < line.length) {
    const character = line[index];
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === '|') {
      offsets.push(index);
    }
    index += 1;
  }
  return offsets;
}

function normalizeProgressCells(line: string): string {
  const cells = splitRow(line);
  const item = cells === undefined ? undefined : parseItem(cells);
  if (
    item === undefined ||
    item.disposition === 'not_applicable' ||
    item.disposition === 'pending_human'
  ) {
    return line;
  }
  const pipes = unescapedPipeOffsets(line);
  if (pipes.length !== HEADERS.length + 1) return line;
  const stableEnd = pipes[5];
  const finalPipe = pipes[9];
  if (stableEnd === undefined || finalPipe === undefined) return line;
  return `${line.slice(0, stableEnd + 1)} <progress> | <progress> | <progress> | <progress> ${line.slice(finalPipe)}`;
}

/** Hash every Execution Plan byte except ordinary contributor progress cells. */
export function normalizedExecutionPlanDigest(content: string): string {
  const lines = content.split('\n');
  const markerIndex = lines.findIndex(line => line.trim() === MARKER);
  if (markerIndex !== -1) {
    for (let index = markerIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line !== undefined) lines[index] = normalizeProgressCells(line);
    }
  }
  return createHash('sha256').update(lines.join('\n')).digest('hex');
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

function ownerDispositionDefect(item: DeliveryChecklistItem): DeliveryChecklistResult | undefined {
  if (item.owner === 'contributor' && item.disposition === 'pending_human') {
    return invalid(
      'invalid_owner_disposition',
      `Delivery Checklist item ${item.id} is contributor-owned and cannot be pending_human.`,
    );
  }
  if (item.owner === 'human' && ['open', 'complete'].includes(item.disposition)) {
    return invalid(
      'invalid_owner_disposition',
      `Delivery Checklist item ${item.id} is human-owned and cannot be ${item.disposition}.`,
    );
  }
  return undefined;
}

function isReceiptLocator(value: string): boolean {
  const [receipt, compatibility, extra] = value.split('; compatible:', 3);
  const identifier = receipt?.startsWith('receipt:') ? receipt.slice('receipt:'.length) : '';
  if (
    extra !== undefined ||
    identifier === '' ||
    identifier.includes(';') ||
    /\s/u.test(identifier)
  ) {
    return false;
  }
  return compatibility?.trim() !== '';
}

function hasMissingEvidence(item: DeliveryChecklistItem): boolean {
  return item.evidenceClass === 'missing' && item.revision === '';
}

function hasContributorProof(item: DeliveryChecklistItem): boolean {
  return item.owner === 'contributor' && item.requiredProof !== '';
}

function openFieldsAreValid(item: DeliveryChecklistItem): boolean {
  if (!hasContributorProof(item)) return false;
  if (item.evidence === '') return hasMissingEvidence(item);
  return (
    !item.evidence.includes('; compatible:') &&
    isReceiptLocator(item.evidence) &&
    item.revision !== ''
  );
}

function completeFieldsAreValid(item: DeliveryChecklistItem): boolean {
  return (
    hasContributorProof(item) &&
    isReceiptLocator(item.evidence) &&
    item.revision !== '' &&
    ['current_revision_real_boundary', 'reusable_earlier_revision'].includes(item.evidenceClass)
  );
}

function notApplicableFieldsAreValid(item: DeliveryChecklistItem): boolean {
  return item.requiredProof === '' && item.evidence !== '' && hasMissingEvidence(item);
}

function pendingHumanFieldsAreValid(item: DeliveryChecklistItem): boolean {
  return (
    item.owner === 'human' &&
    item.requiredProof === '' &&
    item.evidence !== '' &&
    hasMissingEvidence(item)
  );
}

function dispositionFieldsAreValid(item: DeliveryChecklistItem): boolean {
  switch (item.disposition) {
    case 'open': {
      return openFieldsAreValid(item);
    }
    case 'complete': {
      return completeFieldsAreValid(item);
    }
    case 'not_applicable': {
      return notApplicableFieldsAreValid(item);
    }
    case 'pending_human': {
      return pendingHumanFieldsAreValid(item);
    }
  }
}

function dispositionDefect(item: DeliveryChecklistItem): DeliveryChecklistResult | undefined {
  const ownership = ownerDispositionDefect(item);
  if (ownership !== undefined) return ownership;
  if (dispositionFieldsAreValid(item)) return undefined;
  return invalid(
    'invalid_delivery_checklist',
    `Delivery Checklist item ${item.id} has invalid fields for ${item.disposition}.`,
  );
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
  const identifiers = new Set<string>();
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
    if (identifiers.has(item.id)) {
      return invalid(
        'duplicate_checklist_id',
        `Delivery Checklist ID ${item.id} appears more than once.`,
      );
    }
    const disposition = dispositionDefect(item);
    if (disposition !== undefined) return disposition;
    identifiers.add(item.id);
    items.push(item);
  }
  if (items.length === 0) {
    return invalid('invalid_delivery_checklist', 'The Delivery Checklist has no items.');
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

export function parseDeliveryPlanContract(content: string): DeliveryPlanContractResult {
  const proofs = parseProofSpecifications(content);
  if (!proofs.ok) return proofs;
  const checklist = parseDeliveryChecklist(content);
  if (!checklist.ok) return checklist;
  const lines = content.split(/\r?\n/u);
  const proofHeading = lines.findIndex(line => line.trim() === '## Proof specifications');
  const checklistMarker = lines.findIndex(line => line.trim() === MARKER);
  if (proofHeading > checklistMarker) {
    return {
      ok: false,
      code: 'invalid_proof_specifications',
      message: 'Proof specifications must appear before the Delivery Checklist.',
    };
  }
  const specificationsById = new Map(
    proofs.specifications.map(specification => [specification.id, specification]),
  );
  const unsupported = checklist.items.find(item => {
    if (item.owner !== 'contributor' || item.disposition === 'not_applicable') return false;
    return specificationsById.get(item.requiredProof)?.qualifiesAs !== 'real_boundary';
  });
  if (unsupported !== undefined) {
    return {
      ok: false,
      code: 'required_proof_not_real_boundary',
      message: `Delivery Checklist item ${unsupported.id} requires ${unsupported.requiredProof}, which is not a real-boundary proof.`,
    };
  }
  return {
    ok: true,
    items: checklist.items,
    specifications: proofs.specifications,
  };
}

function cloneProofSpecification(
  specification: DeliveryProofSpecification,
): DeliveryProofSpecification {
  const invocation =
    specification.invocation.type === 'command'
      ? { ...specification.invocation, argv: [...specification.invocation.argv] }
      : { ...specification.invocation, targets: [...specification.invocation.targets] };
  return { ...specification, invocation };
}

function stableChecklistItem(item: DeliveryChecklistItem): DeliveryStableChecklistItem {
  const stable = {
    id: item.id,
    category: item.category,
    obligation: item.obligation,
    owner: item.owner,
    requiredProof: item.requiredProof,
  };
  if (item.disposition !== 'not_applicable' && item.disposition !== 'pending_human') return stable;
  return {
    ...stable,
    reviewedDisposition: {
      disposition: item.disposition,
      detail: item.evidence,
    },
  };
}

export function createDeliveryStableDefinition(
  plan: Extract<DeliveryPlanContractResult, { readonly ok: true }>,
  designApprovalGate: boolean,
): DeliveryStableDefinition {
  return {
    schemaVersion: 1,
    designApprovalGate,
    specifications: plan.specifications.map(specification =>
      cloneProofSpecification(specification),
    ),
    items: plan.items.map(item => stableChecklistItem(item)),
  };
}

const JSON_NULL = JSON.parse('null') as null;

export function createExecutionPlanDeliveryDefinition(
  plan: Extract<DeliveryPlanContractResult, { readonly ok: true }>,
  designApprovalGate: boolean,
): ExecutionPlanDeliveryDefinition {
  const stable = createDeliveryStableDefinition(plan, designApprovalGate);
  return {
    schema_version: stable.schemaVersion,
    design_approval_gate: stable.designApprovalGate,
    proof_specifications: stable.specifications.map(specification => ({
      proof_id: specification.id,
      method: specification.method,
      scope: specification.scope,
      boundary_exercised: specification.boundary,
      qualifies_as: specification.qualifiesAs,
      currency: specification.currency,
      invocation: specification.invocation,
    })),
    checklist_items: stable.items.map(item => ({
      id: item.id,
      category: item.category,
      obligation: item.obligation,
      owner: item.owner,
      required_proof: item.requiredProof,
      reviewed_disposition: item.reviewedDisposition?.disposition ?? JSON_NULL,
      reviewed_detail: item.reviewedDisposition?.detail ?? JSON_NULL,
    })),
  };
}

function checklistRowIndex(lines: readonly string[], itemId: string): number | undefined {
  const markerIndex = lines.findIndex(line => line.trim() === MARKER);
  if (markerIndex === -1) return undefined;
  const start = tableStart(lines, markerIndex);
  if (start === -1) return undefined;
  for (let index = start + 2; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || line.trim() === '' || !line.trimStart().startsWith('|')) break;
    if (parseItem(splitRow(line) ?? [])?.id === itemId) return index;
  }
  return undefined;
}

function updateFailure(code: string, message: string): DeliveryChecklistUpdateFailure {
  return { ok: false, code, message };
}

interface DeliveryChecklistUpdateInput {
  readonly path: string;
  readonly expectedContent: string;
  readonly itemId: string;
  readonly proofId: string;
  readonly receiptId: string;
  readonly revision: string;
  readonly evidenceClass: Extract<
    DeliveryEvidenceClass,
    'current_revision_real_boundary' | 'reusable_earlier_revision'
  >;
  readonly compatibilityReason?: string;
}

function validateChecklistUpdate(
  input: DeliveryChecklistUpdateInput,
): DeliveryChecklistUpdateResult {
  const contract = parseDeliveryPlanContract(input.expectedContent);
  if (!contract.ok) return updateFailure(contract.code, contract.message);
  const item = contract.items.find(candidate => candidate.id === input.itemId);
  if (item === undefined) {
    return updateFailure(
      'unknown_checklist_item',
      `Delivery Checklist item ${input.itemId} was not found.`,
    );
  }
  if (item.owner !== 'contributor') {
    return updateFailure(
      'human_owned_item',
      `Delivery Checklist item ${input.itemId} is human-owned.`,
    );
  }
  if (item.requiredProof !== input.proofId) {
    return updateFailure(
      'proof_id_mismatch',
      `Delivery Checklist item ${input.itemId} requires proof ${item.requiredProof}.`,
    );
  }
  if (!/^[a-f\d]{40,64}$/u.test(input.revision) || input.receiptId.trim() === '') {
    return updateFailure('invalid_delivery_receipt', 'The delivery receipt identity is invalid.');
  }
  if (
    input.evidenceClass === 'reusable_earlier_revision' &&
    (input.compatibilityReason === undefined || input.compatibilityReason.trim() === '')
  ) {
    return updateFailure(
      'compatible_reason_required',
      'Reusable earlier-revision evidence requires a compatibility reason.',
    );
  }
  return { ok: true };
}

function deliveryEvidence(input: DeliveryChecklistUpdateInput): string | undefined {
  const reason = input.compatibilityReason?.trim();
  const compatibility = reason === undefined ? '' : `; compatible:${reason}`;
  const evidence = `receipt:${input.receiptId}${compatibility}`;
  return /[\r\n|]/u.test(evidence) ? undefined : evidence;
}

function updatedChecklistContent(
  input: DeliveryChecklistUpdateInput,
): DeliveryChecklistUpdateFailure | { readonly ok: true; readonly content: string } {
  const lines = input.expectedContent.split('\n');
  const rowIndex = checklistRowIndex(lines, input.itemId);
  const row = rowIndex === undefined ? undefined : lines[rowIndex];
  const pipes = row === undefined ? [] : unescapedPipeOffsets(row);
  if (rowIndex === undefined || row === undefined || pipes.length !== HEADERS.length + 1) {
    return updateFailure('invalid_delivery_checklist', 'The Delivery Checklist row is invalid.');
  }
  const stableEnd = pipes[5];
  const finalPipe = pipes[9];
  if (stableEnd === undefined || finalPipe === undefined) {
    return updateFailure('invalid_delivery_checklist', 'The Delivery Checklist row is invalid.');
  }
  const evidence = deliveryEvidence(input);
  if (evidence === undefined) {
    return updateFailure('invalid_delivery_receipt', 'The delivery receipt locator is invalid.');
  }
  lines[rowIndex] =
    `${row.slice(0, stableEnd + 1)} complete | ${input.evidenceClass} | ${input.revision} | ${evidence} ${row.slice(finalPipe)}`;
  return { ok: true, content: lines.join('\n') };
}

function safeUnlink(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // Cleanup is best effort; an abandoned lock is surfaced on a later retry.
  }
}

function replaceExactPlanSnapshot(
  input: DeliveryChecklistUpdateInput,
  updated: string,
): DeliveryChecklistUpdateResult {
  const lockPath = `${input.path}.delivery-lock`;
  let descriptor: number;
  try {
    descriptor = openSync(
      lockPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    );
  } catch {
    return updateFailure(
      'delivery_update_pending',
      'Another Delivery Checklist update is in progress.',
    );
  }
  const temporary = `${input.path}.${randomUUID()}.tmp`;
  try {
    closeSync(descriptor);
    if (readFileSync(input.path, 'utf8') !== input.expectedContent) {
      return updateFailure(
        'execution_plan_changed',
        'execution-plan.md changed while proof was being recorded; retry with the retained receipt.',
      );
    }
    writeFileSync(temporary, updated);
    renameSync(temporary, input.path);
    return { ok: true };
  } catch {
    return updateFailure('delivery_update_failed', 'Safeword could not update execution-plan.md.');
  } finally {
    safeUnlink(temporary);
    safeUnlink(lockPath);
  }
}

/** Replace only one checklist row's mutable progress cells from an exact plan snapshot. */
export function updateDeliveryChecklistFile(
  input: DeliveryChecklistUpdateInput,
): DeliveryChecklistUpdateResult {
  const validation = validateChecklistUpdate(input);
  if (!validation.ok) return validation;
  const updated = updatedChecklistContent(input);
  if (!updated.ok) return updated;
  return replaceExactPlanSnapshot(input, updated.content);
}
