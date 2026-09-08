/**
 * Detect `[ ] STEP` → `[x] STEP <annotation>` checkbox transitions in an edit.
 *
 * Extracted from pre-tool-quality.ts (ticket SXSCJQ) so the PreToolUse
 * annotation gate can share one transition parser across edit tools.
 * Matches checkbox state by scenario and step rather than line index, so edits
 * that insert or remove surrounding lines cannot hide a gated transition.
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

interface CheckboxState extends CheckboxTransition {
  checked: boolean;
}

function checkboxStates(text: string): CheckboxState[] {
  const states: CheckboxState[] = [];
  let scenario: string | undefined;
  for (const line of text.split('\n')) {
    if (/^#{2,3}\s/.test(line)) scenario = line.replace(/^#{2,3}\s+/, '').trim();
    const parsed = parseCheckboxAnnotation(line);
    if (parsed === null) continue;
    states.push({ ...parsed, scenario });
  }
  return states;
}

function findTransitions(oldText: string, newText: string): CheckboxTransition[] {
  const oldStates = checkboxStates(oldText);
  const usedOld = new Set<number>();
  const unmatched: CheckboxState[] = [];
  const transitions: CheckboxTransition[] = [];

  const consumeOld = (state: CheckboxState, checked: boolean, exactScenario: boolean): boolean => {
    const index = oldStates.findIndex(
      (old, candidate) =>
        !usedOld.has(candidate) &&
        old.checked === checked &&
        old.step === state.step &&
        (!exactScenario || old.scenario === state.scenario),
    );
    if (index < 0) return false;
    usedOld.add(index);
    return true;
  };

  for (const state of checkboxStates(newText).filter(candidate => candidate.checked)) {
    if (!consumeOld(state, true, true)) unmatched.push(state);
  }

  const scenarioChanged: CheckboxState[] = [];
  for (const state of unmatched) {
    if (consumeOld(state, false, true)) transitions.push(state);
    else scenarioChanged.push(state);
  }

  for (const state of scenarioChanged) {
    if (consumeOld(state, true, false)) continue;
    // A checked recognized row with no old counterpart is still new credit.
    // Treat insertions and rename dances as transitions so the gate fails closed.
    consumeOld(state, false, false);
    transitions.push(state);
  }

  return transitions.map(({ step, annotation, scenario }) => ({ step, annotation, scenario }));
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
  return findTransitions(oldText, newText).map(transition =>
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
    return findTransitions(oldText, newText);
  }

  if (toolName === 'MultiEdit') {
    const edits = toolInput.edits ?? [];
    return edits.flatMap(edit =>
      transitionsForEdit(filePath, edit.old_string ?? '', edit.new_string ?? ''),
    );
  }

  return [];
}
