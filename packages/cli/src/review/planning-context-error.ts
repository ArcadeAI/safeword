import { ReviewPacketError } from './packet-error.js';

export const PLANNING_CONTEXT_ROLES = [
  'ticket',
  'project',
  'parent',
  'milestone',
  'rules',
  'scenarios',
  'dimensions',
  'principles',
  'personas',
  'surfaces',
  'architecture',
  'data',
  'reusable-evidence',
  'accepted-upstream-plan',
] as const;
export type PlanningContextRole = (typeof PLANNING_CONTEXT_ROLES)[number];

export class PlanningContextError extends ReviewPacketError {
  readonly code = 'missing_planning_context';
  constructor(
    readonly contextRole: PlanningContextRole,
    readonly contextPath: string,
    declaration?: string,
    reconciliation = false,
  ) {
    const settings: Partial<Record<PlanningContextRole, string>> = {
      parent: 'the ticket parent reference',
      ticket: 'the ticket metadata',
      project: 'the ticket Product Plan',
      'accepted-upstream-plan': 'the owning Implementation Plan',
      scenarios: 'the ticket scenario source',
      dimensions: 'the ticket dimensions artifact',
      data: 'the active data architecture guide',
    };
    const setting = settings[contextRole] ?? `paths.${contextRole}`;
    const unavailable = reconciliation
      ? `Planning ${contextRole} override at ${contextPath} needs reconciliation with the current packaged source. Restore its configured file or correct ${setting} and its source-version lineage, then rerun the planning review.`
      : `Required planning ${contextRole} at ${contextPath} are unavailable. Restore that source or correct ${setting}, then rerun the planning review.`;
    super(
      declaration === undefined
        ? unavailable
        : `The reviewed plan at ${contextPath} needs one parseable ${declaration} declaration. Add the plan decision or a justified skip, then rerun the planning review.`,
    );
  }
}
