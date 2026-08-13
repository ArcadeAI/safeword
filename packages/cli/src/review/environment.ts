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

const PROCESS_VARIABLES = new Set([
  'ALL_PROXY',
  'APPDATA',
  'HOME',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'LANG',
  'LC_ALL',
  'LOGNAME',
  'LOCALAPPDATA',
  'NODE_EXTRA_CA_CERTS',
  'NO_PROXY',
  'PATH',
  'PATHEXT',
  'SHELL',
  'SYSTEMROOT',
  'SSL_CERT_DIR',
  'SSL_CERT_FILE',
  'TEMP',
  'TERM',
  'TMP',
  'TMPDIR',
  'USER',
  'USERPROFILE',
  'COMSPEC',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
  'all_proxy',
  'http_proxy',
  'https_proxy',
  'no_proxy',
]);

const REVIEWER_CONTROL_VARIABLES = new Set([
  'SAFEWORD_REVIEW_RUN_BOUND_MS',
  'SAFEWORD_REVIEW_TIMEOUT_MS',
]);

// Public-command fixtures use real reviewer subprocesses. Keep their controls
// explicit so an arbitrary SAFEWORD_REVIEW_* value cannot cross that boundary.
const REVIEWER_FIXTURE_VARIABLES = new Set([
  'SAFEWORD_REVIEW_ENV_LOG',
  'SAFEWORD_REVIEW_FAKE_DELAY_AGENT',
  'SAFEWORD_REVIEW_FAKE_FAILURE',
  'SAFEWORD_REVIEW_FAKE_FAILURE_AGENT',
  'SAFEWORD_REVIEW_FAKE_FAILURE_CLAUDE',
  'SAFEWORD_REVIEW_FAKE_FAILURE_CODEX',
  'SAFEWORD_REVIEW_FAKE_FAIL_PATH_CONTAINS',
  'SAFEWORD_REVIEW_FAKE_FINDING',
  'SAFEWORD_REVIEW_FAKE_HELP_FAILURE',
  'SAFEWORD_REVIEW_FAKE_IDENTITY',
  'SAFEWORD_REVIEW_FAKE_MODEL_CAPABILITY',
  'SAFEWORD_REVIEW_FAKE_MUTATE',
  'SAFEWORD_REVIEW_FAKE_MUTATE_AGENT',
  'SAFEWORD_REVIEW_FAKE_SOURCE_MUTATE_TARGET',
  'SAFEWORD_REVIEW_FAKE_SUMMARY',
  'SAFEWORD_REVIEW_FAKE_VERDICT',
  'SAFEWORD_REVIEW_HELP_MUTATE',
  'SAFEWORD_REVIEW_LOG',
  'SAFEWORD_REVIEW_MODEL_PROMPT_LOG',
  'SAFEWORD_REVIEW_PROBE_ENV_LOG',
  'SAFEWORD_REVIEW_PROMPT_LOG',
  'SAFEWORD_REVIEW_SWAP_ALIAS',
  'SAFEWORD_REVIEW_SWAP_TARGET',
]);

function filteredEnvironment(
  reviewer: ReviewAgent | undefined,
  source: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  const normalize = (name: string): string => (platform === 'win32' ? name.toUpperCase() : name);
  const allowed = new Set(
    [
      ...PROCESS_VARIABLES,
      ...REVIEWER_CONTROL_VARIABLES,
      ...REVIEWER_FIXTURE_VARIABLES,
      ...(reviewer === undefined ? [] : VENDOR_VARIABLES[reviewer]),
    ].map(name => normalize(name)),
  );
  const managedProgressSignal = normalize('SAFEWORD_REVIEW_PROGRESS');
  return Object.fromEntries(
    Object.entries(source).filter(
      ([name]) => normalize(name) !== managedProgressSignal && allowed.has(normalize(name)),
    ),
  );
}

export function reviewerEnvironment(
  reviewer: ReviewAgent,
  source: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  return filteredEnvironment(reviewer, source, platform);
}

/** Capability probes must never receive vendor credentials. */
export function reviewerProbeEnvironment(
  source: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  return filteredEnvironment(undefined, source, platform);
}
