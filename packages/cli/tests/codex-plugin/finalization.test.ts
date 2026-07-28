import { describe, expect, it, vi } from 'vitest';

import { resolveCodexFinalizationConfirmation } from '../../src/codex-plugin/finalization.js';

describe('Codex migration finalization', () => {
  it('leaves finalization unconfirmed when the interactive prompt is declined', async () => {
    const confirm = vi.fn().mockResolvedValue(false);

    const confirmed = await resolveCodexFinalizationConfirmation({
      assumeYes: false,
      confirm,
    });

    expect(confirmed).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
  });
});
