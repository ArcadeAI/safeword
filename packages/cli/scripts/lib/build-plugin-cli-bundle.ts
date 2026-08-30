import nodePath from 'node:path';

import { normalizePluginCliBundle } from '../../src/plugin-cli-bundle.js';
import { requirePinnedBunVersion } from '../bun-version.js';

export async function buildPluginCliBundle(
  packageRoot: string,
  packageManager: string,
  pluginName: string,
): Promise<string> {
  // @ts-expect-error -- plugin generators execute under Bun; the CLI's
  // Node-targeted tsconfig intentionally does not expose Bun globals elsewhere.
  requirePinnedBunVersion(packageManager, Bun.version);

  // @ts-expect-error -- plugin generators execute under Bun.
  const result = await Bun.build({
    entrypoints: [nodePath.join(packageRoot, 'src', 'cli.ts')],
    format: 'esm',
    packages: 'bundle',
    splitting: false,
    target: 'bun',
    write: false,
  });
  if (!result.success || result.outputs.length !== 1 || result.outputs[0] === undefined) {
    throw new Error(`Failed to bundle the ${pluginName} plugin CLI: ${result.logs.join('\n')}`);
  }
  return normalizePluginCliBundle(await result.outputs[0].text());
}
