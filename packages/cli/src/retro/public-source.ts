import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

import { readEnabledPublicRetroProject } from './public-config.js';
import { normalizePublicRetroOptionalValue, type PublicRetroSource } from './public-delivery.js';

const ALLOWED_PROTOCOLS = new Set(['git:', 'https:', 'ssh:']);

function repoIdentity(hostname: string, rawPath: string): string | undefined {
  const path = normalizedRepoPath(rawPath);
  if (hostname === '' || path === '' || /[%\s]/u.test(path)) return undefined;
  if (path.split('/').length !== 2) return undefined;
  const normalizedHost = hostname.toLowerCase();
  if (normalizedHost !== 'github.com' && normalizedHost !== 'gitlab.com') return undefined;
  return `${normalizedHost}/${normalizedHost === 'github.com' ? path.toLowerCase() : path}`;
}

function normalizedRepoPath(rawPath: string): string {
  let start = 0;
  let end = rawPath.length;
  while (rawPath[start] === '/') start += 1;
  while (end > start && rawPath[end - 1] === '/') end -= 1;
  let path = rawPath.slice(start, end);
  if (path.toLowerCase().endsWith('.git')) path = path.slice(0, -4);
  return path;
}

function parseScpRemote(remote: string): readonly [string, string] | undefined {
  const separator = remote.indexOf(':');
  if (separator <= 0) return undefined;
  const authority = remote.slice(0, separator);
  const path = remote.slice(separator + 1);
  const at = authority.lastIndexOf('@');
  const hostname = authority.slice(at + 1);
  if (hostname === '' || path === '' || /[\s/]/u.test(authority)) return undefined;
  return [hostname, path];
}

