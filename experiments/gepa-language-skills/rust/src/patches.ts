import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function rustPatchFileForTask(patchDir: string, taskId: string): string {
  return join(patchDir, `${taskId}.patch`);
}

export function validateRustPatchFile(taskId: string, patchFile: string): void {
  const text = readFileSync(patchFile, 'utf8');
  if (!text.trim()) {
    throw new Error(`empty patch for task ${taskId}: ${patchFile}`);
  }
  if (!looksLikeUnifiedDiff(text)) {
    throw new Error(`patch for task ${taskId} is not a unified diff: ${patchFile}`);
  }
}

export function validateGeneratedRustPatch(taskId: string, text: string): void {
  if (!text.trim()) {
    throw new Error(`generated patch for task ${taskId} is empty`);
  }
  if (!looksLikeUnifiedDiff(text)) {
    throw new Error(`generated patch for task ${taskId} is not a unified diff`);
  }
}

function looksLikeUnifiedDiff(text: string): boolean {
  const lines = text.split('\n');
  const hasFileHeader =
    lines.some(line => line.startsWith('diff --git ')) ||
    (lines.some(line => line.startsWith('--- ')) && lines.some(line => line.startsWith('+++ ')));
  const hasHunk = lines.some(line => line.startsWith('@@ '));
  const hasChangedLine = lines.some(
    line =>
      (line.startsWith('+') && !line.startsWith('+++')) ||
      (line.startsWith('-') && !line.startsWith('---')),
  );

  return hasFileHeader && hasHunk && hasChangedLine;
}
