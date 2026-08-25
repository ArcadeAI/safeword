import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { writeDurableFile } from '../codex-plugin/durable-write.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function configPath(cwd: string): string {
  return nodePath.join(cwd, '.safeword', 'config.json');
}

function readConfig(cwd: string): Record<string, unknown> {
  const path = configPath(cwd);
  if (!existsSync(path)) return {};
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid .safeword/config.json');
  }
  return parsed as Record<string, unknown>;
}

function validateCollectionSetting(config: Record<string, unknown>): void {
  if (
    'publicRetrospectiveCollection' in config &&
    typeof config.publicRetrospectiveCollection !== 'boolean'
  ) {
    throw new Error('publicRetrospectiveCollection must be true or false');
  }
}

/** Validate user-controlled settings before setup performs any mutation. */
export function validatePublicRetroProjectConfig(cwd: string): void {
  validateCollectionSetting(readConfig(cwd));
}

/** Runtime view: malformed, missing, or explicitly disabled config is silent. */
export function readEnabledPublicRetroProject(cwd: string): { projectUUID: string } | undefined {
  try {
    const config = readConfig(cwd);
    validateCollectionSetting(config);
    if (config.publicRetrospectiveCollection === false || typeof config.projectUUID !== 'string') {
      return undefined;
    }
    const projectUUID = config.projectUUID.toLowerCase();
    return UUID.test(projectUUID) ? { projectUUID } : undefined;
  } catch {
    return undefined;
  }
}

export function publicRetroConfigNeedsUpdate(cwd: string): boolean {
  try {
    const config = readConfig(cwd);
    validateCollectionSetting(config);
    return typeof config.projectUUID !== 'string' || !UUID.test(config.projectUUID);
  } catch {
    return true;
  }
}

/** Ensure the non-secret project identity exists without contacting a server. */
export function ensurePublicRetroProjectConfig(
  cwd: string,
  uuidSource: () => string = randomUUID,
): boolean {
  const config = readConfig(cwd);
  validateCollectionSetting(config);
  const current = typeof config.projectUUID === 'string' ? config.projectUUID.toLowerCase() : '';
  const projectUUID = UUID.test(current) ? current : uuidSource().toLowerCase();
  if (!UUID.test(projectUUID)) throw new Error('UUID source returned an invalid project identity');
  if (config.projectUUID === projectUUID) return false;

  writeDurableFile(
    configPath(cwd),
    `${JSON.stringify({ ...config, projectUUID }, undefined, 2)}\n`,
    { mode: 0o644 },
  );
  return true;
}

export function setPublicRetroCollection(cwd: string, enabled: boolean): boolean {
  if (!existsSync(configPath(cwd))) {
    throw new Error('No SafeWord project configuration found; run `safeword install` first.');
  }
  const config = readConfig(cwd);
  validateCollectionSetting(config);
  if (config.publicRetrospectiveCollection === enabled) return false;
  writeDurableFile(
    configPath(cwd),
    `${JSON.stringify({ ...config, publicRetrospectiveCollection: enabled }, undefined, 2)}\n`,
    { mode: 0o644 },
  );
  return true;
}
