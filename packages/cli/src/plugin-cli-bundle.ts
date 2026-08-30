const BUN_INSTALL_INSTANCE_PATH =
  /([/\\]node_modules[/\\]\.bun[/\\][^/\\\r\n]+)\+[0-9a-f]{16}([/\\]node_modules[/\\])/giu;

/**
 * Bun includes content-addressed install instance suffixes in bundle source comments.
 * They vary between otherwise equivalent installs, so remove them before sealing a
 * generated plugin catalogue.
 */
export function normalizePluginCliBundle(bundle: string): string {
  return bundle
    .replaceAll(BUN_INSTALL_INSTANCE_PATH, '$1$2')
    .split('\n')
    .map(line => (line.startsWith('// ') ? line.trimEnd() : line))
    .join('\n');
}
