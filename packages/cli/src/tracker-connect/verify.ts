/**
 * Live verify client (2TK5AD AC4) — the untested-by-unit boundary. GitHub uses
 * `gh api user` (non-destructive identity check); on failure it names the missing
 * piece. Linear verification is pending the Arcade integration (same deferral as
 * JS5K5G's Linear writer) and says so rather than failing obscurely.
 */

import { execFileSync } from 'node:child_process';

import type { Provider } from '../tracker-sync/types.js';
import type { VerifyClient, VerifyResult } from './types.js';

function classifyGithubFailure(message: string): string {
  if (/command not found|ENOENT|Executable not found/i.test(message)) {
    return 'the gh CLI is not installed';
  }
  if (/not.*authenticat|gh auth login|HTTP 401|Bad credentials/i.test(message)) {
    return 'no GitHub credential resolved (run `gh auth login` or set GITHUB_TOKEN)';
  }
  if (/HTTP 403|scope|insufficient/i.test(message)) return 'the token is missing required scope';
  return `GitHub auth check failed: ${message.trim().split('\n', 1)[0] ?? 'unknown error'}`;
}

export function createVerifyClient(): VerifyClient {
  return {
    whoami(provider: Provider): Promise<VerifyResult> {
      if (provider === 'linear') {
        return Promise.resolve({
          ok: false,
          missing: 'Linear verification needs the Arcade integration — not wired in v1',
        });
      }
      try {
        execFileSync('gh', ['api', 'user', '--jq', '.login'], { encoding: 'utf8', stdio: 'pipe' });
        return Promise.resolve({ ok: true });
      } catch (error) {
        const stderr = (error as { stderr?: Buffer | string }).stderr?.toString() ?? '';
        return Promise.resolve({
          ok: false,
          missing: classifyGithubFailure(`${stderr}${(error as Error).message ?? ''}`),
        });
      }
    },
  };
}
