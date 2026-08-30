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
  const commandLines = content.split(/\r?\n/u).map(line => line.replace(/^\s*[-*]\s+/u, ''));
  return PROJECT_RUNTIME_PATHS.some(
    path =>
      segmentInvokesPath(normalized, path, false) ||
      [...inlineCode, ...commandLines].some(segment => segmentInvokesPath(segment, path, true)),
  );
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
