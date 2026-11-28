import { expect, it } from 'vitest';

import { correlatedToolCommands } from '../helpers/codex-review-receipt.js';
import type { NativeTurn } from '../helpers/codex-workflow-observation.js';

it('accepts the complete output only in the field printed from the matching request', () => {
  const command = 'cat /fixture/skill';
  const body = 'first line\nsecond line\n';
  const input = `const a = await tools.exec_command({"cmd":"pwd"});\nconst b = await tools.exec_command({"cmd":"${command}"});\ntext(JSON.stringify({a:a.output,b:b.output}));`;
  const observed = (a: string, b: string, producer = input) => {
    const output = [
      { type: 'input_text', text: 'Script completed\nWall time 0.4 seconds\nOutput:\n' },
      { type: 'input_text', text: JSON.stringify({ a, b }) },
    ];
    const entries: NativeTurn['entries'] = [
      {
        type: 'response_item',
        payload: { type: 'custom_tool_call', call_id: 'one', input: producer },
      },
      {
        type: 'response_item',
        payload: { type: 'custom_tool_call_output', call_id: 'one', output },
      },
    ];
    return correlatedToolCommands(
      { entries },
      {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: `/bin/zsh -lc '${command}'`,
          exit_code: 0,
          aggregated_output: body,
        },
      },
      body,
    );
  };
  expect(observed('/fixture', body)).toEqual([{ shell: command, callId: 'one' }]);
  expect(observed(body, '/fixture')).toEqual([]);
  expect(observed('/fixture', `${body}extra`)).toEqual([]);
  expect(() =>
    observed('/fixture', body, input.replace('{"cmd":"pwd"}', '{"cmd":"cat /fixture/skill"}')),
  ).toThrow();
});
