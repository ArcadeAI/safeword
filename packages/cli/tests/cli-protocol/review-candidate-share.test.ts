import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';

const CODEX_CAPABILITIES =
  '--json --sandbox --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --disable --config --model --output-schema';

/**
 * Installs one `codex` per directory, each either hanging forever or answering
 * at once, so a test can see how a route's deadline is divided between them.
 * `exec` keeps the process directly killable — surviving descendants are a
 * separate concern.
 */
function installCandidate(directory: string, name: string, behaviour: 'hang' | 'answer'): string {
  const bin = nodePath.join(directory, name);
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, 'codex');
  const body =
    behaviour === 'hang'
      ? 'exec /bin/sleep 3600'
      : String.raw`payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
escaped=$(printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"codex","verdict":"approve","summary":"reviewed","findings":[]}' "$dispatch_id" | sed 's/"/\\"/g')
printf '{"type":"item.completed","item":{"id":"i0","type":"agent_message","text":"%s"}}\n' "$escaped"`;
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '${CODEX_CAPABILITIES}'
  exit 0
fi
printf '${name}\n' >> "$SAFEWORD_REVIEW_CANDIDATE_LOG"
${body}
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

describe('dividing a route between its candidates', () => {
  it('leaves a later candidate a real turn when an earlier one hangs', async () => {
    const directory = createTemporaryDirectory();
    const candidateLog = nodePath.join(directory, 'candidates.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    // Outside the reviewed project, so candidate selection keeps them.
    const host = createTemporaryDirectory();
    const stale = installCandidate(host, 'stale', 'hang');
    const working = installCandidate(host, 'working', 'answer');

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'review-input.md',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      {
        cwd: directory,
        env: {
          PATH: `${stale}:${working}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_CANDIDATE_LOG: candidateLog,
          SAFEWORD_REVIEW_TIMEOUT_MS: '4000',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    const tried = existsSync(candidateLog)
      ? readFileSync(candidateLog, 'utf8').split('\n').filter(Boolean)
      : [];
    // Both are asked; the stale one must not have eaten the whole route.
    expect(tried).toEqual(['stale', 'working']);
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        assigned_reviewer: 'codex',
        actual_reviewer: 'codex',
        independence: 'cross-agent',
      },
    });
  });
});
