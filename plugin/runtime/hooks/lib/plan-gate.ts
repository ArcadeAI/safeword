// TXRHMD (#480): implement-entry plan gate. A new-flow feature ticket (spec.md
// present — same grandfathering marker as the M6D315 stop gate) may only enter
// the implement phase once impl-plan.md parses valid with status `planned`.
// Pure-ish helper (reads only the ticket folder) so the pre-tool hook can call
// it standalone from "\${CLAUDE_PLUGIN_ROOT}"/runtime/hooks/, mirroring the #404 readiness gate.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { inspirationContractProvenance, specArtifactProvenance } from './feature-provenance.js';
import { type ImplPlanResult, parseImplPlan, unresolvedDecisionNames } from './impl-plan.js';
import { evaluateImplementationInspiration } from './inspiration.js';
import { resolveNamespaceRoot } from './namespace-root.js';
import { checkPrincipleTrace } from './principle-trace.js';

export type PlanGateVerdict = { ok: true } | { ok: false; reason: string; remediation: string };

const OK: PlanGateVerdict = { ok: true };

/** Consume the public coding-authorization envelope without recomputing its prerequisites. */
export function evaluateCodingAuthorization(
  projectDirectory: string,
  ticketId: string,
  commandParts: readonly [string, ...string[]] | 'project-writable' | undefined,
): PlanGateVerdict {
  if (commandParts === undefined) {
    return {
      ok: false,
      reason: 'Safeword could not check whether coding is authorized.',
      remediation:
        'Reinstall the Safeword plugin or set SAFEWORD_PLUGIN_CLI to the bundled runtime path.',
    };
  }
  if (commandParts === 'project-writable') {
    return {
      ok: false,
      reason: 'Safeword refused a project-writable coding-authorization command.',
      remediation:
        'Point SAFEWORD_PLUGIN_CLI or CLAUDE_PLUGIN_ROOT at the installed plugin runtime.',
    };
  }
  const [executable, ...prefix] = commandParts;
  const checked = spawnSync(
    executable,
    [
      ...prefix,
      '--json',
      '--no-input',
      '--cwd',
      projectDirectory,
      'ticket',
      'coding-authorization',
      ticketId,
    ],
    { cwd: projectDirectory, encoding: 'utf8', timeout: 5000 },
  );
  try {
    const parsed = JSON.parse(checked.stdout) as {
      state?: unknown;
      findings?: Array<{ message?: unknown }>;
      next_actions?: Array<{ command?: unknown }>;
      data?: {
        command?: unknown;
        coding_authorization?: unknown;
        grants_authority?: unknown;
        authorization_input_identity?: unknown;
      };
    };
    if (
      checked.status === 0 &&
      parsed.state === 'healthy' &&
      parsed.data?.command === 'ticket coding-authorization' &&
      parsed.data.coding_authorization === 'authorized' &&
      parsed.data.grants_authority === false &&
      typeof parsed.data.authorization_input_identity === 'string' &&
      parsed.data.authorization_input_identity !== ''
    ) {
      return OK;
    }
    if (
      parsed.data?.command === 'ticket coding-authorization' &&
      parsed.data.coding_authorization === 'denied' &&
      parsed.data.grants_authority === false
    ) {
      const reason = parsed.findings?.find(
        finding => typeof finding.message === 'string' && finding.message !== '',
      )?.message;
      const remediation = parsed.next_actions?.find(
        action => typeof action.command === 'string' && action.command !== '',
      )?.command;
      return {
        ok: false,
        reason:
          typeof reason === 'string'
            ? reason
            : 'The current planning evidence does not authorize coding.',
        remediation:
          typeof remediation === 'string'
            ? remediation
            : `Run safeword ticket coding-authorization ${ticketId} and complete its recovery action.`,
      };
    }
  } catch {
    // Fall through to the fail-closed invalid-result verdict below.
  }
  return {
    ok: false,
    reason: 'Safeword could not validate the coding-authorization result.',
    remediation: `Run safeword ticket coding-authorization ${ticketId} and repair the reported local CLI problem.`,
  };
}

/** Return the exact executable action carried by the first unmet RED row. */
export function firstNamedRedAction(
  projectDirectory: string,
  ticketFolder: string,
): string | undefined {
  const ledgerPath = nodePath.join(
    resolveNamespaceRoot(projectDirectory),
    'tickets',
    ticketFolder,
    'test-definitions.md',
  );
  if (!existsSync(ledgerPath)) return undefined;
  const match = readFileSync(ledgerPath, 'utf8').match(
    /^[ \t]*- \[ \] RED[ \t]+(?:—|-|:)[ \t]*(.+)$/mu,
  );
  return match?.[1]?.trim() || undefined;
}

function missingSpecVerdict(
  activationProvenance: ReturnType<typeof inspirationContractProvenance>,
  specProvenance: ReturnType<typeof specArtifactProvenance>,
): PlanGateVerdict {
  if (activationProvenance === 'absent' && specProvenance === 'absent') return OK;
  return {
    ok: false,
    reason:
      activationProvenance === 'unavailable' || specProvenance === 'unavailable'
        ? 'Implementation planning cannot be verified because feature provenance is unavailable and spec.md is missing.'
        : 'This spec-backed feature is missing spec.md, so its inspiration contract and implementation plan cannot be verified.',
    remediation:
      activationProvenance === 'activated'
        ? 'Restore spec.md with its exact v1 inspiration marker and Product Inspiration record, then complete impl-plan.md before entering implement.'
        : "Restore this feature's spec.md from its phase anchor or repository history, then complete impl-plan.md before entering implement.",
  };
}

