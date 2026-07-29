import { describe, expect, it } from 'vitest';

import { parseLogLine } from '../../templates/hooks/lib/re-entry.js';

describe('parseLogLine', () => {
  it('parses every required field from a canonical re-entry line', () => {
    expect(
      parseLogLine('2026-07-29T12:34:56Z sess_123 ticket=505/implement Next: run verification'),
    ).toEqual({
      timestamp: '2026-07-29T12:34:56Z',
      sessionId: 'sess_123',
      ticket: 'ticket=505/implement',
      nextImperative: 'run verification',
    });
  });

  it('rejects a line with a missing imperative', () => {
    expect(parseLogLine('2026-07-29T12:34:56Z sess_123 ticket=505/implement Next:')).toBeNull();
  });
});
