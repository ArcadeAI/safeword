import { describe, expect, it } from 'vitest';

import { evaluateInspirationActivation } from '../../templates/hooks/lib/inspiration.js';

const SPEC_MARKER = '<!-- safeword:inspiration-contract:v1 -->';

function ticket(signals: string[] = []): string {
  return ['---', 'id: EXAMPLE', 'type: feature', ...signals, '---', ''].join('\n');
}

function spec(marker = ''): string {
  return ['# Spec: Example', marker, '', '## Intent', 'Example'].join('\n');
}

describe('inspiration contract activation', () => {
  it('grandfathers a signal-free pre-v1 artifact regardless of creation date', () => {
    expect(
      evaluateInspirationActivation({
        ticketContent: ticket(['created: 2099-01-01T00:00:00.000Z']),
        specContent: spec(),
      }),
    ).toEqual({ ok: true, activated: false });
  });

  it('accepts the exact ticket marker, scaffold sentinel, and spec marker together', () => {
    expect(
      evaluateInspirationActivation({
        ticketContent: ticket(['inspiration_contract: v1', 'inspiration_contract_scaffold: v1']),
        specContent: spec(SPEC_MARKER),
      }),
    ).toEqual({ ok: true, activated: true });
  });

  it.each([
    {
      name: 'ticket marker only',
      ticketSignals: ['inspiration_contract: v1'],
      marker: '',
    },
    {
      name: 'spec marker only',
      ticketSignals: [],
      marker: SPEC_MARKER,
    },
    {
      name: 'scaffold sentinel after both version markers were deleted',
      ticketSignals: ['inspiration_contract_scaffold: v1'],
      marker: '',
    },
  ])('rejects an activated artifact with missing companions: $name', fixture => {
    const result = evaluateInspirationActivation({
      ticketContent: ticket(fixture.ticketSignals),
      specContent: spec(fixture.marker),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('all three');
  });
});
