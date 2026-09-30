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

const REVIEW_TOOLS = ['start_review', 'start_reviewer_login'] as const;
const approval = (tool: string): string =>
  `[plugins."safeword@safeword".mcp_servers.safeword_review.tools.${tool}]\napproval_mode = "approve"\n`;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

// eslint-disable-next-line complexity -- Every parent permission scope must be inspected before adding a tool grant.
function configuredApprovals(content: string): Record<string, unknown> {
  const config = record(parse(content));
  const plugin = record(record(config?.plugins)?.['safeword@safeword']);
  const server = record(record(plugin?.mcp_servers)?.safeword_review);
  if (plugin?.approval_mode !== undefined || server?.approval_mode !== undefined) {
    throw new Error(
      'Codex already has a plugin or server review policy; Safeword left it unchanged',
    );
  }
  return record(server?.tools) ?? {};
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

function missingApprovals(existing: Record<string, unknown>): string[] {
  for (const tool of REVIEW_TOOLS) {
    if (existing[tool] !== undefined && record(existing[tool])?.approval_mode !== 'approve') {
      throw new Error('Codex already has a review-tool policy; Safeword left it unchanged');
    }
  }
  return REVIEW_TOOLS.filter(tool => existing[tool] === undefined);
}

/** Only an explicit setup choice calls this. Upgrades and ordinary reviews never re-grant it. */
// eslint-disable-next-line complexity -- The config write protects each failure and cleanup boundary.
export function enableCodexReviewApproval(environment: NodeJS.ProcessEnv = process.env): boolean {
  const configPath = nodePath.join(
    environment.CODEX_HOME ?? nodePath.join(homedir(), '.codex'),
    'config.toml',
  );
  const currentMode = existingConfigMode(configPath);
  const current = currentMode === undefined ? '' : readFileSync(configPath, 'utf8');
  let existing: Record<string, unknown>;
  try {
    existing = configuredApprovals(current);
  } catch (error) {
    if (error instanceof Error && error.message.includes('review policy')) throw error;
    throw new Error('Codex config is invalid TOML; review approval was not changed', {
      cause: error,
    });
  }
  const missing = missingApprovals(existing);
  if (missing.length === 0) return false;
  process.stderr.write(
    'Safeword review approval: bounded packet contents go to the assigned reviewer provider. Both the review worker and assigned vendor login CLI run outside the author shell sandbox; login may open its sign-in URL. Approving only the named review and reviewer-login tools in this Codex profile.\n',
  );
  const updated = `${current.trimEnd()}\n\n${missing.map(tool => approval(tool)).join('\n')}`;
  const directory = nodePath.dirname(configPath);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const mode = currentMode ?? 0o600;
  const temporary = nodePath.join(directory, `.config.toml.safeword-${randomUUID()}`);
  try {
    const descriptor = openSync(temporary, 'wx', mode);
    try {
      writeFileSync(descriptor, updated);
    } finally {
      closeSync(descriptor);
    }
    // Parse before replacement so a TOML table collision cannot corrupt the profile.
    configuredApprovals(readFileSync(temporary, 'utf8'));
    renameSync(temporary, configPath);
  } catch (error) {
    try {
      unlinkSync(temporary);
    } catch {
      /* Open can fail before creating the file. */
    }
    throw error;
  }
  return true;
}
