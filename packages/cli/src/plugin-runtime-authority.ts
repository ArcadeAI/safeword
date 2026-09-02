/** Enforces packaged-runtime authority for native plugin workflow assets. */

export interface RuntimeAuthorityAsset {
  readonly relativePath: string;
  readonly content: string;
}

const PROJECT_RUNTIME_PATHS = ['.safeword/hooks/', '.safeword/scripts/'] as const;
const UNAVAILABLE_NATIVE_PROJECT_PATHS = [
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

function quotedProjectPrefix(beforePath: string): boolean {
  const quoteIndex = Math.max(beforePath.lastIndexOf('"'), beforePath.lastIndexOf("'"));
  if (quoteIndex === -1) return false;
  const prefix = beforePath.slice(quoteIndex + 1);
  if (prefix === '') return true;
  const variable = prefix.startsWith('${') ? prefix.slice(2, -2) : prefix.slice(1, -1);
  return prefix.startsWith('$') && prefix.endsWith('/') && /^[A-Z_]+$/u.test(variable);
}

function segmentInvokesPath(segment: string, path: string, allowRunner: boolean): boolean {
  const pathIndex = segment.indexOf(path);
  if (pathIndex === -1) return false;
  const beforePath = segment.slice(0, pathIndex);
  return (
    beforePath.endsWith('./') ||
    quotedProjectPrefix(beforePath) ||
    (allowRunner &&
      beforePath
        .trim()
        .split(/\s+/u)
        .some(token => EXECUTABLE_RUNNERS.has(token)))
  );
}

function isProjectRuntimeCommand(content: string): boolean {
  const normalized = content.replaceAll(/\\\r?\n\s*/gu, ' ').replaceAll(/\s+/gu, ' ');
  const inlineCode = normalized
    .matchAll(/`([^`]+)`/gu)
    .map(match => match[1] ?? '')
    .toArray();
  // Fenced blocks can mispair the inline-code scan; line tokens must not retain backticks.
  const commandLines = content
    .split(/\r?\n/u)
    .map(line => line.replace(/^\s*[-*]\s+/u, '').replaceAll('`', ''));
  return PROJECT_RUNTIME_PATHS.some(
    path =>
      segmentInvokesPath(normalized, path, false) ||
      [...inlineCode, ...commandLines].some(segment => segmentInvokesPath(segment, path, true)),
  );
}

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
    .filter(
      asset =>
        isProjectRuntimeCommand(asset.content) ||
        UNAVAILABLE_NATIVE_PROJECT_PATHS.some(path => asset.content.includes(path)),
    )
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
