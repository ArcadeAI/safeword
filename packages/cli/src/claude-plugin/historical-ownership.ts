import { createHash } from 'node:crypto';

import { normalizeSafewordHookCommands } from '../utils/hooks.js';
import { CLAUDE_HISTORICAL_CATALOGUE } from './historical-catalogue.generated.js';

function sha256(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

function compareKeys(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(child => stable(child));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(([left], [right]) => compareKeys(left, right))
      .map(([key, child]) => [key, stable(child)]),
  );
}

export function historicalCatalogueDigest(): string {
  return sha256(JSON.stringify(CLAUDE_HISTORICAL_CATALOGUE));
}

export function isAcceptedHistoricalFile(relativePath: string, content: Buffer | string): boolean {
  const digest = sha256(content);
  return [
    CLAUDE_HISTORICAL_CATALOGUE.current,
    ...Object.values(CLAUDE_HISTORICAL_CATALOGUE.releases),
  ].some(release => (release.files as Record<string, string>)[relativePath] === digest);
}

export function isAcceptedHistoricalHook(event: string, entry: unknown): boolean {
  const canonical = JSON.stringify(stable(normalizeSafewordHookCommands(entry)));
  const fingerprint = sha256(canonical);
  return [
    CLAUDE_HISTORICAL_CATALOGUE.current,
    ...Object.values(CLAUDE_HISTORICAL_CATALOGUE.releases),
  ].some(release =>
    ((release.hooks as Record<string, readonly string[]>)[event] ?? []).includes(fingerprint),
  );
}

export function acceptedHistoricalHookEntries(event: string): unknown[] {
  const fingerprints = new Set(
    [
      CLAUDE_HISTORICAL_CATALOGUE.current,
      ...Object.values(CLAUDE_HISTORICAL_CATALOGUE.releases),
    ].flatMap(release => (release.hooks as Record<string, readonly string[]>)[event] ?? []),
  );
  return [...fingerprints].map(fingerprint => historicalHookEntry(fingerprint));
}

export function historicalHookEntry(fingerprint: string): unknown {
  return (CLAUDE_HISTORICAL_CATALOGUE.hook_entries as Record<string, unknown>)[fingerprint];
}

export function supportedClaudeLegacyReleases(): string[] {
  return Object.keys(CLAUDE_HISTORICAL_CATALOGUE.releases);
}

export function cataloguedClaudeLegacyPaths(): string[] {
  return [
    ...new Set(
      [
        CLAUDE_HISTORICAL_CATALOGUE.current,
        ...Object.values(CLAUDE_HISTORICAL_CATALOGUE.releases),
      ].flatMap(release => Object.keys(release.files)),
    ),
  ].toSorted((left, right) => left.localeCompare(right));
}
