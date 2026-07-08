/**
 * Shared anchor-artifact fixtures for the acceptance step files (HGYGND
 * cross-scenario refactor): the artifact-content anchor scenarios and the
 * boundary-gate scenarios both need a shape-valid impl-plan to anchor
 * `implement` advances — one builder, no drift.
 */

/** A minimal impl-plan.md that passes parseImplPlan — the implement anchor's artifact. */
export function implPlanContent(): string {
  return [
    '# Impl Plan: fixture',
    '',
    '**Status:** planned',
    '',
    '## Approach',
    '',
    'Do the fixture work.',
    '',
    '## Decisions',
    '',
    'skip: fixture',
    '',
    '## Arch alignment',
    '',
    'skip: fixture',
    '',
    '## Known deviations',
    '',
    'skip: fixture',
    '',
    '## Assessment triggers',
    '',
    'skip: fixture',
    '',
  ].join('\n');
}
