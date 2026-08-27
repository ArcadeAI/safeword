import { createRequire } from 'node:module';

declare const __SAFEWORD_VERSION__: string | undefined;

const require = createRequire(import.meta.url);
// The relative path is intentional and must stay at one `..` — version.ts is at
// src/ (depth 1 from packages/cli/), and tsup bundles it to dist/ (also depth 1),
// so `../package.json` resolves correctly in both contexts. Helpers nested under
// src/utils/ cannot read package.json directly without breaking once bundled —
// they should import the metadata from here instead.
const builtVersion = typeof __SAFEWORD_VERSION__ === 'string' ? __SAFEWORD_VERSION__ : undefined;
const pkg =
  builtVersion === undefined
    ? (require('../package.json') as {
        version: string;
        peerDependencies?: Record<string, string>;
      })
    : { version: builtVersion };

export const VERSION = pkg.version;
export const SAFEWORD_PEER_DEPENDENCIES = pkg.peerDependencies ?? {};
