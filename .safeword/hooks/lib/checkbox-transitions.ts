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

function transitionKey(state: Pick<CheckboxState, 'scenario' | 'step'>): string {
  return `${state.scenario ?? ''}\0${state.step}`;
}

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function consume(counts: Map<string, number>, key: string): boolean {
  const count = counts.get(key) ?? 0;
  if (count === 0) return false;
  counts.set(key, count - 1);
  return true;
}

function findTransitions(oldText: string, newText: string): CheckboxTransition[] {
  const oldChecked = new Map<string, number>();
  const oldUnchecked = new Map<string, number>();
  for (const state of checkboxStates(oldText)) {
    increment(state.checked ? oldChecked : oldUnchecked, transitionKey(state));
  }

  const transitions: CheckboxTransition[] = [];
  for (const state of checkboxStates(newText)) {
    if (!state.checked) continue;
    const key = transitionKey(state);
    if (consume(oldChecked, key)) continue;
    if (consume(oldUnchecked, key)) {
      transitions.push({
        step: state.step,
        annotation: state.annotation,
        scenario: state.scenario,
      });
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