function validateParsedPlan(parsed: ImplPlanResult, requireDocImpact: boolean): PlanGateVerdict {
  if (parsed.errors.length > 0) {
    return {
      ok: false,
      reason: `impl-plan.md is not ready: ${parsed.errors.join(' ')}`,
      remediation:
        'Fix the named plan sections (content or `skip: <reason>` each), then retry the move to implement.',
    };
  }
  if (requireDocImpact && parsed.sections['Doc impact'] === undefined) {
    return {
      ok: false,
      reason: 'impl-plan.md is not ready: spec-backed feature plans require a Doc impact section.',
      remediation:
        'Add `## Doc impact` with the affected docs.sources surfaces or `skip: <reason>`, then retry the move to implement.',
    };
  }
  if (parsed.status !== 'planned') {
    return {
      ok: false,
      reason: `impl-plan.md status reads "${String(parsed.status)}" — entering implement requires a plan that says planned, so the plan describes what is about to be built.`,
      remediation:
        'Update the plan for this pass and reset its status line to **Status:** planned, then retry the move to implement.',
    };
  }
  return OK;
}

/** Block Execution Planning while the plan explicitly carries open choices. */
export function evaluateExecutionPlanningEntry(
  ticketDirectory: string,
  options: { evaluationDate?: string; projectDirectory: string },
): PlanGateVerdict {
  const planPath = nodePath.join(ticketDirectory, 'impl-plan.md');
  const planVerdict = evaluateImplementEntry(ticketDirectory, options);
  if (!planVerdict.ok) return planVerdict;

  const unresolved = unresolvedDecisionNames(readFileSync(planPath, 'utf8'));
  if (unresolved.length === 0) return OK;
  return {
    ok: false,
    reason: `Implementation Planning still has unresolved behavior-shaping choices: ${unresolved.join(', ')}.`,
    remediation:
      'Decide each named choice in impl-plan.md, then run the Implementation Plan review again before entering Execution Planning.',
  };
}

/**
 * Gate the plan-implementation → implement transition on a valid, planned plan.
 *
 * `projectDirectory` is passed rather than derived: the namespace root is
 * configurable, so walking up from the ticket path would only be a guess.
 */
export function evaluateImplementEntry(
  ticketDirectory: string,
  options: { evaluationDate?: string; projectDirectory: string },
): PlanGateVerdict {
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  const ticketContent = existsSync(ticketPath) ? readFileSync(ticketPath, 'utf8') : '';
  const activationProvenance = inspirationContractProvenance(ticketDirectory);
  const specPath = nodePath.join(ticketDirectory, 'spec.md');
  if (!existsSync(specPath)) {
    return missingSpecVerdict(activationProvenance, specArtifactProvenance(ticketDirectory));
  }

  const planPath = nodePath.join(ticketDirectory, 'impl-plan.md');
  if (!existsSync(planPath)) {
    return {
      ok: false,
      reason:
        'This feature has no impl-plan.md yet — the implementation plan is authored during the plan-implementation phase, before any test or code is written. Next: scaffold impl-plan.md from "\${CLAUDE_PLUGIN_ROOT}"/resources/templates/impl-plan-template.md.',
      remediation:
        'Create impl-plan.md next to ticket.md (scaffold from "\${CLAUDE_PLUGIN_ROOT}"/resources/templates/impl-plan-template.md), fill each section with content or `skip: <reason>`, keep **Status:** planned, then retry the move to implement.',
    };
  }

  const planContent = readFileSync(planPath, 'utf8');
  const parsed = parseImplPlan(planContent);
  const planVerdict = validateParsedPlan(parsed, activationProvenance === 'activated');
  if (!planVerdict.ok) return planVerdict;

  // Principle trace (PJT893): entering implement is the boundary where a broken
  // trace is still cheap to fix — the table is being authored, not relitigated
  // against finished work. Objective defects only; applicability stays a review
  // judgment, and a project with no principles file has nothing to report.
  const traceFindings = checkPrincipleTrace(options.projectDirectory, planContent);
  if (traceFindings.length > 0) {
    return {
      ok: false,
      reason: `The plan's Design alignment trace does not hold up yet:\n${traceFindings
        .map(item => `- ${item}`)
        .join('\n')}`,
      remediation:
        'Fix each row in `## Design alignment` so the principle name matches the configured principles file verbatim, the consequence and proof cells are filled, the proof path resolves, and any `explicit-conflict` names that same principle in `## Known deviations`. Then retry the move to implement.',
    };
  }

  const inspirationVerdict = evaluateImplementationInspiration({
    ticketContent,
    specContent: readFileSync(specPath, 'utf8'),
    planContent,
    activationProvenance,
    evaluationDate: options.evaluationDate ?? new Date().toISOString().slice(0, 10),
  });
  if (!inspirationVerdict.ok) {
    return {
      ok: false,
      reason: `Implementation Inspiration is not ready: ${inspirationVerdict.reason}`,
      remediation: inspirationVerdict.remediation,
    };
  }

  return OK;
}
