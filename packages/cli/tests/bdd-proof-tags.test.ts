import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');
const WORKSPACE_DIRECTORIES = ['packages', 'apps', 'libs', 'modules'] as const;
function featureFilesUnder(relativeDirectory: string): string[] {
  const absoluteDirectory = nodePath.join(REPO_ROOT, relativeDirectory);
  if (!existsSync(absoluteDirectory)) return [];

  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = nodePath.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return featureFilesUnder(relativePath);
    return entry.isFile() && entry.name.endsWith('.feature') ? [relativePath] : [];
  });
}

function configuredFeatureFiles(): string[] {
  const workspaceFeatures = WORKSPACE_DIRECTORIES.flatMap(workspaceDirectory => {
    const absoluteDirectory = nodePath.join(REPO_ROOT, workspaceDirectory);
    if (!existsSync(absoluteDirectory)) return [];

    return readdirSync(absoluteDirectory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .flatMap(entry =>
        featureFilesUnder(nodePath.join(workspaceDirectory, entry.name, 'features')),
      );
  });

  return [...featureFilesUnder('features'), ...workspaceFeatures];
}

const VITEST_PROVEN_FEATURES = [
  [
    'packages/cli/features/durable-independent-review.feature',
    'packages/cli/tests/review/job.test.ts',
  ],
  [
    'features/architecture-narrative-blindspots.feature',
    'packages/cli/tests/hooks/architecture-document-nudge.test.ts',
  ],
  [
    'features/audit-domain-docs-freshness.feature',
    'packages/cli/tests/skills/audit-domain-documentation.test.ts',
  ],
  [
    'features/bash-ledger-write-gate.feature',
    'packages/cli/tests/integration/bash-ledger-write-gate.test.ts',
  ],
  [
    'features/close-completed-sessions-safely.feature',
    'packages/cli/tests/closeout-cleanup.test.ts',
  ],
  [
    'features/closeout-preview-apply-convergence.feature',
    'packages/cli/tests/closeout-cleanup.test.ts',
  ],
  [
    'features/feature-ticket-readiness.feature',
    'packages/cli/tests/hooks/feature-ticket-readiness.test.ts',
  ],
  ['features/honor-host-toolchains.feature', 'packages/cli/tests/hooks/host-toolchain.test.ts'],
  ['features/phase-work-log-stamp.feature', 'packages/cli/tests/hooks/phase-provenance.test.ts'],
  [
    'features/pm-grade-intake-readiness-gate.feature',
    'packages/cli/tests/hooks/readiness-pointer.test.ts',
  ],
  [
    'features/operate-retry-safe-retro-relay.feature',
    'packages/cli/tests/retro/relay-delivery.test.ts',
  ],
  ['features/portable-tracker-transport.feature', 'packages/cli/tests/tracker-sync/plan.test.ts'],
  [
    'features/prevent-public-cli-contract-drift.feature',
    'packages/cli/tests/cli-protocol/cli-contract.test.ts',
  ],
  ['features/sync-tracker.feature', 'packages/cli/tests/tracker-sync/wiring.test.ts'],
  ['features/ticket-deps-schema.feature', 'packages/cli/tests/integration/blocked-on-gate.test.ts'],
  ['features/tracker-connect-flow.feature', 'packages/cli/tests/tracker-connect/connect.test.ts'],
  [
    'features/tracker-identity-and-join.feature',
    'packages/cli/tests/tracker-sync/resolve-by-key.test.ts',
  ],
  [
    'features/whole-ticket-quality-refactor.feature',
    'packages/cli/tests/integration/whole-ticket-quality-refactor.test.ts',
  ],
] as const;

interface ScenarioProofManifest {
  feature: string;
  scenarios: Record<string, [string, string]>;
}

function scenarioNames(featurePath: string): string[] {
  return readFileSync(nodePath.join(REPO_ROOT, featurePath), 'utf8')
    .split('\n')
    .flatMap(line => {
      const trimmed = line.trim();
      let prefix: string | undefined;
      if (trimmed.startsWith('Scenario Outline: ')) prefix = 'Scenario Outline: ';
      else if (trimmed.startsWith('Scenario: ')) prefix = 'Scenario: ';
      return prefix ? [trimmed.slice(prefix.length)] : [];
    });
}

describe('BDD proof provenance', () => {
  it('keeps the proof manifest complete', () => {
    const taggedFeatures = configuredFeatureFiles()
      .filter(featurePath =>
        readFileSync(nodePath.join(REPO_ROOT, featurePath), 'utf8').includes('@proof.vitest'),
      )
      .toSorted((left, right) => left.localeCompare(right));

    const manifestFeatures = VITEST_PROVEN_FEATURES.map(([featurePath]) => featurePath).toSorted(
      (left, right) => left.localeCompare(right),
    );
    expect(taggedFeatures).toEqual(manifestFeatures);
  });

  it.each(VITEST_PROVEN_FEATURES)(
    '%s names existing Vitest proof without claiming WIP',
    (featurePath, proofPath) => {
      const source = readFileSync(nodePath.join(REPO_ROOT, featurePath), 'utf8');

      expect(source).toMatch(/@proof\.vitest/u);
      expect(source).not.toMatch(/@wip/u);
      expect(source).toContain(proofPath);
      expect(() => readFileSync(nodePath.join(REPO_ROOT, proofPath), 'utf8')).not.toThrow();
    },
  );

  it('loads the production step wiring and validates every retry-safe relay proof registration', () => {
    const result = spawnSync(
      'bunx',
      [
        'cucumber-js',
        '--config',
        'packages/cli/tests/fixtures/retry-safe-relay-cucumber.mjs',
        '--dry-run',
        '--tags',
        '@operate-retry-safe-retro-relay',
        'features/operate-retry-safe-retro-relay.feature',
      ],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '--import tsx' },
      },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
  });

  it('maps every closeout convergence scenario to a named executable proof', () => {
    const manifestPath = nodePath.join(
      REPO_ROOT,
      '.project/tickets/TFG4CR-closeout-preview-apply-convergence/bdd-proof.json',
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ScenarioProofManifest;
    expect(
      Object.keys(manifest.scenarios).toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(scenarioNames(manifest.feature).toSorted((left, right) => left.localeCompare(right)));

    for (const [scenario, [proofPath, testName]] of Object.entries(manifest.scenarios)) {
      const proof = readFileSync(nodePath.join(REPO_ROOT, proofPath), 'utf8');
      expect(proof, `${scenario} -> ${proofPath} must name ${testName}`).toContain(testName);
    }
  });
});
