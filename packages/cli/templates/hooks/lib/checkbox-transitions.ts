/**
 * Detect `[ ] STEP` → `[x] STEP <annotation>` checkbox transitions in an edit.
 *
 * Extracted from pre-tool-quality.ts (ticket SXSCJQ) so both the PreToolUse
 * annotation gate and the PostToolUse per-step review can share one engine.
 * Aligned by line index — works for Edit (old_string / new_string are local
 * replacement regions), Write (old = disk contents, new = full new content),
 * and MultiEdit (each edit treated as Edit). If lines don't align (e.g. a Write
 * that reorders sections), some transitions may be missed; the done-gate is the
 * final arbiter.
 */

import { existsSync, readFileSync } from 'node:fs';

import { parseCheckboxAnnotation } from './parse-annotation.ts';

export interface CheckboxTransition {
  step: string;
  annotation: string;
}

export interface TransitionHookInput {
  tool_name?: string;
  tool_input?: {
    old_string?: string;
    new_string?: string;
    content?: string;
    edits?: Array<{ old_string?: string; new_string?: string }>;
  };
}

export function findTransitionsByLineIndex(oldText: string, newText: string): CheckboxTransition[] {
  const transitions: CheckboxTransition[] = [];
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    const newLine = newLines[i];
    if (newLine === undefined) continue;
    const newParsed = parseCheckboxAnnotation(newLine);
    if (!newParsed || !newParsed.checked) continue;
    const oldLine = oldLines[i];
    if (oldLine === undefined) continue;
    const oldParsed = parseCheckboxAnnotation(oldLine);
    if (oldParsed && !oldParsed.checked && oldParsed.step === newParsed.step) {
      transitions.push({ step: newParsed.step, annotation: newParsed.annotation });
    }
  }
  return transitions;
}

export function collectNewTransitions(
  hookInput: TransitionHookInput,
  filePath: string,
): CheckboxTransition[] {
  const toolInput = hookInput.tool_input ?? {};
  const toolName = hookInput.tool_name ?? '';

  if (toolName === 'Edit') {
    const oldString = toolInput.old_string ?? '';
    const newString = toolInput.new_string ?? '';
    return findTransitionsByLineIndex(oldString, newString);
  }

  if (toolName === 'Write') {
    const oldText = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
    const newText = toolInput.content ?? '';
    return findTransitionsByLineIndex(oldText, newText);
  }

  if (toolName === 'MultiEdit') {
    const edits = toolInput.edits ?? [];
    return edits.flatMap(edit =>
      findTransitionsByLineIndex(edit.old_string ?? '', edit.new_string ?? ''),
    );
  }

  return [];
}
