const SCP_REMOTE = /^[^@\s]+@([^:\s]+):(.+)$/u;
const ALLOWED_PROTOCOLS = new Set(['git:', 'https:', 'ssh:']);

function repoIdentity(hostname: string, rawPath: string): string | undefined {
  let path = rawPath;
  while (path.startsWith('/')) path = path.slice(1);
  while (path.endsWith('/')) path = path.slice(0, -1);
  if (path.toLowerCase().endsWith('.git')) path = path.slice(0, -4);
  if (hostname === '' || path === '' || /\s/u.test(path)) return undefined;
  const normalizedHost = hostname.toLowerCase();
  return `${normalizedHost}/${normalizedHost === 'github.com' ? path.toLowerCase() : path}`;
}

export function normalizeRepoRemote(remote: string): string | undefined {
  if (!remote.includes('://')) {
    const scp = SCP_REMOTE.exec(remote);
    if (scp) return repoIdentity(scp[1] ?? '', scp[2] ?? '');
  }
  if (/\s/u.test(remote)) return undefined;
  try {
    const parsed = new URL(remote);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return undefined;
    return repoIdentity(parsed.hostname, parsed.pathname);
  } catch {
    return undefined;
  }
}

export function selectPublicUserIdentity(
  runtimeIdentity: string | undefined,
  localEmail: string | undefined,
  globalEmail: string | undefined,
): string | undefined {
  return [runtimeIdentity, localEmail, globalEmail].find(
    value => value !== undefined && value.trim() !== '',
  );
}

export interface PublicGitContext {
  repository?: string;
  localEmail?: string;
  globalEmail?: string;
}

export function collectPublicGitContext(_cwd: string): PublicGitContext {
  return {};
}
