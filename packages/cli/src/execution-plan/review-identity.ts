import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

const CHECKLIST_MARKER = '<!-- safeword:delivery-checklist:v1 -->';

export function splitExecutionPlanRow(line: string): string[] | undefined {
  if (!line.trimStart().startsWith('|') || !line.trimEnd().endsWith('|')) return undefined;
  const cells: string[] = [];
  let cell = '';
  const body = line.trim().slice(1, -1);
  for (const character of body) {
    if (character === '|') {
      let backslashes = 0;
      for (let index = cell.length - 1; cell[index] === '\\'; index -= 1) backslashes += 1;
      if (backslashes % 2 === 1) {
        cell = `${cell.slice(0, -1)}|`;
        continue;
      }
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function pipeOffsets(line: string): number[] {
  const offsets: number[] = [];
  let escaped = false;
  for (const match of line.matchAll(/./gsu)) {
    const character = match[0];
    const index = match.index;
    if (escaped) escaped = false;
    else if (character === '\\') escaped = true;
    else if (character === '|') offsets.push(index);
  }
  return offsets;
}

function normalizeProgress(line: string): string {
  const cells = splitExecutionPlanRow(line);
  if (cells?.length !== 9 || !['open', 'complete'].includes(cells[5] ?? '')) return line;
  const pipes = pipeOffsets(line);
  if (pipes.length !== 10 || pipes[5] === undefined || pipes[9] === undefined) return line;
  return `${line.slice(0, pipes[5] + 1)} <progress> | <progress> | <progress> | <progress> ${line.slice(pipes[9])}`;
}

/** Ordinary checklist progress does not invalidate the approved plan. */
export function normalizedExecutionPlanDigest(content: string): string {
  const lines = content.split('\n');
  const markerIndex = lines.findIndex(line => line.trim() === CHECKLIST_MARKER);
  if (markerIndex !== -1) {
    const headerIndex = lines.findIndex((line, index) => {
      const cells = splitExecutionPlanRow(line);
      return (
        index > markerIndex &&
        cells?.length === 9 &&
        cells[0] === 'ID' &&
        cells[5] === 'Disposition'
      );
    });
    for (let index = headerIndex + 1; headerIndex !== -1 && index < lines.length; index += 1) {
      const line = lines[index];
      if (line === undefined || splitExecutionPlanRow(line)?.length !== 9) break;
      lines[index] = normalizeProgress(line);
    }
  }
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

export function hasExecutionPlanDeliveryChecklist(content: string): boolean {
  return content.split('\n').some(line => line.trim() === CHECKLIST_MARKER);
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

export function executionPlanReviewIdentity(content: string, projectDirectory: string): string {
  return JSON.stringify({
    design_approval_gate: executionPlanDesignApprovalGate(projectDirectory),
    normalized_digest: normalizedExecutionPlanDigest(content),
  });
}
