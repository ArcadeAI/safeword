/** Enforces packaged-runtime authority for native plugin workflow assets. */

export interface RuntimeAuthorityAsset {
  readonly relativePath: string;
  readonly content: string;
}

const UNAVAILABLE_NATIVE_PROJECT_PATHS = [
  '.safeword/hooks/',
  '.safeword/scripts/',
  '.safeword/guides/',
  '.safeword/skills/',
  '.safeword/templates/',
  '.claude/skills/',
] as const;
const CROSS_HOST_RUNTIME_MARKERS = [
  'CLAUDE_PLUGIN_ROOT',
  'CODEX_HOME',
  'OPENCODE_CONFIG_DIR',
  '.claude/',
  '.codex/',
  '.opencode/',
] as const;

function isCrossHostRuntimeCommand(content: string): boolean {
  // The shared retro/audit guidance reads transcript data and project guidance
  // from other hosts. Exempt only those complete documented data expressions,
  // not prefixes that could also hide executables or parent traversal.
  const dataReferences = [
    '`.claude/CLAUDE.md`',
    '`~/.claude/projects/<encoded-cwd>/$CLAUDE_SESSION_ID.jsonl`',
    '~/.claude/projects/"${PWD//[^a-zA-Z0-9]/-}"/*.jsonl',
    '`${CODEX_HOME:-$HOME/.codex}/sessions/YYYY/MM/DD/rollout-<timestamp>-<id>.jsonl`',
    '"${CODEX_HOME:-$HOME/.codex}/sessions"',
  ];
  let runtimeReferences = content;
  for (const reference of dataReferences)
    runtimeReferences = runtimeReferences.replaceAll(reference, '');
  return CROSS_HOST_RUNTIME_MARKERS.some(marker => runtimeReferences.includes(marker));
}

/** Release invariant for native-plugin workflow catalogues. */
export function assertNativePluginRuntimeAuthority(assets: readonly RuntimeAuthorityAsset[]): void {
  const violations = assets
    .filter(asset => UNAVAILABLE_NATIVE_PROJECT_PATHS.some(path => asset.content.includes(path)))
    .map(asset => asset.relativePath);
  if (violations.length > 0) {
    throw new Error(
      `Native plugin assets reference project-local executable runtime: ${violations.join(', ')}`,
    );
  }
}

/** Release invariant for Cursor's project-delivered workflow catalogue. */
export function assertCursorRuntimeAuthority(assets: readonly RuntimeAuthorityAsset[]): void {
  const violations = assets
    .filter(asset => isCrossHostRuntimeCommand(asset.content))
    .map(asset => asset.relativePath);
  if (violations.length > 0) {
    throw new Error(
      `Cursor assets reference cross-host executable runtime: ${violations.join(', ')}`,
    );
  }
}
