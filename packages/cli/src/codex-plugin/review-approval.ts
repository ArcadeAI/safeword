import { randomUUID } from 'node:crypto';
import {
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { parse } from 'smol-toml';

const REVIEW_TOOL_TABLE =
  '[plugins."safeword@safeword".mcp_servers.safeword_review.tools.start_review]';
const REVIEW_APPROVAL = `${REVIEW_TOOL_TABLE}\napproval_mode = "approve"\n`;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function configuredApproval(content: string): unknown {
  const config = record(parse(content));
  const plugin = record(record(config?.plugins)?.['safeword@safeword']);
  const server = record(record(plugin?.mcp_servers)?.safeword_review);
  return record(record(server?.tools)?.start_review);
}

function existingConfigMode(configPath: string): number | undefined {
  try {
    const metadata = lstatSync(configPath);
    if (!metadata.isFile()) {
      throw new Error('Codex config is not a regular file; review approval was not changed');
    }
    return metadata.mode & 0o777;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

/** Only an explicit setup choice calls this. Upgrades and ordinary reviews never re-grant it. */
export function enableCodexReviewApproval(environment: NodeJS.ProcessEnv = process.env): boolean {
  const configPath = nodePath.join(
    environment.CODEX_HOME ?? nodePath.join(homedir(), '.codex'),
    'config.toml',
  );
  const currentMode = existingConfigMode(configPath);
  const current = currentMode === undefined ? '' : readFileSync(configPath, 'utf8');
  let existing: unknown;
  try {
    existing = configuredApproval(current);
  } catch {
    throw new Error('Codex config is invalid TOML; review approval was not changed');
  }
  if (existing !== undefined) {
    if (record(existing)?.approval_mode === 'approve') return false;
    throw new Error('Codex already has a review-tool policy; Safeword left it unchanged');
  }
  const updated = `${current.trimEnd()}\n\n${REVIEW_APPROVAL}`;
  const directory = nodePath.dirname(configPath);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const mode = currentMode ?? 0o600;
  const temporary = nodePath.join(directory, `.config.toml.safeword-${randomUUID()}`);
  const descriptor = openSync(temporary, 'wx', mode);
  try {
    writeFileSync(descriptor, updated);
  } finally {
    closeSync(descriptor);
  }
  try {
    // Parse before replacement so a TOML table collision cannot corrupt the profile.
    configuredApproval(readFileSync(temporary, 'utf8'));
    renameSync(temporary, configPath);
  } catch (error) {
    unlinkSync(temporary);
    throw error;
  }
  return true;
}
