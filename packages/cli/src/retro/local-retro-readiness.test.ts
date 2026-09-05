import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  type LocalRetroReadinessManifest,
  validateLocalRetroReadiness,
} from './local-retro-readiness.js';

const evidenceCommit = 'a'.repeat(40);
const buildCommit = 'b'.repeat(40);
function harnessEvidence(harness: 'claude-code' | 'codex' | 'cursor', index: number) {
  const evidence = {
    buildCommit: evidenceCommit,
    collectorReceipt: `11111111-2222-4333-8444-55555555555${index}`,
    hostClass: 'local' as const,
    relayReceipt: `21111111-2222-4333-8444-55555555555${index}`,
    requestId: `31111111-2222-4333-8444-55555555555${index}`,
    sessionScope: String(index).repeat(64),
    terminal: 'filed' as const,
  };
  const artifactContent = [
    'local-retro-canary:v1',
    harness,
    evidence.buildCommit,
    evidence.requestId,
    evidence.sessionScope,
    evidence.collectorReceipt,
    evidence.relayReceipt,
    evidence.terminal,
  ].join('\0');
  const artifactDigest = createHash('sha256').update(artifactContent).digest('hex');
  return { ...evidence, artifactDigest, artifactPath: `evidence/${harness}.txt` };
}

function readinessFixture(): {
  input: Parameters<typeof validateLocalRetroReadiness>[1];
  manifest: LocalRetroReadinessManifest;
} {
  const faultEvidence = Object.fromEntries(
    [
      'ambiguousCreateMatch',
      'ambiguousCreateNoMatch',
      'claimCrash',
      'retryExhaustion',
      'workerOutage',
    ].map(name => [
      name,
      {
        artifactDigest: createHash('sha256').update(`fault:${name}`).digest('hex'),
        artifactPath: `evidence/${name}.txt`,
      },
    ]),
  ) as LocalRetroReadinessManifest['recoveredFaults'];
  const manifest: LocalRetroReadinessManifest = {
    enabled: true,
    evidenceCommit,
    harnesses: {
      'claude-code': harnessEvidence('claude-code', 1),
      codex: harnessEvidence('codex', 2),
      cursor: harnessEvidence('cursor', 3),
    },
    recoveredFaults: faultEvidence,
    reviewedAt: '2026-08-29T00:00:00.000Z',
    version: 1,
  };
  const artifacts = Object.fromEntries([
    ...Object.entries(manifest.harnesses).map(([harness, evidence]) => {
      const content = [
        'local-retro-canary:v1',
        harness,
        evidence.buildCommit,
        evidence.requestId,
        evidence.sessionScope,
        evidence.collectorReceipt,
        evidence.relayReceipt,
        evidence.terminal,
      ].join('\0');
      return [
        evidence.artifactPath,
        { contentBase64: Buffer.from(content).toString('base64'), sha256: evidence.artifactDigest },
      ];
    }),
    ...Object.entries(manifest.recoveredFaults).map(([name, evidence]) => [
      evidence.artifactPath,
      {
        contentBase64: Buffer.from(`fault:${name}`).toString('base64'),
        sha256: evidence.artifactDigest,
      },
    ]),
  ]);
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  return {
    manifest,
    input: {
      buildAttestation: {
        ancestorPairs: [{ ancestor: evidenceCommit, descendant: buildCommit }],
        artifacts,
        enabled: true,
        manifestBase64: manifestBytes.toString('base64'),
        manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
      },
      buildCommit,
      now: new Date('2026-08-29T01:00:00.000Z'),
      relayReady: true,
    },
  };
}

