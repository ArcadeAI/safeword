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

function parseRepoGitConfig(content: string): { email?: string; remote?: string } {
  let section = '';
  let email: string | undefined;
  let remote: string | undefined;
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    const nextSection = parseGitSection(line);
    if (nextSection !== undefined) {
      section = nextSection;
      continue;
    }
    const entry = parseGitEntry(line);
    if (!entry) continue;
    const [key, value] = entry;
    if (section === 'user' && key === 'email') email = value;
    if (section === 'remote "origin"' && key === 'url') remote = value;
  }
  return { ...(email !== undefined && { email }), ...(remote !== undefined && { remote }) };
}

function parseGitSection(line: string): string | undefined {
  return line.startsWith('[') && line.endsWith(']') ? line.slice(1, -1).toLowerCase() : undefined;
}

function parseGitEntry(line: string): readonly [string, string] | undefined {
  const separator = line.indexOf('=');
  if (separator === -1) return undefined;
  return [line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()];
}

export function collectPublicGitContext(cwd: string): PublicGitContext {
  try {
    const config = parseRepoGitConfig(readFileSync(nodePath.join(cwd, '.git/config'), 'utf8'));
    const repo = config.remote === undefined ? undefined : normalizeRepoRemote(config.remote);
    return {
      ...(repo !== undefined && { repository: repo }),
      ...(config.email !== undefined && config.email.trim() !== '' && { localEmail: config.email }),
    };
  } catch {
    return {};
  }
}
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
