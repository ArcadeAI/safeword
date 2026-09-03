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
  opencode: [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'AZURE_OPENAI_API_KEY',
    'OPENCODE_CONFIG',
    'OPENCODE_CONFIG_CONTENT',
    'OPENCODE_CONFIG_DIR',
  ],
};

const PROCESS_VARIABLES = [
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
] as const;

const REVIEWER_CONTROL_VARIABLES = [
  'SAFEWORD_REVIEW_RUN_BOUND_MS',
  'SAFEWORD_REVIEW_TIMEOUT_MS',
] as const;

// Public-command fixtures use real reviewer subprocesses. Keep their controls
// explicit so an arbitrary SAFEWORD_REVIEW_* value cannot cross that boundary.
const REVIEWER_FIXTURE_VARIABLES = [
  'SAFEWORD_REVIEW_ACCEPTED_MODEL',
  'SAFEWORD_REVIEW_BDD_EXPECTED_MODEL',
  'SAFEWORD_REVIEW_CANDIDATE_LOG',
  'SAFEWORD_REVIEW_CHILD_PID',
  'SAFEWORD_REVIEW_COVERAGE_FAIL',
  'SAFEWORD_REVIEW_COVERAGE_FAIL_CLAUDE',
  'SAFEWORD_REVIEW_COVERAGE_FAIL_CODEX',
  'SAFEWORD_REVIEW_COVERAGE_FINDING',
  'SAFEWORD_REVIEW_COVERAGE_VERDICT',
  'SAFEWORD_REVIEW_DESCENDANT_PID_FILE',
  'SAFEWORD_REVIEW_ENV_LOG',
  'SAFEWORD_REVIEW_FAKE_DELAY_AGENT',
  'SAFEWORD_REVIEW_FAKE_FAILURE',
  'SAFEWORD_REVIEW_FAKE_FAILURE_AGENT',
  'SAFEWORD_REVIEW_FAKE_FAILURE_CLAUDE',
  'SAFEWORD_REVIEW_FAKE_FAILURE_CODEX',
  'SAFEWORD_REVIEW_FAKE_FAILURE_OPENCODE',
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
  'SAFEWORD_REVIEW_LAUNCH_LOG',
  'SAFEWORD_REVIEW_LOG',
  'SAFEWORD_REVIEW_MODEL_LOG',
  'SAFEWORD_REVIEW_MODEL_PROMPT_LOG',
  'SAFEWORD_REVIEW_PROBE_ENV_LOG',
  'SAFEWORD_REVIEW_PROMPT_LOG',
  'SAFEWORD_REVIEW_REJECTED_MODEL_BEHAVIOUR',
  'SAFEWORD_REVIEW_ROUTE_LOG',
  'SAFEWORD_REVIEW_SCHEMA_COPY',
  'SAFEWORD_REVIEW_SCHEMA_PATH_LOG',
  'SAFEWORD_REVIEW_STUBBORN_PID',
  'SAFEWORD_REVIEW_SWAP_ALIAS',
  'SAFEWORD_REVIEW_SWAP_TARGET',
] as const;

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
      ...((source.NODE_ENV ?? process.env.NODE_ENV) === 'test' ? REVIEWER_FIXTURE_VARIABLES : []),
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
  const environment = filteredEnvironment(reviewer, source, platform);
  if (reviewer !== 'opencode') return environment;
  let inlineConfig: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(environment.OPENCODE_CONFIG_CONTENT ?? '{}');
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      inlineConfig = parsed as Record<string, unknown>;
    }
  } catch {
    // An invalid ambient overlay cannot weaken the reviewer's deny-all policy.
  }
  return {
    ...environment,
    OPENCODE_CONFIG_CONTENT: JSON.stringify({ ...inlineConfig, permission: { '*': 'deny' } }),
    OPENCODE_DISABLE_AUTOUPDATE: 'true',
    OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true',
    OPENCODE_DISABLE_LSP_DOWNLOAD: 'true',
  };
}

/** Capability probes must never receive vendor credentials. */
export function reviewerProbeEnvironment(
  source: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  return filteredEnvironment(undefined, source, platform);
}
