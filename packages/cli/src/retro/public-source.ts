import { readFileSync, statSync } from 'node:fs';
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
  const dotGit = nodePath.join(cwd, '.git');
  if (statSync(dotGit).isDirectory()) return nodePath.join(dotGit, 'config');
  const pointer = readFileSync(dotGit, 'utf8').trim();
  if (!pointer.toLowerCase().startsWith('gitdir:'))
    throw new Error('Invalid Git directory pointer');
  const gitDirectory = nodePath.resolve(cwd, pointer.slice('gitdir:'.length).trim());
  try {
    const common = readFileSync(nodePath.join(gitDirectory, 'commondir'), 'utf8').trim();
    const commonDirectory = nodePath.resolve(gitDirectory, common);
    const backlink = readFileSync(nodePath.join(gitDirectory, 'gitdir'), 'utf8').trim();
    if (
      nodePath.resolve(gitDirectory, backlink) !== dotGit ||
      nodePath.dirname(gitDirectory) !== nodePath.join(commonDirectory, 'worktrees')
    ) {
      throw new Error('Untrusted Git directory pointer');
    }
    return nodePath.join(commonDirectory, 'config');
  } catch {
    if (gitDirectory.startsWith(`${nodePath.resolve(cwd)}${nodePath.sep}`)) {
      return nodePath.join(gitDirectory, 'config');
    }
    throw new Error('Untrusted Git directory pointer');
  }
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
  return line.startsWith('[') && line.endsWith(']') ? line.slice(1, -1).toLowerCase() : undefined;
}

function parseGitEntry(line: string): readonly [string, string] | undefined {
  const separator = line.indexOf('=');
  if (separator === -1) return undefined;
  return [line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()];
}

export interface PublicGitContextOptions {
  environment?: Readonly<Record<string, string | undefined>>;
  homeDirectory?: string;
}

function globalGitConfigPaths(options: PublicGitContextOptions): string[] {
  const environment = options.environment ?? process.env;
  if (environment.GIT_CONFIG_GLOBAL !== undefined) return [environment.GIT_CONFIG_GLOBAL];
  const home = options.homeDirectory ?? homedir();
  const xdg = environment.XDG_CONFIG_HOME ?? nodePath.join(home, '.config');
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
    const globalEmail = collectGlobalGitEmail(options);
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
