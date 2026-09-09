import { describe, expect, it } from 'vitest';

import { translateCodexInputToClaudeInputs } from '../../templates/hooks/codex/pre-tool-quality-helpers.js';

describe('Codex pre-tool quality translation', () => {
  it('preserves apply_patch context around a GREEN checkbox transition', () => {
    const [translated] = translateCodexInputToClaudeInputs({
      tool_name: 'apply_patch',
      tool_input: {
        command: [
          '*** Begin Patch',
          '*** Update File: .project/tickets/T1/test-definitions.md',
          '@@',
          '### Scenario: exact boundary',
          '',
          '-- [ ] GREEN',
          '+- [x] GREEN abc1234',
          '*** End Patch',
        ].join('\n'),
      },
    });

    expect(translated).toMatchObject({
      tool_name: 'Edit',
      tool_input: {
        old_string: '### Scenario: exact boundary\n\n- [ ] GREEN',
        new_string: '### Scenario: exact boundary\n\n- [x] GREEN abc1234',
      },
    });
  });
});
