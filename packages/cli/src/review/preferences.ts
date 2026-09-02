import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { writeDurableFile } from '../codex-plugin/durable-write.js';
import type { ReviewAgent, ReviewAuthor } from './contract.js';
import { parseConfiguredReviewRoutes, type ReviewRoute } from './route-config.js';

export type ReviewRouteScope = 'project' | 'user';
export type ReviewRouteSource = ReviewRouteScope | 'built-in';

export interface UserConfigEnvironment {
  readonly platform: 'unix' | 'windows';
  readonly env: Readonly<Record<string, string | undefined>>;
}

export function resolveSafewordUserConfigPath(input: UserConfigEnvironment): string | undefined {
  const paths = input.platform === 'windows' ? nodePath.win32 : nodePath.posix;
  const xdg = absolute(input.env.XDG_CONFIG_HOME, paths);
  if (xdg !== undefined) return paths.join(xdg, 'safeword', 'config.json');
  if (input.platform === 'windows') {
    const appData = absolute(input.env.APPDATA, paths);
    if (appData !== undefined) return paths.join(appData, 'Safeword', 'config.json');
    const profile = absolute(input.env.USERPROFILE, paths);
    return profile === undefined
      ? undefined
      : paths.join(profile, '.config', 'safeword', 'config.json');
  }
  const home = absolute(input.env.HOME, paths);
  return home === undefined ? undefined : paths.join(home, '.config', 'safeword', 'config.json');
}

function absolute(value: string | undefined, paths: typeof nodePath.posix): string | undefined {
  const trimmed = value?.trim();
  return trimmed !== undefined && paths.isAbsolute(trimmed) ? trimmed : undefined;
}

export function currentUserConfigPath(): string {
  const path = optionalCurrentUserConfigPath();
  if (path === undefined)
    throw new Error('Cannot locate the Safeword user configuration directory.');
  return path;
}

function optionalCurrentUserConfigPath(): string | undefined {
  return resolveSafewordUserConfigPath({
    platform: process.platform === 'win32' ? 'windows' : 'unix',
    env: process.env,
  });
}

export function scopedConfigPath(cwd: string, scope: ReviewRouteScope): string {
  return scope === 'project'
    ? nodePath.join(cwd, '.safeword', 'config.json')
    : currentUserConfigPath();
}

export function readConfigFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  let contents: string;
  try {
    contents = readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(
      `Unable to read Safeword configuration at ${path}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error(`Invalid Safeword configuration at ${path}: expected valid JSON.`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(`Invalid Safeword configuration at ${path}: expected an object.`);
  }
  return parsed as Record<string, unknown>;
}

export function setScopedReviewRoutes(
  cwd: string,
  scope: ReviewRouteScope,
  author: ReviewAgent,
  routes: readonly { readonly reviewer: ReviewAgent; readonly model?: string }[],
): void {
  const path = scopedConfigPath(cwd, scope);
  const config = readConfigFile(path);
  const current = config.crossAgentReviewRoutes;
  if (current !== undefined && (!isRecord(current) || Array.isArray(current))) {
    throw new Error(
      `Invalid Safeword configuration at ${path}: crossAgentReviewRoutes must be an object.`,
    );
  }
  const routeMap = current === undefined ? {} : { ...current };
  routeMap[author] = routes.map(route => ({
    reviewer: route.reviewer,
    ...(route.model !== undefined && { model: route.model }),
  }));
  writeDurableFile(
    path,
    `${JSON.stringify({ ...config, crossAgentReviewRoutes: routeMap }, undefined, 2)}\n`,
    {
      mode: scope === 'user' ? 0o600 : 0o644,
    },
  );
}

export function resetScopedReviewRoutes(
  cwd: string,
  scope: ReviewRouteScope,
  author: ReviewAgent,
): boolean {
  const path = scopedConfigPath(cwd, scope);
  if (!existsSync(path)) return false;
  const config = readConfigFile(path);
  const current = config.crossAgentReviewRoutes;
  if (current !== undefined && (!isRecord(current) || Array.isArray(current))) {
    throw new Error(
      `Invalid Safeword configuration at ${path}: crossAgentReviewRoutes must be an object.`,
    );
  }
  if (current === undefined || !Object.hasOwn(current, author)) return false;
  const routeMap = Object.fromEntries(Object.entries(current).filter(([key]) => key !== author));
  const next = { ...config };
  if (Object.keys(routeMap).length === 0) delete next.crossAgentReviewRoutes;
  else next.crossAgentReviewRoutes = routeMap;
  writeDurableFile(path, `${JSON.stringify(next, undefined, 2)}\n`, {
    mode: scope === 'user' ? 0o600 : 0o644,
  });
  return true;
}

export function effectiveConfiguredRoutes(
  cwd: string,
  author: ReviewAuthor,
): { readonly source: ReviewRouteScope; readonly routes: readonly ReviewRoute[] } | undefined {
  if (author !== 'claude' && author !== 'codex' && author !== 'opencode') return undefined;
  const userPath = optionalCurrentUserConfigPath();
  const userRoutes =
    userPath === undefined
      ? undefined
      : parseConfiguredReviewRoutes(readConfigFile(userPath), author, userPath);
  const projectPath = scopedConfigPath(cwd, 'project');
  const projectRoutes = parseConfiguredReviewRoutes(
    readConfigFile(projectPath),
    author,
    projectPath,
  );
  if (projectRoutes !== undefined) return { source: 'project', routes: projectRoutes };
  return userRoutes === undefined ? undefined : { source: 'user', routes: userRoutes };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
