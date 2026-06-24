/**
 * Per-provider human-handoff steps (2TK5AD AC2) — the exact actions only the
 * human can do. Pure text; the orchestration prints these and waits. Vocabulary
 * discipline: "ticket" for the repo file, "issue" for the projected object.
 */

import type { Provider } from '../tracker-sync/types.js';
import type { ConnectTarget } from './types.js';

/** Build the printed handoff steps for `provider`. */
export function handoffSteps(provider: Provider, target: ConnectTarget): string[] {
  if (provider === 'github') {
    const repo = target.repo ?? '<owner/repo>';
    return [
      `Install the safeword[bot] GitHub App for ${repo}:`,
      '  https://github.com/apps/safeword/installations/new',
      'Or, if you can’t install the App, export a Personal Access Token (PAT)',
      'with repo scope as GITHUB_TOKEN before connecting.',
    ];
  }
  return [
    'Authorize safeword in Arcade (OAuth) and approve in your browser:',
    '  https://api.arcade.dev/oauth/authorize',
    'Arcade holds the Linear token; safeword stores only the Arcade key.',
  ];
}
