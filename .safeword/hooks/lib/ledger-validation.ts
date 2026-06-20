// Done-gate annotation ledger validator (ticket J7VBGJ, Rules 3 + 4).
// Pure function over test-definitions.md content + an injected SHA-reachability
// oracle. Returns { ok, errors[] }. The wiring layer in stop-quality.ts calls
// the real `git cat-file -e <sha>^{commit}` to provide the oracle.

import {
  classifyAnnotation,
  isValidSha,
  isValidSkipReason,
  parseCheckboxAnnotation,
  type CheckboxAnnotation,
} from './parse-annotation.js';

export interface LedgerValidationResult {
  ok: boolean;
  errors: string[];
}

interface ScenarioLedger {
  name: string;
  red?: CheckboxAnnotation;
  green?: CheckboxAnnotation;
  refactor?: CheckboxAnnotation;
}

function parseLedger(content: string): {
  scenarios: ScenarioLedger[];
  crossScenario?: CheckboxAnnotation;
} {
  const lines = content.split('\n');
  const scenarios: ScenarioLedger[] = [];
  let current: ScenarioLedger | undefined;
  let crossScenario: CheckboxAnnotation | undefined;

  for (const line of lines) {
    const scenarioMatch = /^#{2,3}\s+Scenario:\s*(.+)$/.exec(line);
    if (scenarioMatch) {
      current = { name: (scenarioMatch[1] ?? '').trim() };
      scenarios.push(current);
      continue;
    }
    const parsed = parseCheckboxAnnotation(line);
    if (!parsed) continue;
    if (parsed.step === 'cross-scenario') {
      crossScenario = parsed;
      continue;
    }
    if (current) {
      if (parsed.step === 'RED') current.red = parsed;
      else if (parsed.step === 'GREEN') current.green = parsed;
      else if (parsed.step === 'REFACTOR') current.refactor = parsed;
    }
  }

  return { scenarios, crossScenario };
}

/**
 * Validate a SHA-position annotation: format first (7-40 hex), then reachability
 * via the injected oracle. Returns the error message plus whether it's a
 * *format* error (so a caller can skip downstream collision tracking on a
 * malformed value), or null if the SHA resolves. Centralizes the two wordings so
 * the per-scenario and cross-scenario rows can't drift.
 */
function checkSha(
  value: string,
  isReachable: (sha: string) => boolean,
  label: string,
): { error: string; format: boolean } | null {
  if (!isValidSha(value)) {
    return {
      error: `${label}: "${value}" is not a valid commit SHA (expected 7-40 hex chars).`,
      format: true,
    };
  }
  if (!isReachable(value)) {
    return { error: `${label}: SHA ${value} is not reachable from HEAD.`, format: false };
  }
  return null;
}

function validateScenario(
  scenario: ScenarioLedger,
  isReachable: (sha: string) => boolean,
  errors: string[],
): void {
  const steps: Array<{ name: string; box?: CheckboxAnnotation }> = [
    { name: 'RED', box: scenario.red },
    { name: 'GREEN', box: scenario.green },
    { name: 'REFACTOR', box: scenario.refactor },
  ];

  // Legacy detection: if every present checkbox has no annotation, this is a
  // pre-feature scenario — silently accepted (forward-looking rule).
  const annotatedSteps = steps.filter(s => s.box && s.box.annotation !== '');
  if (annotatedSteps.length === 0) return;

  const shaToStep = new Map<string, string>();
  let realShaCount = 0;

  for (const step of steps) {
    if (!step.box) continue;
    const kind = classifyAnnotation(step.box.annotation);

    if (kind.kind === 'none') continue; // legacy slot — silent

    if (kind.kind === 'skip') {
      if (!isValidSkipReason(kind.reason)) {
        errors.push(
          `Scenario "${scenario.name}" ${step.name}: skip reason is empty or whitespace-only. Provide a real reason.`,
        );
      }
      continue;
    }

    // SHA candidate
    realShaCount++;
    const problem = checkSha(kind.value, isReachable, `Scenario "${scenario.name}" ${step.name}`);
    if (problem) {
      errors.push(problem.error);
      if (problem.format) continue; // malformed — don't track it for collisions
    }
    const existingStep = shaToStep.get(kind.value);
    if (existingStep) {
      errors.push(
        `Scenario "${scenario.name}" SHA collision: ${existingStep} and ${step.name} share SHA ${kind.value}. Each TDD step must correspond to a distinct commit.`,
      );
    } else {
      shaToStep.set(kind.value, step.name);
    }
  }

  if (realShaCount === 0) {
    errors.push(
      `Scenario "${scenario.name}" represents work that produced no commits — all steps are skipped. At least one step must carry a real SHA.`,
    );
  }
}

function validateCrossScenario(
  cs: CheckboxAnnotation | undefined,
  isReachable: (sha: string) => boolean,
  errors: string[],
): void {
  if (!cs) {
    errors.push(
      'Cross-scenario refactor row is missing. Add `- [ ] cross-scenario` to test-definitions.md and complete it with a SHA or `skip: <reason>` before done.',
    );
    return;
  }

  if (!cs.checked) {
    errors.push(
      'Cross-scenario refactor row is unchecked. Mark it with a SHA or `skip: <reason>` before done.',
    );
    return;
  }

  if (cs.annotation === '') return; // legacy bare — silently OK

  const kind = classifyAnnotation(cs.annotation);
  if (kind.kind === 'skip') {
    if (!isValidSkipReason(kind.reason)) {
      errors.push(
        'Cross-scenario refactor row: skip reason is empty or whitespace-only. Provide a real reason.',
      );
    }
    return;
  }

  if (kind.kind === 'sha') {
    const problem = checkSha(kind.value, isReachable, 'Cross-scenario refactor row');
    if (problem) errors.push(problem.error);
  }
}

export function validateLedger(
  content: string,
  isReachable: (sha: string) => boolean,
): LedgerValidationResult {
  const errors: string[] = [];
  const { scenarios, crossScenario } = parseLedger(content);

  for (const scenario of scenarios) {
    validateScenario(scenario, isReachable, errors);
  }

  // Cross-scenario row enforcement: the whole-ticket quality-review + refactor
  // pass is required only above one RGR loop — a single-loop ticket has nothing
  // to cross, so it's exempt (W610WW). Required iff a new-format ticket carries
  // two or more loops (any annotated checkbox + ≥2 scenarios), OR the row
  // already exists (back-compat: a present row is always validated). Pure legacy
  // tickets (no annotations anywhere) stay exempt regardless of count.
  const hasAnyAnnotation = scenarios.some(s =>
    [s.red, s.green, s.refactor].some(box => box?.annotation),
  );
  const multiLoopAnnotated = scenarios.length >= 2 && hasAnyAnnotation;
  if (multiLoopAnnotated || crossScenario) {
    validateCrossScenario(crossScenario, isReachable, errors);
  }

  return { ok: errors.length === 0, errors };
}
