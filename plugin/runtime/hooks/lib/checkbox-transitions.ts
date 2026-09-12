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
  evidenceMode?: 'live' | 'manual';
  evidenceModeChanged?: boolean;
  historicalEvidenceRemoved?: boolean;
}

export interface TransitionHookInput {
  tool_name?: string;
  tool_input?: {
    old_string?: string;
    new_string?: string;
    content?: string;
    replace_all?: boolean;
    edits?: Array<{ old_string?: string; new_string?: string }>;
  };
}

interface CheckboxState extends CheckboxTransition {
  checked: boolean;
}

function balancedFenceBodyLines(lines: readonly string[]): Set<number> {
  const bodyLines = new Set<number>();
  let fence: { character: '`' | '~'; length: number; body: number[] } | undefined;
  for (const [index, line] of lines.entries()) {
    const marker = /^\s*(?<fence>`{3,}|~{3,})/u.exec(line)?.groups?.fence;
    if (fence === undefined) {
      if (marker !== undefined) {
        fence = { character: marker[0] as '`' | '~', length: marker.length, body: [] };
      }
      continue;
    }
    if (marker !== undefined && marker[0] === fence.character && marker.length >= fence.length) {
      for (const bodyLine of fence.body) bodyLines.add(bodyLine);
      fence = undefined;
      continue;
    }
    fence.body.push(index);
  }
  // An unclosed fence is agent-authored ambiguity, not permission to hide the
  // remainder of the ledger. Only bodies with a matching close are ignored.
  return bodyLines;
}

function countScenarioHeadings(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const lines = text.split('\n');
  const fencedBodyLines = balancedFenceBodyLines(lines);
  for (const [index, line] of lines.entries()) {
    if (fencedBodyLines.has(index)) continue;
    const heading = /^#{2,6}\s+(.+)$/u.exec(line)?.[1]?.trim();
    if (heading !== undefined) counts.set(heading, (counts.get(heading) ?? 0) + 1);
  }
  return counts;
}

