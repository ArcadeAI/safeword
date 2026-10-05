const BUN_INSTALL_INSTANCE_PATH =
  /([/\\]node_modules[/\\]\.bun[/\\][^/\\\r\n]+?)\+[0-9a-f]{16}(?=[/\\]node_modules[/\\])/giu;

/** Normalize generated plugin JavaScript so equivalent installs produce identical bytes. */
export function normalizePluginBundle(bundle: string): string {
  return bundle.replaceAll(BUN_INSTALL_INSTANCE_PATH, '$1');
}
