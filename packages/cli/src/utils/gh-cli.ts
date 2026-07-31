import { spawnSync } from 'node:child_process';

const GITHUB_TOKEN_ENV_KEY = 'GITHUB_TOKEN';

/**
 * Whether a value has RFC 6750 Bearer credential syntax. GitHub tokens are
 * opaque: their API, not this resolver, decides whether the credential is
 * valid or authorized.
 */
export function isBearerCredentialSyntax(value: string): boolean {
  return /^[\w.~+/-]+=*$/.test(value);
}

/**
 * Ask `gh` for the environment's GitHub token, or undefined if unavailable.
 * `GITHUB_TOKEN` is stripped from the child environment (every key casing,
 * since Node's Windows environment keys are case-insensitive while this
 * copied object is case-sensitive) so a rejected or absent env token cannot
 * re-enter `gh` under a different spelling — this call answers "what does
 * `gh` have on its own" (keychain or its own env), independent of the
 * caller's `GITHUB_TOKEN`.
 */
export function resolveGhCliToken(env: NodeJS.ProcessEnv): string | undefined {
  try {
    const childEnvironment = Object.fromEntries(
      Object.entries(env).filter(
        ([key]) => key.toUpperCase() !== GITHUB_TOKEN_ENV_KEY.toUpperCase(),
      ),
    );
    const result = spawnSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      timeout: 10_000,
      env: childEnvironment,
    });
    // Accept at most one terminal LF or CRLF. Broad trimming could turn malformed
    // credential output into a token-shaped value by silently discarding
    // whitespace or control characters.
    const token = (result.stdout ?? '').replace(/\r?\n$/, '');
    return result.status === 0 && isBearerCredentialSyntax(token) ? token : undefined;
  } catch {
    return undefined;
  }
}