function checkboxStates(text: string): CheckboxState[] {
  const states: CheckboxState[] = [];
  let scenario: string | undefined;
  const lines = text.split('\n');
  const fencedBodyLines = balancedFenceBodyLines(lines);
  for (const [index, line] of lines.entries()) {
    if (fencedBodyLines.has(index)) continue;
    if (/^\s*(?:`{3,}|~{3,})/u.test(line)) continue;
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
    if (heading !== null) {
      scenario = heading[1]?.length === 1 ? undefined : heading[2]?.trim();
    }
    const parsed = parseCheckboxAnnotation(line);
    if (parsed === null) continue;
    const match =
      parsed.step === 'RED' && parsed.checked
        ? /^skip:\s*(manual|live)(?:\s*(?:—|:)\s*(.+)|$)/iu.exec(parsed.annotation)
        : null;
    const reference = match?.[2]?.trim() ?? '';
    const hasDurableReference =
      /\b(?:work log|transcript|recording|screenshot|receipt|artifact)\b/iu.test(reference) ||
      /(?:^|\s)[\w./-]+\.(?:md|txt|log|png|jpe?g|webm|mp4)(?:\s|$)/iu.test(reference);
    const mode = hasDurableReference ? match?.[1]?.toLowerCase() : undefined;
    states.push({
      ...parsed,
      scenario,
      ...((mode === 'manual' || mode === 'live') && { evidenceMode: mode }),
    });
  }
  return states;
}

function findTransitions(
  oldText: string,
  newText: string,
  evidenceBaseline = oldText,
): CheckboxTransition[] {
  const oldStates = checkboxStates(oldText);
  const newStates = checkboxStates(newText);
  const scenarioSignature = (states: readonly CheckboxState[], scenario: string): string =>
    JSON.stringify(
      states
        .filter(state => state.scenario === scenario)
        .map(({ step, annotation, checked }) => ({ step, annotation, checked })),
    );
  const oldScenarios = new Set(
    oldStates.flatMap(state => (state.scenario === undefined ? [] : [state.scenario])),
  );
  const newScenarios = new Set(
    newStates.flatMap(state => (state.scenario === undefined ? [] : [state.scenario])),
  );
  const oldOnlyScenarios = [...oldScenarios].filter(scenario => !newScenarios.has(scenario));
  const newOnlyScenarios = [...newScenarios].filter(scenario => !oldScenarios.has(scenario));
  const renamedScenarioOrigins = new Map<string, string>();
  for (const newScenario of newOnlyScenarios) {
    const signature = scenarioSignature(newStates, newScenario);
    const oldMatches = oldOnlyScenarios.filter(
      oldScenario => scenarioSignature(oldStates, oldScenario) === signature,
    );
    const newMatches = newOnlyScenarios.filter(
      candidate => scenarioSignature(newStates, candidate) === signature,
    );
    if (oldMatches.length === 1 && newMatches.length === 1) {
      renamedScenarioOrigins.set(newScenario, oldMatches[0] as string);
    }
  }
  const sameScenario = (
    oldScenario: string | undefined,
    newScenario: string | undefined,
  ): boolean =>
    oldScenario === newScenario ||
    (newScenario !== undefined &&
      renamedScenarioOrigins.has(newScenario) &&
      renamedScenarioOrigins.get(newScenario) === oldScenario);
  const priorEvidenceModeByScenario = new Map<string | undefined, 'live' | 'manual'>();
  for (const state of checkboxStates(evidenceBaseline)) {
    if (state.step === 'RED' && state.checked && state.evidenceMode !== undefined) {
      priorEvidenceModeByScenario.set(state.scenario, state.evidenceMode);
    }
  }
  const withPriorEvidenceMode = (state: CheckboxState): CheckboxState => ({
    ...state,
    evidenceMode: priorEvidenceModeByScenario.get(state.scenario),
  });
  const scenarioHeadingCounts = countScenarioHeadings(newText);
  const usedOld = new Set<number>();
  const unmatched: CheckboxState[] = [];
  const transitions: CheckboxTransition[] = [];

  const preservedHistoricalRows = new Set<number>();
  for (const oldState of oldStates.filter(
    state =>
      ['RED', 'GREEN', 'REFACTOR'].includes(state.step) && state.checked && state.annotation !== '',
  )) {
    const preservedIndex = newStates.findIndex(
      (newState, index) =>
        !preservedHistoricalRows.has(index) &&
        newState.step === oldState.step &&
        newState.checked &&
        newState.annotation === oldState.annotation &&
        sameScenario(oldState.scenario, newState.scenario),
    );
    if (preservedIndex >= 0) preservedHistoricalRows.add(preservedIndex);
    else {
      transitions.push({
        step: oldState.step,
        annotation: '',
        scenario: oldState.scenario,
        historicalEvidenceRemoved: true,
      });
    }
  }

  const consumeOld = (
    state: CheckboxState,
    checked: boolean,
    exactScenario: boolean,
    exactAnnotation = false,
  ): CheckboxState | undefined => {
    const index = oldStates.findIndex(
      (old, candidate) =>
        !usedOld.has(candidate) &&
        old.checked === checked &&
        old.step === state.step &&
        (!exactAnnotation || old.annotation === state.annotation) &&
        (!exactScenario || sameScenario(old.scenario, state.scenario)),
    );
    if (index < 0) return undefined;
    usedOld.add(index);
    return oldStates[index];
  };

  for (const state of newStates.filter(candidate => candidate.checked)) {
    const prior = consumeOld(state, true, true, true) ?? consumeOld(state, true, true);
    if (prior === undefined) unmatched.push(state);
    else if (
      state.step === 'RED' &&
      prior.evidenceMode === undefined &&
      state.evidenceMode !== undefined
    ) {
      transitions.push({ ...state, evidenceModeChanged: true });
    }
  }

  const scenarioChanged: CheckboxState[] = [];
  for (const state of unmatched) {
    if (consumeOld(state, false, true) !== undefined)
      transitions.push(withPriorEvidenceMode(state));
    else scenarioChanged.push(state);
  }

  for (const state of scenarioChanged) {
    const movedChecked = consumeOld(state, true, false);
    if (movedChecked !== undefined) {
      // Historical RED and GREEN credit cannot silently move to a different
      // scenario; its evidence was recorded for the original binding.
      transitions.push({ ...state, scenario: undefined, evidenceMode: undefined });
      continue;
    }
    // A checked recognized row with no old counterpart is still new credit.
    // Treat insertions and rename dances as transitions so the gate fails closed.
    const movedUnchecked = consumeOld(state, false, false);
    // Moving an unchecked row under another scenario while checking it must not
    // let the edit choose an already-approved scenario. Withhold the binding so
    // the executable-RED gate denies the combined boundary change.
    transitions.push(
      movedUnchecked === undefined
        ? withPriorEvidenceMode(state)
        : { ...state, scenario: undefined, evidenceMode: undefined },
    );
  }

  return transitions.map(
    ({
      step,
      annotation,
      scenario,
      evidenceMode,
      evidenceModeChanged,
      historicalEvidenceRemoved,
    }) => ({
      step,
      annotation,
      scenario:
        scenario !== undefined && (scenarioHeadingCounts.get(scenario) ?? 0) > 1
          ? undefined
          : scenario,
      evidenceMode,
      evidenceModeChanged,
      historicalEvidenceRemoved,
    }),
  );
}

export function applyUniqueEdit(
  current: string,
  oldText: string,
  newText: string,
): string | undefined {
  if (oldText === '') return undefined;
  const matchIndex = current.indexOf(oldText);
  if (matchIndex < 0 || current.indexOf(oldText, matchIndex + 1) >= 0) return undefined;
  return current.slice(0, matchIndex) + newText + current.slice(matchIndex + oldText.length);
}

function transitionsForAppliedEdit(
  current: string,
  oldText: string,
  newText: string,
  evidenceBaseline = current,
  replaceAll = false,
): { next: string; transitions: CheckboxTransition[] } {
  const next =
    replaceAll && oldText !== '' && current.includes(oldText)
      ? current.replaceAll(oldText, newText)
      : applyUniqueEdit(current, oldText, newText);
  if (next !== undefined)
    return { next, transitions: findTransitions(current, next, evidenceBaseline) };

  // The edit tool will reject a missing or ambiguous replacement. Still surface
  // any attempted checked credit. Patch adapters may provide non-contiguous
  // hunk context, so retain a scenario only when both sides name it identically;
  // never trust a heading supplied solely by the replacement fragment.
  const oldStates = checkboxStates(oldText);
  const currentStates = checkboxStates(current);
  return {
    next: current,
    transitions: findTransitions(oldText, newText, evidenceBaseline).map(transition => {
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
      const candidate = candidates.length === 1 ? candidates[0] : undefined;
      const duplicateScenario =
        candidate?.scenario !== undefined &&
        (countScenarioHeadings(current).get(candidate.scenario) ?? 0) > 1;
      return candidate !== undefined && !duplicateScenario
        ? {
            ...transition,
            scenario: candidate.scenario,
            // Candidates are unchecked rows, so they cannot carry an evidence
            // exemption. State that guarantee explicitly.
            evidenceMode: undefined,
          }
        : { ...transition, scenario: undefined, evidenceMode: undefined };
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
    return transitionsForAppliedEdit(
      current,
      oldString,
      newString,
      current,
      toolInput.replace_all === true,
    ).transitions;
  }

  if (toolName === 'Write') {
    const oldText = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
    const newText = toolInput.content ?? '';
    return findTransitions(oldText, newText);
  }

  if (toolName === 'MultiEdit') {
    const edits = toolInput.edits ?? [];
    const baseline = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
    let current = baseline;
    const transitions: CheckboxTransition[] = [];
    for (const edit of edits) {
      const applied = transitionsForAppliedEdit(
        current,
        edit.old_string ?? '',
        edit.new_string ?? '',
        baseline,
      );
      current = applied.next;
      transitions.push(...applied.transitions);
    }
    return transitions;
  }

  return [];
}
