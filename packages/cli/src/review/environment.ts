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

function filteredEnvironment(
  reviewer: ReviewAgent | undefined,
  source: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  const normalize = (name: string): string => (platform === 'win32' ? name.toUpperCase() : name);
  const allowed = new Set(
    [...PROCESS_VARIABLES, ...(reviewer === undefined ? [] : VENDOR_VARIABLES[reviewer])].map(
      name => normalize(name),
    ),
  );
  const managedProgressSignal = normalize('SAFEWORD_REVIEW_PROGRESS');
  return Object.fromEntries(
    Object.entries(source).filter(
      ([name]) =>
        normalize(name) !== managedProgressSignal &&
        (allowed.has(normalize(name)) || normalize(name).startsWith('SAFEWORD_REVIEW_')),
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
