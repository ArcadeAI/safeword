import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { readEnabledPublicRetroProject } from './public-config.js';
import type { PublicRetroSource } from './public-delivery.js';

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
  return [runtimeIdentity, localEmail, globalEmail]
    .find(value => value !== undefined && value.trim() !== '')
    ?.trim();
}

export interface PublicGitContext {
  repository?: string;
  localEmail?: string;
  globalEmail?: string;
}

export interface PublicRetroSourceOptions {
  agentVersion?: string;
  cliVersion: string;
  environment?: Readonly<Record<string, string | undefined>>;
  harness: PublicRetroSource['harness'];
  model?: string;
  osFamily: string;
  pluginVersion?: string;
  runtimeIdentity?: string;
}

function optionalValue(value: string | undefined): string | undefined {
  return value !== undefined && value.trim() !== '' ? value.trim() : undefined;
}

/** Build the exact allowlisted local source profile, or fail closed when disabled. */
export function buildPublicRetroSource(
  cwd: string,
  options: PublicRetroSourceOptions,
): PublicRetroSource | undefined {
  const project = readEnabledPublicRetroProject(cwd);
  if (project === undefined) return undefined;
  const git = collectPublicGitContext(cwd, { environment: options.environment });
  const userIdentity = selectPublicUserIdentity(
    options.runtimeIdentity,
    git.localEmail,
    git.globalEmail,
  );
  return {
    harness: options.harness,
    hostClass: 'local',
    projectUUID: project.projectUUID,
    safewordCliVersion: options.cliVersion.trim(),
    ...(git.repository !== undefined && { repository: git.repository }),
    ...(optionalValue(options.agentVersion) !== undefined && {
      agentVersion: optionalValue(options.agentVersion),
    }),
    ...(optionalValue(options.model) !== undefined && { model: optionalValue(options.model) }),
    ...(optionalValue(options.pluginVersion) !== undefined && {
      safewordPluginVersion: optionalValue(options.pluginVersion),
    }),
    ...(optionalValue(options.osFamily) !== undefined && {
      osFamily: optionalValue(options.osFamily),
    }),
    ...(userIdentity !== undefined && { userIdentity }),
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
  email?: string;
  remote?: string;
  delegatesIdentity: boolean;
} {
  let section = '';
  let email: string | undefined;
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
    if (section === 'user' && key === 'email') email = value;
    if (section === 'remote "origin"' && key === 'url') remote = value;
  }
  return {
    ...(email !== undefined && { email }),
    ...(remote !== undefined && { remote }),
    delegatesIdentity: hasIdentityDelegate(content),
  };
}

function hasIdentityDelegate(content: string): boolean {
  return content.split(/\r?\n/u).some(rawLine => {
    const section = parseGitSection(rawLine.trim());
    return section === 'include' || section?.startsWith('includeif ') === true;
  });
}

function parseGitSection(line: string): string | undefined {
  const end = line.indexOf(']');
  return line.startsWith('[') && end !== -1
    ? line.slice(1, end).toLowerCase().split(/\s/u).filter(Boolean).join(' ')
    : undefined;
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

export interface PublicGitContextOptions {
  environment?: Readonly<Record<string, string | undefined>>;
  homeDirectory?: string;
}

function globalGitConfigPaths(options: PublicGitContextOptions): string[] {
  const environment = options.environment ?? process.env;
  if (
    environment.GIT_CONFIG_GLOBAL !== undefined &&
    nodePath.isAbsolute(environment.GIT_CONFIG_GLOBAL)
  ) {
    return [environment.GIT_CONFIG_GLOBAL];
  }
  const home = options.homeDirectory ?? homedir();
  if (!nodePath.isAbsolute(home)) return [];
  const xdg =
    environment.XDG_CONFIG_HOME !== undefined && nodePath.isAbsolute(environment.XDG_CONFIG_HOME)
      ? environment.XDG_CONFIG_HOME
      : nodePath.join(home, '.config');
  return [nodePath.join(xdg, 'git/config'), nodePath.join(home, '.gitconfig')];
}

function collectGlobalGitEmail(options: PublicGitContextOptions): string | undefined {
  let email: string | undefined;
  let delegatesIdentity = false;
  for (const path of globalGitConfigPaths(options)) {
    try {
      const config = parseRepoGitConfig(readFileSync(path, 'utf8'));
      delegatesIdentity ||= config.delegatesIdentity;
      if (config.email !== undefined && config.email.trim() !== '') email = config.email;
    } catch {
      // Missing optional global config contributes no identity.
    }
  }
  return delegatesIdentity ? undefined : email;
}

export function collectPublicGitContext(
  cwd: string,
  options: PublicGitContextOptions = {},
): PublicGitContext {
  try {
    const config = parseRepoGitConfig(readFileSync(repoGitConfigPath(cwd), 'utf8'));
    const repo = config.remote === undefined ? undefined : normalizeRepoRemote(config.remote);
    const globalEmail = config.delegatesIdentity ? undefined : collectGlobalGitEmail(options);
    return {
      ...(repo !== undefined && { repository: repo }),
      ...(!config.delegatesIdentity &&
        config.email !== undefined &&
        config.email.trim() !== '' && { localEmail: config.email }),
      ...(globalEmail !== undefined && { globalEmail }),
    };
  } catch {
    return {};
  }
}
