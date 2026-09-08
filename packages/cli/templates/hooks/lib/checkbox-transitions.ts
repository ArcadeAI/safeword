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
    if (/^#{2,6}\s/.test(line)) scenario = line.replace(/^#{2,6}\s+/, '').trim();
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

  const consumeOld = (
    state: CheckboxState,
    checked: boolean,
    exactScenario: boolean,
  ): CheckboxState | undefined => {
    const index = oldStates.findIndex(
      (old, candidate) =>
        !usedOld.has(candidate) &&
        old.checked === checked &&
        old.step === state.step &&
        (!exactScenario || old.scenario === state.scenario),
    );
    if (index < 0) return undefined;
    usedOld.add(index);
    return oldStates[index];
  };

  for (const state of checkboxStates(newText).filter(candidate => candidate.checked)) {
    if (consumeOld(state, true, true) === undefined) unmatched.push(state);
  }

  const scenarioChanged: CheckboxState[] = [];
  for (const state of unmatched) {
    if (consumeOld(state, false, true) !== undefined) transitions.push(state);
    else scenarioChanged.push(state);
  }

  for (const state of scenarioChanged) {
    const movedChecked = consumeOld(state, true, false);
    if (movedChecked !== undefined) {
      // Existing GREEN credit cannot silently move to a different scenario;
      // its receipt was approved for the original binding.
      if (state.step === 'GREEN') transitions.push({ ...state, scenario: undefined });
      continue;
    }
    // A checked recognized row with no old counterpart is still new credit.
    // Treat insertions and rename dances as transitions so the gate fails closed.
    const movedUnchecked = consumeOld(state, false, false);
    // Moving an unchecked row under another scenario while checking it must not
    // let the edit choose an already-approved scenario. Withhold the binding so
    // the executable-RED gate denies the combined boundary change.
    transitions.push(movedUnchecked === undefined ? state : { ...state, scenario: undefined });
  }

  return transitions.map(({ step, annotation, scenario }) => ({ step, annotation, scenario }));
}

function applyUniqueEdit(current: string, oldText: string, newText: string): string | undefined {
  if (oldText === '') return undefined;
  const matchIndex = current.indexOf(oldText);
  if (matchIndex < 0 || current.indexOf(oldText, matchIndex + 1) >= 0) return undefined;
  return current.slice(0, matchIndex) + newText + current.slice(matchIndex + oldText.length);
}

function transitionsForAppliedEdit(
  current: string,
  oldText: string,
  newText: string,
): { next: string; transitions: CheckboxTransition[] } {
  const next = applyUniqueEdit(current, oldText, newText);
  if (next !== undefined) return { next, transitions: findTransitions(current, next) };

  // The edit tool will reject a missing or ambiguous replacement. Still surface
  // any attempted checked credit. Patch adapters may provide non-contiguous
  // hunk context, so retain a scenario only when both sides name it identically;
  // never trust a heading supplied solely by the replacement fragment.
  const oldStates = checkboxStates(oldText);
  const currentStates = checkboxStates(current);
  return {
    next: current,
    transitions: findTransitions(oldText, newText).map(transition => {
      const fragmentPrior = oldStates.find(
        state =>
          !state.checked &&
          state.step === transition.step &&
          state.scenario === transition.scenario,
      );
      if (fragmentPrior === undefined) return { ...transition, scenario: undefined };

      // A failed literal reconstruction means the adapter's context is only a
      // hint. Bind to the file on disk only when it identifies one unambiguous
      // unchecked row; never let agent-supplied patch context choose a receipt.
      const candidates = currentStates.filter(
        state => !state.checked && state.step === transition.step,
      );
      return candidates.length === 1
        ? { ...transition, scenario: candidates[0]?.scenario }
        : { ...transition, scenario: undefined };
    }),
  };
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
    const current = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
    return transitionsForAppliedEdit(current, oldString, newString).transitions;
  }

  if (toolName === 'Write') {
    const oldText = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
    const newText = toolInput.content ?? '';
    return findTransitions(oldText, newText);
  }

  if (toolName === 'MultiEdit') {
    const edits = toolInput.edits ?? [];
    let current = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
    const transitions: CheckboxTransition[] = [];
    for (const edit of edits) {
      const applied = transitionsForAppliedEdit(
        current,
        edit.old_string ?? '',
        edit.new_string ?? '',
      );
      current = applied.next;
      transitions.push(...applied.transitions);
    }
    return transitions;
  }

  return [];
}
