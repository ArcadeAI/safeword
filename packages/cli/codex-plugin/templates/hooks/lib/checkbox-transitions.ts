/**
 * Detect `[ ] STEP` → `[x] STEP <annotation>` checkbox transitions in an edit.
 *
 * Extracted from pre-tool-quality.ts (ticket SXSCJQ) so the PreToolUse
 * annotation gate can share one transition parser across edit tools.
 * Aligned by line index — works for Edit (old_string / new_string are local
 * replacement regions), Write (old = disk contents, new = full new content),
 * and MultiEdit (each edit treated as Edit). If lines don't align (e.g. a Write
 * that reorders sections), some transitions may be missed; the done-gate is the
 * final arbiter.
 */

import { existsSync, readFileSync } from 'node:fs';

import { parseCheckboxAnnotation } from './parse-annotation.js';

export interface CheckboxTransition {
  step: string;
  annotation: string;
  scenario?: string;
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

function findTransitionsByLineIndex(oldText: string, newText: string): CheckboxTransition[] {
  const transitions: CheckboxTransition[] = [];
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const max = Math.max(oldLines.length, newLines.length);
  let scenario: string | undefined;
  for (let i = 0; i < max; i++) {
    const newLine = newLines[i];
    if (newLine === undefined) continue;
    if (/^#{2,3}\s/.test(newLine)) scenario = newLine.replace(/^#{2,3}\s+/, '').trim();
    const newParsed = parseCheckboxAnnotation(newLine);
    if (!newParsed || !newParsed.checked) continue;
    const oldLine = oldLines[i];
    if (oldLine === undefined) continue;
    const oldParsed = parseCheckboxAnnotation(oldLine);
    if (oldParsed && !oldParsed.checked && oldParsed.step === newParsed.step) {
      transitions.push({ step: newParsed.step, annotation: newParsed.annotation, scenario });
    }
  }
  return transitions;
}

function scenarioForUniqueEdit(filePath: string, oldText: string): string | undefined {
  if (oldText === '' || !existsSync(filePath)) return undefined;
  const current = readFileSync(filePath, 'utf8');
  const matchIndex = current.indexOf(oldText);
  if (matchIndex < 0 || current.indexOf(oldText, matchIndex + 1) >= 0) return undefined;

  const headings = [...current.slice(0, matchIndex).matchAll(/^#{2,3}\s+(.+)$/gm)];
  return headings.at(-1)?.[1]?.trim();
}

function transitionsForEdit(
  filePath: string,
  oldText: string,
  newText: string,
): CheckboxTransition[] {
  const inferredScenario = scenarioForUniqueEdit(filePath, oldText);
  return findTransitionsByLineIndex(oldText, newText).map(transition =>
    transition.scenario === undefined && inferredScenario !== undefined
      ? { ...transition, scenario: inferredScenario }
      : transition,
  );
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
    return transitionsForEdit(filePath, oldString, newString);
  }

  if (toolName === 'Write') {
    const oldText = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
    const newText = toolInput.content ?? '';
    return findTransitionsByLineIndex(oldText, newText);
  }

  if (toolName === 'MultiEdit') {
    const edits = toolInput.edits ?? [];
    return edits.flatMap(edit =>
      transitionsForEdit(filePath, edit.old_string ?? '', edit.new_string ?? ''),
    );
  }

  return [];
}