describe('local retro readiness', () => {
  it('accepts complete local harness and recovered-fault evidence on a ready relay', () => {
    const { input, manifest } = readinessFixture();

    expect(validateLocalRetroReadiness(manifest, input)).toBe(true);
  });

  it('accepts a running build at the reviewed evidence commit', () => {
    const { input, manifest } = readinessFixture();

    expect(
      validateLocalRetroReadiness(manifest, {
        ...input,
        buildAttestation: { ...input.buildAttestation, ancestorPairs: [] },
        buildCommit: evidenceCommit,
      }),
    ).toBe(true);
  });

  it.each(['managed', 'unknown'] as const)(
    'rejects Cursor evidence with %s host provenance',
    hostClass => {
      const { input, manifest } = readinessFixture();
      const malformed = {
        ...manifest,
        harnesses: {
          ...manifest.harnesses,
          cursor: { ...manifest.harnesses.cursor, hostClass },
        },
      } as never;

      expect(validateLocalRetroReadiness(malformed, input)).toBe(false);
    },
  );

  it('rejects a disabled manifest', () => {
    const { input } = readinessFixture();

    expect(validateLocalRetroReadiness({ enabled: false, version: 1 }, input)).toBe(false);
  });

  it('rejects manifest-controlled evidence that is absent from the build attestation', () => {
    const { input, manifest } = readinessFixture();

    expect(
      validateLocalRetroReadiness(manifest, {
        ...input,
        buildAttestation: { ...input.buildAttestation, artifacts: {} },
      }),
    ).toBe(false);
  });

  it('rejects missing harness evidence', () => {
    const { input, manifest } = readinessFixture();
    const malformed = {
      ...manifest,
      harnesses: { codex: manifest.harnesses.codex, cursor: manifest.harnesses.cursor },
    } as never;

    expect(validateLocalRetroReadiness(malformed, input)).toBe(false);
  });

  it('rejects harness evidence from a different build', () => {
    const { input, manifest } = readinessFixture();
    const mismatched = {
      ...manifest,
      harnesses: {
        ...manifest.harnesses,
        codex: { ...manifest.harnesses.codex, buildCommit: 'c'.repeat(40) },
      },
    };

    expect(validateLocalRetroReadiness(mismatched, input)).toBe(false);
  });

  it('rejects a canary identity reused across different harnesses', () => {
    const { input, manifest } = readinessFixture();
    const reused = {
      ...manifest,
      harnesses: {
        ...manifest.harnesses,
        codex: manifest.harnesses['claude-code'],
      },
    };

    expect(validateLocalRetroReadiness(reused, input)).toBe(false);
  });

  it.each(Object.keys(readinessFixture().manifest.recoveredFaults))(
    'rejects a missing or malformed %s recovery artifact',
    fault => {
      const { input, manifest } = readinessFixture();
      const recoveredFaults = {
        ...manifest.recoveredFaults,
        [fault]: { artifactDigest: 'missing', artifactPath: `evidence/${fault}.txt` },
      };

      expect(validateLocalRetroReadiness({ ...manifest, recoveredFaults }, input)).toBe(false);
    },
  );

  it('rejects a missing recovery artifact key', () => {
    const { input, manifest } = readinessFixture();
    const { workerOutage: _workerOutage, ...recoveredFaults } = manifest.recoveredFaults;

    expect(validateLocalRetroReadiness({ ...manifest, recoveredFaults } as never, input)).toBe(
      false,
    );
  });

  it('rejects a missing recovery artifact collection', () => {
    const { input, manifest } = readinessFixture();
    const { recoveredFaults: _recoveredFaults, ...withoutRecoveredFaults } = manifest;

    expect(validateLocalRetroReadiness(withoutRecoveredFaults as never, input)).toBe(false);
  });

  it.each([
    ['relay is not ready', { relayReady: false }],
    [
      'build ancestry is missing',
      { buildAttestation: { ...readinessFixture().input.buildAttestation, ancestorPairs: [] } },
    ],
    ['review evidence is stale', { now: new Date('2026-09-29T00:00:00.001Z') }],
    ['review evidence is future-dated', { now: new Date('2026-08-28T23:59:59.999Z') }],
  ] as const)('rejects when %s', (_case, override) => {
    const { input, manifest } = readinessFixture();

    expect(validateLocalRetroReadiness(manifest, { ...input, ...override })).toBe(false);
  });
});
