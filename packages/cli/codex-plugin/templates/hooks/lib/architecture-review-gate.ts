// Shared prerequisite and architecture decisions. Callers own host response/continuation transport.
import { existsSync, readFileSync } from 'node:fs';

import { hasCitation, parseImplPlan, sectionBody } from './impl-plan.ts';
import { resolveNamespaceRoot } from './namespace-root.ts';
import {
  hashArtifact,
  isArchitectureReviewGateEnabled,
  parseReviewStamps,
  reviewGateForIndependentDesign,
  reviewScope,
} from './review-ledger.ts';
import { verifiedStamps } from './verify-stamp-claims.ts';

export interface ArchitectureTicket {
  type: string | undefined;
  folder: string | undefined;
  phase: string | undefined;
}

/**
 * Check the impl-plan artifact for new-flow features (tickets XDNSZA + ERVA6V).
 * Features with spec.md (post-DZ2NM5 flow) at implement+ require an
 * impl-plan.md whose five sections are content-or-skip valid; from verify
 * onward its status must be `implemented` — the plan-vs-actual reconciliation
 * at implement exit flips it. Authored during the plan-implementation phase; grandfathered
 * tickets (no spec.md) and tasks are exempt.
 */
export function implPlanPrerequisiteReason(
  projectDir: string,
  ticketInfo: ArchitectureTicket,
): string | undefined {
  const ticketsDir = `${resolveNamespaceRoot(projectDir)}/tickets`;
  if (ticketInfo.type !== 'feature') return;
  if (!ticketInfo.folder || !ticketInfo.phase) return;

  const phasesRequiringImplPlan = ['implement', 'verify', 'done'];
  if (!phasesRequiringImplPlan.includes(ticketInfo.phase)) return;

  // Grandfathering: spec.md presence routes new-flow vs pre-spec tickets (DZ2NM5 D5).
  if (!existsSync(`${ticketsDir}/${ticketInfo.folder}/spec.md`)) return;

  const implPlanPath = `${ticketsDir}/${ticketInfo.folder}/impl-plan.md`;
  if (!existsSync(implPlanPath)) {
    return `Feature at ${ticketInfo.phase} phase requires impl-plan.md (authored during the plan-implementation phase). Create it from the impl-plan template with all five required sections (plus optional Doc impact), each content or skip: <reason>, before stopping.`;
  }

  const { status, errors } = parseImplPlan(readFileSync(implPlanPath, 'utf8'));
  if (errors.length > 0) {
    return `impl-plan.md validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
  }

  // Reconciliation gate (ERVA6V): the plan must reflect shipped reality
  // before the ticket advances past implement.
  const phasesRequiringImplemented = ['verify', 'done'];
  if (phasesRequiringImplemented.includes(ticketInfo.phase) && status !== 'implemented') {
    return `Impl plan reconciliation incomplete: impl-plan.md status is "${status ?? 'unknown'}". Walk Decisions, Design alignment, and Known deviations against what shipped, then set **Status:** implemented (see TDD.md "Implement exit: reconcile the plan").`;
  }
  return undefined;
}

/**
 * Architecture review gate (ticket MR5M3A). DEFAULT-OFF: fires only when
 * `.safeword/config.json` sets `architectureReviewGate: true`. For a new-flow
 * feature leaving implement (verify/done), require (a) the impl-plan Decisions
 * section to carry cited evidence — the /figure-it-out trace — and (b) a
 * design-review stamp bound to this ticket's impl-plan at its current content.
 * The review stamp may record reduced independence. Claude also calls the
 * prerequisite unconditionally, so absent/malformed plans are
 * returned first by the shared prerequisite (precedence). Skips and exemptions are auditable.
 */
export function architectureReviewReason(
  projectDir: string,
  ticketInfo: ArchitectureTicket,
): string | undefined {
  const ticketsDir = `${resolveNamespaceRoot(projectDir)}/tickets`;
  if (ticketInfo.type !== 'feature' || !ticketInfo.folder || !ticketInfo.phase) return;
  if (!['verify', 'done'].includes(ticketInfo.phase)) return;

  const configPath = `${projectDir}/.safeword/config.json`;
  const rawConfig = existsSync(configPath) ? readFileSync(configPath, 'utf8') : undefined;
  if (!isArchitectureReviewGateEnabled(rawConfig)) return;

  const prerequisite = implPlanPrerequisiteReason(projectDir, ticketInfo);
  if (prerequisite) return prerequisite;

  // Grandfathered (no spec.md) features are exempt, mirroring the prerequisite.
  if (!existsSync(`${ticketsDir}/${ticketInfo.folder}/spec.md`)) return;

  const implPlanPath = `${ticketsDir}/${ticketInfo.folder}/impl-plan.md`;
  if (!existsSync(implPlanPath)) return; // prerequisite already checked existence
  const planContent = readFileSync(implPlanPath, 'utf8');
  const parsed = parseImplPlan(planContent);
  if (parsed.errors.length > 0) return; // prerequisite already checked parsing

  // Generation half: Decisions carries a citation, or an auditable skip.
  const decisionsSkip = parsed.sections.Decisions?.skip;
  const decisionsSkipped = typeof decisionsSkip === 'string' && decisionsSkip.trim() !== '';
  if (!decisionsSkipped && !hasCitation(sectionBody(planContent, 'Decisions'))) {
    return 'Architecture review gate: the impl-plan Decisions section needs cited evidence (a URL or a [n] source-reference marker) — the trace that real evidence was weighed. Add a citation, or mark the section `skip: <reason>`.';
  }

  // Selection half: a satisfying design-review stamp for this ticket's plan at its current content.
  const logPath = `${resolveNamespaceRoot(projectDir)}/skill-invocations.log`;
  const scope = reviewScope(ticketInfo.folder, 'impl-plan', hashArtifact(planContent));
  const stamps = existsSync(logPath)
    ? verifiedStamps(parseReviewStamps(readFileSync(logPath, 'utf8')), projectDir, scope)
    : [];
  if (!reviewGateForIndependentDesign(scope, stamps).ok) {
    return 'Architecture review gate: the impl-plan design has no independent design review at its current content. Run `safeword review run plan-implementation ...`, then record its author_agent, actual_reviewer, and independence with `bun .safeword/hooks/write-review-stamp.ts impl-plan`; add a model only when independently verified.';
  }
  return undefined;
}