export function normalizeRepoRemote(remote: string): string | undefined {
  if (!remote.includes('://')) {
    const scp = parseScpRemote(remote);
    if (scp) return repoIdentity(...scp);
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

export interface PublicGitContext {
  repository?: string;
}

export interface PublicRetroSourceOptions {
  cliVersion: string;
  harness: PublicRetroSource['harness'];
  osFamily: string;
}

export type CurrentPublicRetroSource = Omit<PublicRetroSource, 'hostClass'> & {
  hostClass: 'unknown';
};

/** Build the exact allowlisted local source profile, or fail closed when disabled. */
export function buildPublicRetroSource(
  cwd: string,
  options: PublicRetroSourceOptions,
): CurrentPublicRetroSource | undefined {
  const project = readEnabledPublicRetroProject(cwd);
  if (project === undefined) return undefined;
  const git = collectPublicGitContext(cwd);
  const cliVersion = normalizePublicRetroOptionalValue(options.cliVersion);
  if (cliVersion === undefined) return undefined;
  const osFamily = normalizePublicRetroOptionalValue(options.osFamily);
  const repo = normalizePublicRetroOptionalValue(git.repository);
  return {
    harness: options.harness,
    hostClass: 'unknown',
    projectUUID: project.projectUUID,
    safewordCliVersion: cliVersion,
    ...(repo !== undefined && { repository: repo }),
    ...(osFamily !== undefined && { osFamily }),
  };
}

function repoGitConfigPath(cwd: string): string {
  const projectDirectory = nodePath.resolve(cwd);
  const dotGit = nodePath.join(projectDirectory, '.git');
  const dotGitEntry = lstatSync(dotGit);
  if (dotGitEntry.isSymbolicLink()) throw new Error('Untrusted Git directory pointer');
  if (dotGitEntry.isDirectory()) return trustedConfigFile(nodePath.join(dotGit, 'config'));
  const pointer = readFileSync(dotGit, 'utf8').trim();
  if (!pointer.toLowerCase().startsWith('gitdir:'))
    throw new Error('Invalid Git directory pointer');
  const gitDirectory = nodePath.resolve(projectDirectory, pointer.slice('gitdir:'.length).trim());
  let commonDirectory: string;
  let backlink: string;
  try {
    const common = readFileSync(nodePath.join(gitDirectory, 'commondir'), 'utf8').trim();
    commonDirectory = nodePath.resolve(gitDirectory, common);
    backlink = readFileSync(nodePath.join(gitDirectory, 'gitdir'), 'utf8').trim();
  } catch {
    throw new Error('Untrusted Git directory pointer');
  }
  if (
    realpathSync(nodePath.resolve(gitDirectory, backlink)) !== realpathSync(dotGit) ||
    realpathSync(nodePath.dirname(gitDirectory)) !==
      realpathSync(nodePath.join(commonDirectory, 'worktrees'))
  ) {
    throw new Error('Untrusted Git directory pointer');
  }
  return trustedConfigFile(nodePath.join(commonDirectory, 'config'));
}

function trustedConfigFile(path: string): string {
  if (lstatSync(path).isSymbolicLink()) throw new Error('Untrusted Git config');
  return path;
}

function parseRepoGitConfig(content: string): {
  remote?: string;
  delegatesConfig: boolean;
} {
  let section = '';
  let remote: string | undefined;
  for (const rawLine of content.split(/\r?\n/u)) {
    let line = rawLine.trim();
    const nextSection = parseGitSection(line);
    if (nextSection !== undefined) {
      section = nextSection;
      line = line.slice(line.indexOf(']') + 1).trim();
    }
    const entry = parseGitEntry(line);
    if (!entry) continue;
    const [key, value] = entry;
    if (section === 'remote "origin"' && key === 'url' && remote === undefined) remote = value;
  }
  return {
    ...(remote !== undefined && { remote }),
    delegatesConfig: hasConfigDelegate(content),
  };
}

function hasConfigDelegate(content: string): boolean {
  return content.split(/\r?\n/u).some(rawLine => {
    const section = parseGitSection(rawLine.trim());
    return (
      section === 'include' ||
      section?.startsWith('includeif ') === true ||
      section?.startsWith('url "') === true
    );
  });
}

function parseGitSection(line: string): string | undefined {
  const end = line.indexOf(']');
  if (!line.startsWith('[') || end === -1) return undefined;
  const declaration = line.slice(1, end).trim();
  let separator = -1;
  let offset = 0;
  for (const character of declaration) {
    if (character.trim() === '') {
      separator = offset;
      break;
    }
    offset += character.length;
  }
  if (separator === -1) return declaration.toLowerCase();
  const section = declaration.slice(0, separator).toLowerCase();
  const quotedSubsection = declaration.slice(separator).trim();
  if (
    !quotedSubsection.startsWith('"') ||
    !quotedSubsection.endsWith('"') ||
    quotedSubsection.slice(1, -1).includes('"')
  ) {
    return undefined;
  }
  return `${section} ${quotedSubsection}`;
}

function parseGitEntry(line: string): readonly [string, string] | undefined {
  const separator = line.indexOf('=');
  if (separator === -1) return undefined;
  const value = parseGitValue(line.slice(separator + 1).trim());
  if (value === undefined) return undefined;
  return [line.slice(0, separator).trim().toLowerCase(), value];
}

function parseGitValue(rawValue: string): string | undefined {
  if (!rawValue.startsWith('"')) {
    const value = stripGitComment(rawValue);
    return value.endsWith('\\') ? undefined : value;
  }
  const closingQuote = rawValue.indexOf('"', 1);
  if (closingQuote === -1 || rawValue.slice(1, closingQuote).includes('\\')) return undefined;
  const suffix = rawValue.slice(closingQuote + 1).trim();
  if (suffix !== '' && !suffix.startsWith('#') && !suffix.startsWith(';')) return undefined;
  return rawValue.slice(1, closingQuote);
}

function stripGitComment(value: string): string {
  const comment = value.search(/[;#]/u);
  return (comment === -1 ? value : value.slice(0, comment)).trim();
}

export function collectPublicGitContext(cwd: string): PublicGitContext {
  try {
    const config = parseRepoGitConfig(readFileSync(repoGitConfigPath(cwd), 'utf8'));
    if (config.delegatesConfig) return {};
    const repo = config.remote === undefined ? undefined : normalizeRepoRemote(config.remote);
    return { ...(repo !== undefined && { repository: repo }) };
  } catch {
    return {};
  }
}
