import { readFileSync } from 'node:fs';
import process from 'node:process';

import { codexHook } from '../commands/codex-hook.js';
import { OBSERVED_FEATURE_BINDING, observeOpenCodeTicket } from './observe-ticket.js';

process.env.SAFEWORD_AGENT_RUNTIME = 'opencode';
process.env.SAFEWORD_CODEX_DENY_MODE = 'exit-code';

if (process.argv[2] === '--observe-ticket') {
  if (observeOpenCodeTicket(JSON.parse(readFileSync(0, 'utf8')), process.cwd()))
    process.exitCode = OBSERVED_FEATURE_BINDING;
} else {
  await codexHook('pre-tool-use');
}
