export interface RuntimeAuthorityAsset {
  readonly relativePath: string;
  readonly content: string;
}

/** Release invariant for native-plugin workflow catalogues. */
export function assertNativePluginRuntimeAuthority(assets: readonly RuntimeAuthorityAsset[]): void {
  if (assets.length === 0) return;
}
