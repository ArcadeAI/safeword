import { describe, expect, it } from 'vitest';

import { buildReplayCommand } from '../../src/cli-protocol/replay-command.js';

describe('replay command builder', () => {
  it('quotes operands, option values, and cwd while omitting absent options', () => {
    expect(
      buildReplayCommand({
        command: 'safeword ticket new',
        operands: ['login task'],
        options: [
          ['--type', 'task'],
          ['--title', "Alex's ticket"],
          ['--why', undefined],
        ],
        cwd: '/tmp/project path',
      }),
    ).toBe(
      `safeword ticket new 'login task' --type 'task' --title 'Alex'"'"'s ticket' --cwd '/tmp/project path'`,
    );
  });
});
