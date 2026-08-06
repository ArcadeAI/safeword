import { existsSync, lstatSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parse, type ParseError } from 'jsonc-parser';

import { assertSafeClaudeCleanupTarget } from './cleanup-target.js';
import {
  cataloguedClaudeLegacyPaths,
  isAcceptedHistoricalFile,
  isAcceptedHistoricalHook,
} from './historical-ownership.js';

interface LegacyHookReference {
  readonly event: string;
  readonly index: number;
  readonly entry: unknown;
}

export interface ClaudeLegacyObservation {
  readonly recognizedFiles: string[];
  readonly conflictingFiles: string[];
  readonly recognizedHooks: LegacyHookReference[];
  readonly conflictingHooks: LegacyHookReference[];
  readonly settingsError?: string;
}

function referencesLegacyHook(value: unknown): boolean {
  if (typeof value === 'string') return value.includes('.safeword/hooks/');
  if (Array.isArray(value)) return value.some(child => referencesLegacyHook(child));
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).some(child => referencesLegacyHook(child));
}

function observeFiles(
  cwd: string,
): Pick<ClaudeLegacyObservation, 'recognizedFiles' | 'conflictingFiles'> {
  const recognizedFiles: string[] = [];
  const conflictingFiles: string[] = [];
  for (const relativePath of cataloguedClaudeLegacyPaths()) {
    const path = nodePath.join(cwd, relativePath);
    if (!existsSync(path)) continue;
    try {
      const safePath = assertSafeClaudeCleanupTarget(cwd, relativePath);
      const regular = lstatSync(safePath).isFile();
      if (regular && isAcceptedHistoricalFile(relativePath, readFileSync(safePath))) {
        recognizedFiles.push(relativePath);
      } else {
        conflictingFiles.push(relativePath);
      }
    } catch {
      if (existsSync(path)) conflictingFiles.push(relativePath);
    }
  }
  return { recognizedFiles, conflictingFiles };
}

function observeSettings(
  cwd: string,
): Pick<ClaudeLegacyObservation, 'recognizedHooks' | 'conflictingHooks' | 'settingsError'> {
  const settingsPath = nodePath.join(cwd, '.claude/settings.json');
  if (!existsSync(settingsPath)) return { recognizedHooks: [], conflictingHooks: [] };
  if (!lstatSync(settingsPath).isFile()) {
    return {
      recognizedHooks: [],
      conflictingHooks: [],
      settingsError: '.claude/settings.json is not a regular file.',
    };
  }
  const errors: ParseError[] = [];
  const settings = parse(readFileSync(settingsPath, 'utf8'), errors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as { hooks?: Record<string, unknown> } | undefined;
  if (errors.length > 0 || typeof settings !== 'object' || settings === null) {
    return {
      recognizedHooks: [],
      conflictingHooks: [],
      settingsError: '.claude/settings.json could not be parsed safely.',
    };
  }
  return classifySettingsHooks(settings.hooks ?? {});
}

function classifySettingsHooks(
  hooks: Record<string, unknown>,
): Pick<ClaudeLegacyObservation, 'recognizedHooks' | 'conflictingHooks'> {
  const recognizedHooks: LegacyHookReference[] = [];
  const conflictingHooks: LegacyHookReference[] = [];
  const events = Object.entries(hooks);
  for (const [event, value] of events) {
    if (!Array.isArray(value)) continue;
    const entries = value.entries();
    for (const [index, entry] of entries) {
      if (isAcceptedHistoricalHook(event, entry)) {
        recognizedHooks.push({ event, index, entry });
      } else if (referencesLegacyHook(entry)) {
        conflictingHooks.push({ event, index, entry });
      }
    }
  }
  return { recognizedHooks, conflictingHooks };
}

export function observeClaudeLegacy(cwd: string): ClaudeLegacyObservation {
  return { ...observeFiles(cwd), ...observeSettings(cwd) };
}

export function legacyObservationIsEmpty(observation: ClaudeLegacyObservation): boolean {
  return (
    observation.recognizedFiles.length === 0 &&
    observation.conflictingFiles.length === 0 &&
    observation.recognizedHooks.length === 0 &&
    observation.conflictingHooks.length === 0 &&
    observation.settingsError === undefined
  );
}
