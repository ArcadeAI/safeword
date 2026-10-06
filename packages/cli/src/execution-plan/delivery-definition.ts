import type {
  ExecutionPlanChecklistDefinitionItem,
  ExecutionPlanDeliveryDefinition,
  ExecutionPlanProofSpecification,
} from '../review/contract.js';
import { hasValidDeliveryDefinition } from '../review/execution-plan-output.js';
import { hasExecutionPlanDeliveryChecklist, splitExecutionPlanRow } from './review-identity.js';

const PROOF_HEADER = [
  'Proof ID',
  'Method',
  'Scope',
  'Boundary exercised',
  'Qualifies as',
  'Currency',
  'Invocation',
];
const CHECKLIST_HEADER = [
  'ID',
  'Category',
  'Obligation',
  'Owner',
  'Required proof',
  'Disposition',
  'Evidence class',
  'Revision',
  'Evidence, reason, or dependency',
];
const JSON_NULL = JSON.parse('null') as null;

function sectionLines(content: string, heading: string): string[] {
  const lines = content.split('\n');
  const section = lines.findIndex(line => line.trim() === heading);
  if (section === -1 || lines.some((line, index) => index > section && line.trim() === heading)) {
    throw new Error(`Execution Plan must contain exactly one ${heading} section`);
  }
  const nextHeading = lines.findIndex((line, index) => index > section && line.startsWith('## '));
  const end = nextHeading === -1 ? lines.length : nextHeading;
  return lines.slice(section + 1, end);
}

function tableStartIndex(
  lines: readonly string[],
  heading: string,
  header: readonly string[],
): number {
  const headerIndex = lines.findIndex(
    line => JSON.stringify(splitExecutionPlanRow(line)) === JSON.stringify(header),
  );
  if (
    headerIndex === -1 ||
    splitExecutionPlanRow(lines[headerIndex + 1] ?? '')?.length !== header.length
  ) {
    throw new Error(`Execution Plan ${heading} table is missing or malformed`);
  }
  const separator = splitExecutionPlanRow(lines[headerIndex + 1] ?? '');
  if (!separator?.every(cell => /^:?-{3,}:?$/u.test(cell))) {
    throw new Error(`Execution Plan ${heading} table separator is malformed`);
  }
  return headerIndex + 2;
}

function table(content: string, heading: string, header: readonly string[]): string[][] {
  const lines = sectionLines(content, heading);
  const rows: string[][] = [];
  const start = tableStartIndex(lines, heading, header);
  let end = start;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || line.trim() === '') {
      end = index;
      break;
    }
    const row = splitExecutionPlanRow(line);
    if (row?.length !== header.length) {
      throw new Error(`Execution Plan ${heading} table row is malformed`);
    }
    rows.push(row);
    end = index + 1;
  }
  if (rows.length === 0) throw new Error(`Execution Plan ${heading} table is empty`);
  if (lines.slice(end).some(line => splitExecutionPlanRow(line) !== undefined)) {
    throw new Error(`Execution Plan ${heading} contains another table`);
  }
  return rows;
}

function proof(row: readonly string[]): ExecutionPlanProofSpecification {
  let invocation: unknown;
  try {
    invocation = JSON.parse(row[6] ?? '');
  } catch {
    throw new Error(`Execution Plan proof ${row[0] ?? ''} has invalid Invocation JSON`);
  }
  return {
    proof_id: row[0] ?? '',
    method: row[1] as ExecutionPlanProofSpecification['method'],
    scope: row[2] as ExecutionPlanProofSpecification['scope'],
    boundary_exercised: row[3] ?? '',
    qualifies_as: row[4] as ExecutionPlanProofSpecification['qualifies_as'],
    currency: row[5] as ExecutionPlanProofSpecification['currency'],
    invocation: invocation as ExecutionPlanProofSpecification['invocation'],
  };
}

function checklistItem(row: readonly string[]): ExecutionPlanChecklistDefinitionItem {
  const disposition = row[5];
  const reviewedDisposition =
    disposition === 'not_applicable' || disposition === 'pending_human' ? disposition : JSON_NULL;
  return {
    id: row[0] ?? '',
    category: row[1] ?? '',
    obligation: row[2] ?? '',
    owner: row[3] as ExecutionPlanChecklistDefinitionItem['owner'],
    required_proof: row[4] ?? '',
    reviewed_disposition: reviewedDisposition,
    reviewed_detail: reviewedDisposition === JSON_NULL ? JSON_NULL : (row[8] ?? ''),
  };
}

/** Retain exactly the stable delivery definition, not mutable progress cells. */
export function executionPlanDeliveryDefinition(
  content: string,
  designApprovalGate: boolean,
): ExecutionPlanDeliveryDefinition {
  const proofIndex = content.indexOf('## Proof specifications');
  const checklistIndex = content.indexOf('## Delivery checklist');
  const marker = '<!-- safeword:delivery-checklist:v1 -->';
  const markerIndex = content.indexOf(marker, checklistIndex);
  if (
    !content.includes('## Proof specifications') ||
    checklistIndex <= proofIndex ||
    markerIndex <= checklistIndex ||
    !hasExecutionPlanDeliveryChecklist(content) ||
    content.indexOf(marker) !== markerIndex ||
    content.includes(marker, markerIndex + marker.length)
  ) {
    throw new Error('Execution Plan is missing the versioned Delivery Checklist');
  }
  const definition: ExecutionPlanDeliveryDefinition = {
    schema_version: 1,
    design_approval_gate: designApprovalGate,
    proof_specifications: table(content, '## Proof specifications', PROOF_HEADER).map(row =>
      proof(row),
    ),
    checklist_items: table(content, '## Delivery checklist', CHECKLIST_HEADER).map(row =>
      checklistItem(row),
    ),
  };
  if (!hasValidDeliveryDefinition(definition)) {
    throw new Error('Execution Plan delivery definition is invalid');
  }
  return definition;
}
