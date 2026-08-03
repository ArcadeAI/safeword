import { describe, expect, it } from 'vitest';

import { SETTINGS_HOOKS } from '../../src/templates/config.js';
import { DECISION_BRIEF_CONTRACT } from '../../templates/hooks/lib/quality.js';
import { appendDecisionBriefContract } from '../../templates/hooks/session-safeword-context.js';

describe('proactive decision-brief contract', () => {
  it.each(['startup', 'resume', 'clear', 'compact', 'fork'])(
    'adds the exact contract once for a Claude %s SessionStart',
    source => {
      const standingContext = 'SAFEWORD standing instructions';
      const context = appendDecisionBriefContract('claude', standingContext);

      expect(source).toBeTruthy();
      expect(context).toContain(standingContext);
      expect(context).toContain(DECISION_BRIEF_CONTRACT);
      expect(context.split(DECISION_BRIEF_CONTRACT)).toHaveLength(2);
      expect(context).not.toContain('Phase: implement. CONFIDENT cites');
    },
  );

  it('leaves non-Claude standing context unchanged', () => {
    expect(appendDecisionBriefContract('cursor', 'standing')).toBe('standing');
    expect(appendDecisionBriefContract('codex', 'standing')).toBe('standing');
  });

  it('configures one phase-neutral context command for every SessionStart source', () => {
    const contextEntries = SETTINGS_HOOKS.SessionStart.filter(entry =>
      entry.hooks.some(hook => hook.command.includes('session-safeword-context.ts')),
    );

    expect(contextEntries).toHaveLength(1);
    expect(contextEntries[0]).not.toHaveProperty('matcher');
  });
});
