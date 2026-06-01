/**
 * Unit tests for resolveStopPhase — the status/phase done-gate sidestep guard
 * (ticket 2JMQMX). Pure function: given a ticket's details + whether it has a
 * test-definitions.md, decide the effective Stop phase so a status:done close
 * is routed into (or exempted from) the done-gate.
 */

import { describe, expect, it } from 'vitest';

import { resolveStopPhase } from '../../../../.safeword/hooks/lib/active-ticket';

type Details = {
  phase: string | undefined;
  status: string | undefined;
  type: string | undefined;
  folder: string | undefined;
};

function details(over: Partial<Details>): Details {
  return { phase: 'intake', status: 'done', type: 'feature', folder: 'X-foo', ...over };
}

describe('resolveStopPhase — status-close done-gate', () => {
  // AC1 — build ticket closed by status:done is routed into the gate
  it('feature_with_scenarios_closed_by_status_resolves_to_done', () => {
    const result = resolveStopPhase(
      details({ type: 'feature', status: 'done', phase: 'intake' }),
      true,
    );
    expect(result.phase).toBe('done');
    expect(result.type).toBe('feature');
    expect(result.folder).toBe('X-foo');
  });

  it('task_with_scenarios_closed_by_status_resolves_to_done', () => {
    const result = resolveStopPhase(details({ type: 'task', phase: 'implement' }), true);
    expect(result.phase).toBe('done');
  });

  it('build_ticket_without_test_definitions_is_exempt', () => {
    const result = resolveStopPhase(details({ type: 'feature' }), false);
    expect(result.phase).toBeUndefined();
    expect(result.folder).toBeUndefined();
  });

  // AC2 — epic closed by status:done is gated proportionately
  it('epic_closed_by_status_resolves_to_done', () => {
    const result = resolveStopPhase(details({ type: 'epic' }), false);
    expect(result.phase).toBe('done');
    expect(result.folder).toBe('X-foo');
  });

  // AC3 — legitimate states untouched
  it('in_progress_passes_through_actual_phase', () => {
    const result = resolveStopPhase(details({ status: 'in_progress', phase: 'implement' }), true);
    expect(result.phase).toBe('implement');
  });

  it('already_done_ticket_is_not_re_gated', () => {
    const result = resolveStopPhase(details({ status: 'done', phase: 'done' }), true);
    expect(result.phase).toBeUndefined();
  });

  it('patch_and_typeless_closes_are_exempt', () => {
    expect(resolveStopPhase(details({ type: 'patch' }), false).phase).toBeUndefined();
    expect(resolveStopPhase(details({ type: undefined }), false).phase).toBeUndefined();
  });

  it('non_done_non_in_progress_status_is_exempt', () => {
    expect(resolveStopPhase(details({ status: 'backlog' }), true).phase).toBeUndefined();
  });
});
