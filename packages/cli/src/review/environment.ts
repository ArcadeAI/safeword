import type { ReviewAgent } from './contract.js';

const VENDOR_VARIABLES: Readonly<Record<ReviewAgent, readonly string[]>> = {
  claude: [
    'ANTHROPIC_API_KEY',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'CLAUDE_CONFIG_DIR',
    'CLAUDE_SESSION_ID',
    'CLAUDE_CODE_SESSION_ID',
  ],
  codex: [
    'OPENAI_API_KEY',
    'AZURE_OPENAI_API_KEY',
    'CODEX_API_KEY',
    'CODEX_HOME',
    'CODEX_THREAD_ID',
  ],
};

export function reviewerEnvironment(
  reviewer: ReviewAgent,
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const unrelated = reviewer === 'claude' ? VENDOR_VARIABLES.codex : VENDOR_VARIABLES.claude;
  const denied = new Set(unrelated);
  return Object.fromEntries(Object.entries(source).filter(([name]) => !denied.has(name)));
}
