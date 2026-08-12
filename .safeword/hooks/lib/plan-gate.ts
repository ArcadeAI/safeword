// TXRHMD (#480): implement-entry plan gate. A new-flow feature ticket (spec.md
// present — same grandfathering marker as the M6D315 stop gate) may only enter
// the implement phase once impl-plan.md parses valid with status `planned`.
// Pure-ish helper (reads only the ticket folder) so the pre-tool hook can call
// it standalone from .safeword/hooks/, mirroring the #404 readiness gate.

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { inspirationContractProvenance, specArtifactProvenance } from './feature-provenance.js';
import { type ImplPlanResult, parseImplPlan } from './impl-plan.js';
import { evaluateImplementationInspiration } from './inspiration.js';

export type PlanGateVerdict = { ok: true } | { ok: false; reason: string; remediation: string };

const OK: PlanGateVerdict = { ok: true };

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

/** Gate the plan-implementation → implement transition on a valid, planned plan. */
export function evaluateImplementEntry(
  ticketDirectory: string,
  options: { evaluationDate?: string } = {},
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
        'This feature has no impl-plan.md yet — the implementation plan is authored during the plan-implementation phase, before any test or code is written. Next: scaffold impl-plan.md from .safeword/templates/impl-plan-template.md.',
      remediation:
        'Create impl-plan.md next to ticket.md (scaffold from .safeword/templates/impl-plan-template.md), fill each section with content or `skip: <reason>`, keep **Status:** planned, then retry the move to implement.',
    };
  }

  const planContent = readFileSync(planPath, 'utf8');
  const parsed = parseImplPlan(planContent);
  const planVerdict = validateParsedPlan(parsed, activationProvenance === 'activated');
  if (!planVerdict.ok) return planVerdict;

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
