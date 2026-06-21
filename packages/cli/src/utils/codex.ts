import { execFileSync } from 'node:child_process';

import { warn } from './output.js';

const MIN_CODEX_HOOK_VERSION = '0.133.0';
const CODEX_CONFIG_PATH = '.codex/config.toml';
export const CODEX_TRUST_NEXT_STEP =
  'Open Codex and run `/hooks` to review and trust safeword project hooks before relying on Codex gates.';

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

function parseVersionPart(part: string): number | undefined {
  if (part.length === 0) return undefined;
  const parsed = Number(part);
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

function parseVersionCore(core: string): [number, number, number] | undefined {
  const parts = core.split('.');
  if (parts.length !== 3) return undefined;

  const major = parseVersionPart(parts[0] ?? '');
  const minor = parseVersionPart(parts[1] ?? '');
  const patch = parseVersionPart(parts[2] ?? '');

  if (major === undefined) return undefined;
  if (minor === undefined) return undefined;
  if (patch === undefined) return undefined;

  return [major, minor, patch];
}

function parseSemver(version: string): ParsedSemver | undefined {
  const trimmed = version.trim();
  const normalized = trimmed.startsWith('v') ? trimmed.slice(1) : trimmed;
  const withoutBuildMetadata = normalized.split('+', 1)[0] ?? '';
  const [core = '', prerelease] = withoutBuildMetadata.split('-', 2);
  const parsedCore = parseVersionCore(core);
  if (!parsedCore) return undefined;

  const [major, minor, patch] = parsedCore;

  return {
    major,
    minor,
    patch,
    prerelease,
  };
}

function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);
  if (!parsedA || !parsedB) return 0;

  for (const key of ['major', 'minor', 'patch'] as const) {
    if (parsedA[key] < parsedB[key]) return -1;
    if (parsedA[key] > parsedB[key]) return 1;
  }

  if (parsedA.prerelease && !parsedB.prerelease) return -1;
  if (!parsedA.prerelease && parsedB.prerelease) return 1;
  return 0;
}

function parseCodexVersion(output: string): string | undefined {
  const tokens = output.replaceAll(/[\n\t]/g, ' ').split(' ');
  for (const token of tokens) {
    const trimmed = token.trim();
    const normalized = trimmed.startsWith('v') ? trimmed.slice(1) : trimmed;
    if (parseSemver(normalized)) return normalized;
  }
  return undefined;
}

function getCodexVersionWarning(output: string): string | undefined {
  const version = parseCodexVersion(output);
  if (!version || compareSemver(version, MIN_CODEX_HOOK_VERSION) >= 0) return undefined;

  return `Codex ${version} is below safeword's supported hook baseline (${MIN_CODEX_HOOK_VERSION}). Upgrade Codex before trusting safeword's Codex gates.`;
}

export function reconciledCodexConfig(result: { created: string[]; updated: string[] }): boolean {
  return result.created.includes(CODEX_CONFIG_PATH) || result.updated.includes(CODEX_CONFIG_PATH);
}

/** Warn when an installed Codex CLI predates the hook baseline safeword relies on. */
export function warnIfCodexBelowHookFloor(): void {
  try {
    const output = execFileSync('codex', ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000,
    });
    const warning = getCodexVersionWarning(output);
    if (warning) warn(warning);
  } catch {
    // Codex is optional; only warn when an installed CLI is known to be too old.
  }
}
