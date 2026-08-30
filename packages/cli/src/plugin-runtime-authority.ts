export interface RuntimeAuthorityAsset {
  readonly relativePath: string;
  readonly content: string;
}

const PROJECT_RUNTIME_PATHS = ['.safeword/hooks/', '.safeword/scripts/'] as const;
const COMMANDS = ['bun ', 'bash ', 'source ', './.safeword/'] as const;

function isProjectRuntimeCommand(line: string): boolean {
  return (
    PROJECT_RUNTIME_PATHS.some(path => line.includes(path)) &&
    COMMANDS.some(command => line.includes(command))
  );
}

/** Release invariant for native-plugin workflow catalogues. */
export function assertNativePluginRuntimeAuthority(assets: readonly RuntimeAuthorityAsset[]): void {
  const violations = assets
    .filter(asset => asset.content.split('\n').some(line => isProjectRuntimeCommand(line)))
    .map(asset => asset.relativePath);
  if (violations.length > 0) {
    throw new Error(
      `Native plugin assets reference project-local executable runtime: ${violations.join(', ')}`,
    );
  }
}
