import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

const DELIVERY_CHECKLIST_MARKER = '<!-- safeword:delivery-checklist:v1 -->';
const DELIVERY_CHECKLIST_COLUMNS = 9;
const ORDINARY_PROGRESS_DISPOSITIONS = new Set(['open', 'complete']);

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
  if (
    cells?.length !== DELIVERY_CHECKLIST_COLUMNS ||
    !ORDINARY_PROGRESS_DISPOSITIONS.has(cells[5] ?? '')
  ) {
    return line;
  }
  const pipes = unescapedPipeOffsets(line);
  if (pipes.length !== DELIVERY_CHECKLIST_COLUMNS + 1) return line;
  const stableEnd = pipes[5];
  const finalPipe = pipes[9];
  if (stableEnd === undefined || finalPipe === undefined) return line;
  return `${line.slice(0, stableEnd + 1)} <progress> | <progress> | <progress> | <progress> ${line.slice(finalPipe)}`;
}

/** Hash every Execution Plan byte except ordinary contributor progress cells. */
export function normalizedExecutionPlanDigest(content: string): string {
  const lines = content.split('\n');
  const markerIndex = lines.findIndex(line => line.trim() === DELIVERY_CHECKLIST_MARKER);
  if (markerIndex !== -1) {
    for (let index = markerIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line !== undefined) lines[index] = normalizeProgressCells(line);
    }
  }
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

export function executionPlanDesignApprovalGate(projectDirectory: string): boolean {
  const path = nodePath.join(projectDirectory, '.safeword', 'config.json');
  if (!existsSync(path)) return false;
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Safeword config root is not an object');
  }
  return (value as { readonly designApprovalGate?: unknown }).designApprovalGate === true;
}

/** Stable identity shared by review producers and distribution-owned receipt verifiers. */
export function executionPlanReviewIdentity(content: string, projectDirectory: string): string {
  return JSON.stringify({
    design_approval_gate: executionPlanDesignApprovalGate(projectDirectory),
    normalized_digest: normalizedExecutionPlanDigest(content),
  });
}
