import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parse } from 'smol-toml';

import { writeDurableFile } from './durable-write.js';
import { CODEX_MIGRATION_SCHEMA } from './inventory.js';
import { regularCodexConfigMetadata } from './legacy-config.js';

const BEGIN_MARKER = '# --- safeword codex bootstrap: begin ---';
const END_MARKER = '# --- safeword codex bootstrap: end ---';
const BOOTSTRAP_COMMAND = 'bunx --bun safeword@latest codex bootstrap';
const DEPENDENCY_BOOTSTRAP_COMMAND =
  'SAFEWORD_PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)" && { [ ! -f "$SAFEWORD_PROJECT_ROOT/.safeword/hooks/dependency-bootstrap.ts" ] || bun "$SAFEWORD_PROJECT_ROOT/.safeword/hooks/dependency-bootstrap.ts" "$SAFEWORD_PROJECT_ROOT"; }';

const BOOTSTRAP_BLOCK = `${BEGIN_MARKER}
[[hooks.SessionStart]]
matcher = ""

[[hooks.SessionStart.hooks]]
type = "command"
command = "${BOOTSTRAP_COMMAND}"
timeout = 120
statusMessage = "Checking Safeword for this project"

[[hooks.SessionStart]]
matcher = ""

[[hooks.SessionStart.hooks]]
type = "command"
command = '${DEPENDENCY_BOOTSTRAP_COMMAND}'
timeout = 120
statusMessage = "Preparing safeword dependencies"
${END_MARKER}
`;

function withoutManagedBlock(content: string): string {
  const begin = content.indexOf(BEGIN_MARKER);
  const end = content.indexOf(END_MARKER);
  if (begin === -1 && end === -1) {
    if (content.includes(BOOTSTRAP_COMMAND) || content.includes('dependency-bootstrap.ts')) {
      throw new Error(
        'Codex configuration contains an unrecognized Safeword bootstrap command; no changes were made.',
      );
    }
    return content;
  }
  if (begin === -1 || end === -1 || end < begin || content.includes(BEGIN_MARKER, begin + 1)) {
    throw new Error(
      'Codex configuration contains malformed Safeword bootstrap markers; no changes were made.',
    );
  }
  const afterEnd = end + END_MARKER.length;
  if (content.includes(END_MARKER, afterEnd)) {
    throw new Error(
      'Codex configuration contains duplicate Safeword bootstrap markers; no changes were made.',
    );
  }
  const before = content.slice(0, begin).trimEnd();
  const after = content.slice(afterEnd).trimStart();
  return [before, after].filter(section => section !== '').join('\n\n');
}

export function codexProjectBootstrapContent(content: string): string {
  try {
    parse(content);
  } catch (error) {
    throw new Error('Codex configuration is invalid TOML; no bootstrap was installed.', {
      cause: error,
    });
  }
  const preserved = withoutManagedBlock(content).trimEnd();
  const prefix = preserved === '' ? '' : `${preserved}\n\n`;
  const next = `${prefix}${BOOTSTRAP_BLOCK}`;
  try {
    parse(next);
  } catch (error) {
    throw new Error('Safeword could not safely merge its Codex bootstrap configuration.', {
      cause: error,
    });
  }
  return next;
}

export function preparedCodexProjectBootstrap(cwd: string, baseContent?: string): string {
  const configPath = nodePath.join(cwd, CODEX_MIGRATION_SCHEMA.paths.config);
  let content = baseContent;
  if (content === undefined) {
    content =
      regularCodexConfigMetadata(configPath).kind === 'missing'
        ? ''
        : readFileSync(configPath, 'utf8');
  }
  return codexProjectBootstrapContent(content);
}

export function installCodexProjectBootstrap(cwd: string): boolean {
  const configPath = nodePath.join(cwd, CODEX_MIGRATION_SCHEMA.paths.config);
  const metadata = regularCodexConfigMetadata(configPath);
  const original = metadata.kind === 'missing' ? '' : readFileSync(configPath, 'utf8');
  const content = codexProjectBootstrapContent(original);
  if (content === original) return false;
  writeDurableFile(configPath, content, {
    mode: metadata.kind === 'regular' ? metadata.metadata.mode : 0o644,
  });
  return true;
}
