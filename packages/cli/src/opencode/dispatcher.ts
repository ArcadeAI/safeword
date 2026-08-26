import process from 'node:process';

import { codexHook } from '../commands/codex-hook.js';

process.env.SAFEWORD_AGENT_RUNTIME = 'opencode';
process.env.SAFEWORD_CODEX_DENY_MODE = 'exit-code';

await codexHook('pre-tool-use');
