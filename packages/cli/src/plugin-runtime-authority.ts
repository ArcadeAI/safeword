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
const EXECUTABLE_RUNNERS = new Set(['bun', 'node', 'bash', 'sh', 'source', 'exec']);
const CROSS_HOST_RUNTIME_MARKERS = [
  'CLAUDE_PLUGIN_ROOT',
  'CODEX_HOME',
  'OPENCODE_CONFIG_DIR',
  '.claude/',
  '.codex/',
  '.opencode/',
] as const;

function isCrossHostRuntimeCommand(content: string): boolean {
  const segments = content
    .replaceAll(/\\\r?\n\s*/gu, ' ')
    .split(/\r?\n/u)
    .map(line => line.replaceAll('`', ''));
  return segments.some(segment => {
    const tokens = segment.trim().split(/\s+/u);
    return (
      tokens.some(token => EXECUTABLE_RUNNERS.has(token)) &&
      CROSS_HOST_RUNTIME_MARKERS.some(marker => segment.includes(marker))
    );
  });
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
