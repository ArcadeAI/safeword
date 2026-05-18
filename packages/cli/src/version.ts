import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// The relative path is intentional and must stay at one `..` — version.ts is at
// src/ (depth 1 from packages/cli/), and tsup bundles it to dist/ (also depth 1),
// so `../package.json` resolves correctly in both contexts. Helpers nested under
// src/utils/ cannot read package.json directly without breaking once bundled —
// they should import the metadata from here instead.
const pkg = require('../package.json') as {
  version: string;
  peerDependencies?: Record<string, string>;
};

export const VERSION = pkg.version;
export const SAFEWORD_PEER_DEPENDENCIES = pkg.peerDependencies ?? {};
