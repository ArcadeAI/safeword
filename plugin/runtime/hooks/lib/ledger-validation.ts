// Done-gate annotation ledger validator (ticket J7VBGJ, Rules 3 + 4).
// Pure function over test-definitions.md content + an injected SHA resolver.
// Returns { ok, errors[] }. The wiring layer in stop-quality.ts provides a
// Git-backed resolver that can canonicalize rebased commits.

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

export type ShaResolution = boolean | string;
export type ShaResolver = (sha: string) => ShaResolution;

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
  resolveSha: ShaResolver,
  label: string,
): { error?: string; format: boolean; canonicalSha?: string } {
  if (!isValidSha(value)) {
    return {
      error: `${label}: "${value}" is not a valid commit SHA (expected 7-40 hex chars).`,
      format: true,
    };
  }

  const resolution = resolveSha(value);
  if (resolution === false) {
    return { error: `${label}: SHA ${value} is not reachable from HEAD.`, format: false };
  }

  return {
    format: false,
    canonicalSha: resolution === true ? value : resolution,
  };
}

function validateScenario(
  scenario: ScenarioLedger,
  resolveSha: ShaResolver,
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
    const checkedSha = checkSha(kind.value, resolveSha, `Scenario "${scenario.name}" ${step.name}`);
    if (checkedSha.error) {
      errors.push(checkedSha.error);
      if (checkedSha.format) continue; // malformed — don't track it for collisions
    }
    if (!checkedSha.canonicalSha) continue;
    const existingStep = shaToStep.get(checkedSha.canonicalSha);
    if (existingStep) {
      errors.push(
        `Scenario "${scenario.name}" SHA collision: ${existingStep} and ${step.name} share SHA ${checkedSha.canonicalSha}. Each TDD step must correspond to a distinct commit.`,
      );
    } else {
      shaToStep.set(checkedSha.canonicalSha, step.name);
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
  resolveSha: ShaResolver,
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
    const checkedSha = checkSha(kind.value, resolveSha, 'Cross-scenario refactor row');
    if (checkedSha.error) errors.push(checkedSha.error);
  }
}

/**
 * Whether the whole-ticket quality-review + refactor pass applies to a ledger —
 * the single W610WW trigger shared by BOTH halves of the pass: the cross-scenario
 * refactor row (here, in `validateLedger`) and the `/quality-review` requirement
 * (at the done-gate's skill check). It fires above one RGR loop — `scenarios.length
 * >= 2` AND at least one annotated checkbox. A single-loop ticket has nothing to
 * cross; a pure-legacy ticket (no annotations anywhere) stays exempt regardless of
 * count. Driving both halves from one predicate is what keeps the legacy exemption
 * consistent across the row and the review (and is the "one derived trigger" SM1
 * asked for).
 */
export function wholeTicketPassApplies(content: string): boolean {
  return wholeTicketPassFromScenarios(parseLedger(content).scenarios);
}

/**
 * The whole-ticket-pass predicate over already-parsed scenarios — so a caller
 * that has parsed the ledger (validateLedger) doesn't parse it a second time.
 */
function wholeTicketPassFromScenarios(scenarios: ScenarioLedger[]): boolean {
  const hasAnyAnnotation = scenarios.some(s =>
    [s.red, s.green, s.refactor].some(box => box?.annotation),
  );
  return scenarios.length >= 2 && hasAnyAnnotation;
}

export function validateLedger(content: string, resolveSha: ShaResolver): LedgerValidationResult {
  const errors: string[] = [];
  const { scenarios, crossScenario } = parseLedger(content);

  for (const scenario of scenarios) {
    validateScenario(scenario, resolveSha, errors);
  }

  // Cross-scenario row enforcement: required iff the whole-ticket pass applies
  // (≥2 annotated loops — see wholeTicketPassApplies), OR the row already exists
  // (back-compat: a present row is always validated). Pure-legacy and single-loop
  // tickets stay exempt.
  if (wholeTicketPassFromScenarios(scenarios) || crossScenario) {
    validateCrossScenario(crossScenario, resolveSha, errors);
  }

  return { ok: errors.length === 0, errors };
}
