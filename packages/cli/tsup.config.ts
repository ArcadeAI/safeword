import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { defineConfig } from 'tsup';

const manifestBytes = readFileSync(
  new URL('src/retro/relay-readiness-manifest.json', import.meta.url),
);
const manifest = JSON.parse(manifestBytes.toString('utf8')) as {
  enabled: boolean;
  evidenceCommit?: string;
  measurements?: Record<string, { path: string }>;
  prerequisites?: { mergedCommit: string }[];
};

function gitText(arguments_: string[]): string {
  return execFileSync('git', arguments_, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();
}

const COMMIT_PATTERN = /^[\da-f]{40}$/u;
const SAFE_ARTIFACT_PATH = /^(?!-)(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\r\n]+$/u;

function assertSafeRelayInputs(
  evidenceCommit: string,
  measurements: Record<string, { path: string }>,
  prerequisites: { mergedCommit: string }[],
): void {
  if (
    !COMMIT_PATTERN.test(evidenceCommit) ||
    prerequisites.some(item => !COMMIT_PATTERN.test(item.mergedCommit)) ||
    Object.values(measurements).some(item => !SAFE_ARTIFACT_PATH.test(item.path))
  ) {
    throw new Error('enabled relay readiness manifest contains an unsafe commit or artifact path');
  }
}

let buildCommit = 'development-source';
try {
  buildCommit = gitText(['rev-parse', 'HEAD']);
} catch {
  // Source archives build fail-closed with no relay attestation.
}

function buildRelayAttestation(): {
  ancestorPairs: { ancestor: string; descendant: string }[];
  artifacts: Record<string, { contentBase64: string; sha256: string }>;
  buildCommit: string;
  enabled: boolean;
  manifestBase64: string;
  manifestSha256: string;
} {
  const disabled = {
    ancestorPairs: [],
    artifacts: {},
    buildCommit,
    enabled: false,
    manifestBase64: manifestBytes.toString('base64'),
    manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
  };
  if (!manifest.enabled) return disabled;
  if (
    !COMMIT_PATTERN.test(buildCommit) ||
    manifest.evidenceCommit === undefined ||
    manifest.measurements === undefined ||
    manifest.prerequisites === undefined
  ) {
    throw new Error('enabled relay readiness manifest cannot be attested by this build');
  }
  const { evidenceCommit, measurements, prerequisites } = manifest;
  assertSafeRelayInputs(evidenceCommit, measurements, prerequisites);
  if (gitText(['status', '--porcelain']).length > 0) {
    throw new Error('enabled relay readiness manifest requires a clean source tree');
  }
  const ancestorPairs = [
    { ancestor: evidenceCommit, descendant: buildCommit },
    ...prerequisites.map(prerequisite => ({
      ancestor: prerequisite.mergedCommit,
      descendant: evidenceCommit,
    })),
  ];
  for (const { ancestor, descendant } of ancestorPairs) {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      maxBuffer: 10 * 1024 * 1024,
    });
  }
  const artifacts = Object.fromEntries(
    Object.entries(measurements).map(([metric, artifact]) => {
      const bytes = execFileSync('git', ['show', `${evidenceCommit}:${artifact.path}`], {
        maxBuffer: 10 * 1024 * 1024,
      });
      return [
        metric,
        {
          contentBase64: bytes.toString('base64'),
          sha256: createHash('sha256').update(bytes).digest('hex'),
        },
      ];
    }),
  );
  return { ...disabled, ancestorPairs, artifacts, enabled: true };
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
  // Recovery commands must still start when they are upgrading an older
  // dependency tree that predates our TOML parser dependency.
  noExternal: ['smol-toml'],
  skipNodeModulesBundle: true,
  define: {
    __SAFEWORD_BUILD_COMMIT__: JSON.stringify(buildCommit),
    __SAFEWORD_RELAY_BUILD_ATTESTATION__: JSON.stringify(relayBuildAttestation),
  },
});
