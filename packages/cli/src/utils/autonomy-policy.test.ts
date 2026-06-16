/**
 * Unit tests for the autonomy-policy resolver (ticket HPQ43R).
 *
 * Covers the pure-function ACs in
 * `.project/tickets/HPQ43R-autonomy-posture-spine/test-definitions.md`:
 * preset → posture maps, project/personal precedence, the no-policy default,
 * invalid-selection rejection, malformed-policy fail-safe, the breakpoint
 * action, and the figure-it-out failure-mode decision.
 *
 * Filesystem-backed reading (project config + gitignored personal override)
 * lives in a sibling test under `tests/utils/`.
 */

import { describe, expect, it } from 'vitest';

import {
  AXES,
  decideFailureAction,
  isValidAxis,
  isValidPosture,
  isValidPreset,
  presetPostureMap,
  PRESETS,
  resolveBreakpointAction,
  resolvePolicy,
} from './autonomy-policy.js';

const ALL_ASK = Object.fromEntries(AXES.map(axis => [axis, 'ask']));

describe('presetPostureMap', () => {
  it('Full review sets every axis to ask', () => {
    expect(presetPostureMap('Full review')).toEqual(ALL_ASK);
  });

  it('Hands-off sets every axis to autonomous', () => {
    const map = presetPostureMap('Hands-off');
    expect(Object.values(map).every(p => p === 'autonomous')).toBe(true);
  });

  it('Guard the contract asks on the contract axes and is autonomous on the rest', () => {
    const map = presetPostureMap('Guard the contract');
    expect(map['intent-and-scope']).toBe('ask');
    expect(map['behavioral-contract']).toBe('ask');
    expect(map['irreversible-design']).toBe('ask');
    expect(map.execution).toBe('autonomous');
    expect(map.completion).toBe('autonomous');
  });
});

describe('resolvePolicy precedence and defaults', () => {
  it('with no policy defaults to Full review (every axis ask)', () => {
    expect(resolvePolicy({})).toEqual(ALL_ASK);
  });

  it('records a project preset as the resolved map', () => {
    expect(resolvePolicy({ project: { preset: 'Guard the contract' } })).toEqual(
      presetPostureMap('Guard the contract'),
    );
  });

  it('applies a per-axis override on top of a preset, keeping the rest', () => {
    const map = resolvePolicy({
      project: { preset: 'Hands-off', overrides: { 'irreversible-design': 'ask' } },
    });
    expect(map['irreversible-design']).toBe('ask');
    expect(map.execution).toBe('autonomous');
  });

  it('lets a personal override take precedence over the project policy', () => {
    const map = resolvePolicy({
      project: { preset: 'Full review' },
      personal: { overrides: { execution: 'autonomous' } },
    });
    expect(map.execution).toBe('autonomous');
    expect(map['intent-and-scope']).toBe('ask');
  });

  it('with no personal override leaves the project policy unchanged', () => {
    expect(resolvePolicy({ project: { preset: 'Guard the contract' } })).toEqual(
      presetPostureMap('Guard the contract'),
    );
  });
});

describe('resolvePolicy fail-safe on invalid or malformed input', () => {
  it('rejects an unknown preset and falls back to Full review', () => {
    expect(resolvePolicy({ project: { preset: 'Reckless' } })).toEqual(ALL_ASK);
  });

  it('ignores an invalid posture value in an override', () => {
    const map = resolvePolicy({
      project: { preset: 'Full review', overrides: { execution: 'sometimes' } },
    });
    expect(map.execution).toBe('ask');
  });

  it('ignores an unknown axis in an override', () => {
    const map = resolvePolicy({
      project: { preset: 'Full review', overrides: { vibes: 'autonomous' } },
    });
    expect(map).toEqual(ALL_ASK);
  });

  it('fails safe to Full review when the project policy is malformed', () => {
    expect(resolvePolicy({ project: 'not-an-object' })).toEqual(ALL_ASK);
  });

  it('falls back to the project policy when the personal override is malformed', () => {
    expect(
      resolvePolicy({ project: { preset: 'Guard the contract' }, personal: 'broken' }),
    ).toEqual(presetPostureMap('Guard the contract'));
  });
});

describe('validators', () => {
  it('accepts the three known presets and rejects others', () => {
    for (const name of PRESETS) expect(isValidPreset(name)).toBe(true);
    expect(isValidPreset('Reckless')).toBe(false);
  });

  it('accepts the two postures and rejects others', () => {
    expect(isValidPosture('ask')).toBe(true);
    expect(isValidPosture('autonomous')).toBe(true);
    expect(isValidPosture('sometimes')).toBe(false);
  });

  it('accepts known axes and rejects others', () => {
    for (const axis of AXES) expect(isValidAxis(axis)).toBe(true);
    expect(isValidAxis('vibes')).toBe(false);
  });
});

describe('resolveBreakpointAction', () => {
  it('pauses on an ask axis', () => {
    expect(resolveBreakpointAction('ask')).toBe('pause');
  });

  it('resolves on an autonomous axis', () => {
    expect(resolveBreakpointAction('autonomous')).toBe('resolve');
  });
});

describe('decideFailureAction', () => {
  it('retries once on a first transient error', () => {
    expect(decideFailureAction({ outcome: 'transient-error', attempts: 1 })).toBe('retry');
  });

  it('defers after a repeated transient error', () => {
    expect(decideFailureAction({ outcome: 'transient-error', attempts: 2 })).toBe('defer');
  });

  it('defers immediately on an inconclusive verdict without retrying', () => {
    expect(decideFailureAction({ outcome: 'inconclusive', attempts: 1 })).toBe('defer');
  });

  it('proceeds on a successful verdict', () => {
    expect(decideFailureAction({ outcome: 'success', attempts: 1 })).toBe('proceed');
  });
});
