import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { defineConfig } from 'tsup';

const manifest = JSON.parse(
  readFileSync(new URL('src/retro/relay-readiness-manifest.json', import.meta.url), 'utf8'),
) as {
  enabled: boolean;
  evidenceCommit?: string;
  measurements?: Record<string, { path: string }>;
  prerequisites?: { mergedCommit: string }[];
};

function gitText(arguments_: string[]): string {
  return execFileSync('git', arguments_, { encoding: 'utf8' }).trim();
}

let buildCommit = 'development-source';
try {
  buildCommit = gitText(['rev-parse', 'HEAD']);
} catch {
  // Source archives build fail-closed with no relay attestation.
}

function buildRelayAttestation(): {
  ancestorPairs: string[];
  artifactHashes: Record<string, string>;
  buildCommit: string;
  enabled: boolean;
  manifestSha256: string;
} {
  const disabled = {
    ancestorPairs: [],
    artifactHashes: {},
    buildCommit,
    enabled: false,
    manifestSha256: createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),
  };
  if (!manifest.enabled) return disabled;
  if (
    !/^[\da-f]{40}$/u.test(buildCommit) ||
    manifest.evidenceCommit === undefined ||
    manifest.measurements === undefined ||
    manifest.prerequisites === undefined
  ) {
    throw new Error('enabled relay readiness manifest cannot be attested by this build');
  }
  if (gitText(['status', '--porcelain']).length > 0) {
    throw new Error('enabled relay readiness manifest requires a clean source tree');
  }
  const ancestorPairs = [
    `${manifest.evidenceCommit}:${buildCommit}`,
    ...manifest.prerequisites.map(
      prerequisite => `${prerequisite.mergedCommit}:${manifest.evidenceCommit}`,
    ),
  ];
  for (const pair of ancestorPairs) {
    const [ancestor, descendant] = pair.split(':', 2);
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor ?? '', descendant ?? '']);
  }
  const artifactHashes = Object.fromEntries(
    Object.values(manifest.measurements).map(artifact => {
      const bytes = execFileSync('git', ['show', `${manifest.evidenceCommit}:${artifact.path}`]);
      return [
        `${manifest.evidenceCommit}:${artifact.path}`,
        createHash('sha256').update(bytes).digest('hex'),
      ];
    }),
  );
  return { ...disabled, ancestorPairs, artifactHashes, enabled: true };
}

const relayBuildAttestation = buildRelayAttestation();

export default defineConfig({
  entry: ['src/cli.ts', 'src/index.ts', 'src/presets/typescript/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node18',
  shims: false,
  // Exclude devDependencies that have native bindings from bundling
  noExternal: [],
  skipNodeModulesBundle: true,
  define: {
    __SAFEWORD_BUILD_COMMIT__: JSON.stringify(buildCommit),
    __SAFEWORD_RELAY_BUILD_ATTESTATION__: JSON.stringify(relayBuildAttestation),
  },
});
