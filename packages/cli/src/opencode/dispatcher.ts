import { readFileSync } from 'node:fs';
import process from 'node:process';

import { codexHook } from '../commands/codex-hook.js';
import { observeOpenCodeTicket } from './observe-ticket.js';

process.env.SAFEWORD_AGENT_RUNTIME = 'opencode';
process.env.SAFEWORD_CODEX_DENY_MODE = 'exit-code';

if (process.argv[2] === '--observe-ticket') {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  process.stdout.write(observeOpenCodeTicket(input, process.cwd()));
} else {
  await codexHook('pre-tool-use');
}
