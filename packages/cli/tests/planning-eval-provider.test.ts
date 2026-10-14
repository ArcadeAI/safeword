import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { callClaude } from '../scripts/lib/planning-eval-provider.js';

it('accepts valid structured output without a premature CLI turn cutoff', () => {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'planning-provider-test-'));
  const executable = nodePath.join(directory, 'claude');
  // Simulate only the external CLI. Its structured-output repair needs four
  // turns; the provider must retain its wall-clock bound without rejecting it.
  writeFileSync(
    executable,
    `#!${process.execPath}
const args = process.argv.slice(2);
const index = args.indexOf('--max-turns');
if (index !== -1 && Number(args[index + 1]) < 4) {
  console.log(JSON.stringify({is_error: true, subtype: 'error_max_turns', num_turns: 4}));
  process.exit(1);
}
console.log(JSON.stringify({
  is_error: false,
  modelUsage: {'claude-opus-5': {}},
  structured_output: {correct: true, reason: 'The supplied plan meets its contract.'}
}));
`,
  );
  chmodSync(executable, 0o755);
  try {
    expect(
      callClaude(
        'claude-opus-5',
        'Review the plan.',
        {},
        {
          ...process.env,
          PATH: `${directory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
        },
      ),
    ).toEqual({ correct: true, reason: 'The supplied plan meets its contract.' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
