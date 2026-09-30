import { describe, expect, it } from 'vitest';

import { retrospectiveGate } from '../../src/review/retrospective-gate.js';
import { RETROSPECTIVE_LEDGER } from '../../src/review/retrospective-history.js';

const request = {
  ticketId: 'CKWE2D',
  ledger: RETROSPECTIVE_LEDGER,
  scenario: 'A nested project uses its committed generated marker',
  eligibilityId: '00000000-0000-0000-0000-000000000001',
  proofId: '00000000-0000-0000-0000-000000000002',
};

describe('retrospective receipt boundary', () => {
  it('rejects another ticket before reading any receipt', () => {
    const result = retrospectiveGate('/not/a/repository', {
      ...request,
      ticketId: 'OTHER1',
    });
    expect(result.state).toBe('action_required');
    expect(result.findings[0]?.code).toBe('RETROSPECTIVE_GATE_BLOCKED');
  });

  it('rejects plausible but nonexistent review identities', () => {
    const result = retrospectiveGate(process.cwd(), request);
    expect(result.state).toBe('action_required');
    expect(result.findings[0]?.message).toContain('independent review receipts');
  });
});
