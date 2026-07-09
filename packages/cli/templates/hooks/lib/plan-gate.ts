// TXRHMD (#480): implement-entry plan gate. A new-flow feature ticket (spec.md
// present — same grandfathering marker as the M6D315 stop gate) may only enter
// the implement phase once impl-plan.md parses valid with status `planned`.
// Pure-ish helper (reads only the ticket folder) so the pre-tool hook can call
// it standalone from .safeword/hooks/, mirroring the #404 readiness gate.

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parseImplPlan } from './impl-plan.js';

export type PlanGateVerdict = { ok: true } | { ok: false; reason: string; remediation: string };

const OK: PlanGateVerdict = { ok: true };

/** Gate the plan-implementation → implement transition on a valid, planned plan. */
export function evaluateImplementEntry(ticketDirectory: string): PlanGateVerdict {
  if (!existsSync(nodePath.join(ticketDirectory, 'spec.md'))) return OK;

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

  const parsed = parseImplPlan(readFileSync(planPath, 'utf8'));
  if (parsed.errors.length > 0) {
    return {
      ok: false,
      reason: `impl-plan.md is not ready: ${parsed.errors.join(' ')}`,
      remediation:
        'Fix the named plan sections (content or `skip: <reason>` each), then retry the move to implement.',
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
