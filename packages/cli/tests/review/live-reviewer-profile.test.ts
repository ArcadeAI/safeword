import { execFileSync } from 'node:child_process';
import process from 'node:process';

import { describe, expect, it } from 'vitest';

import { liveReviewerEnvironment } from '../fixtures/live-reviewer-profile.js';

const child = `process.stdout.write(JSON.stringify({
  claude: process.env.CLAUDE_CONFIG_DIR ?? '<default>',
  codex: process.env.CODEX_HOME ?? '<default>',
  author: process.env.SAFEWORD_AGENT_RUNTIME,
}));`;

const profiles = [
  { reviewer: 'claude', variable: 'CLAUDE_CONFIG_DIR', capture: 'SAFEWORD_LIVE_CLAUDE_CONFIG_DIR' },
  { reviewer: 'codex', variable: 'CODEX_HOME', capture: 'SAFEWORD_LIVE_CODEX_HOME' },
] as const;

describe.each(profiles)('$reviewer live reviewer profile', ({ reviewer, variable, capture }) => {
  it.each([
    { label: 'captured custom profile', value: '/operator/profile', expected: '/operator/profile' },
    { label: 'captured default profile', value: '', expected: '<default>' },
    { label: 'no capture supplied', value: undefined, expected: '/existing/profile' },
  ])(
    'restores $label in the native child without changing the other host',
    ({ value, expected }) => {
      const author = reviewer === 'claude' ? 'codex' : 'claude';
      const output = execFileSync(process.execPath, ['-e', child], {
        encoding: 'utf8',
        env: {
          CLAUDE_CONFIG_DIR: '/existing/profile',
          CODEX_HOME: '/existing/profile',
          ...liveReviewerEnvironment(reviewer, author, { [capture]: value }),
        },
      });
      expect(JSON.parse(output)).toEqual({
        claude: variable === 'CLAUDE_CONFIG_DIR' ? expected : '/existing/profile',
        codex: variable === 'CODEX_HOME' ? expected : '/existing/profile',
        author,
      });
    },
  );
});
