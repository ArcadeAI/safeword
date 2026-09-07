import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { verifyLocalRetroProductionReadiness } from '../../scripts/lib/local-retro-production-verifier.js';
import { verifyCheckedInLocalRetroProductionReadiness } from '../../scripts/verify-local-retro-production-readiness.js';
import type {
  LocalRetroProductionAttestation,
  LocalRetroReadinessManifest,
} from '../../src/retro/local-retro-readiness.js';
import { digestLocalRetroReadinessManifest } from '../../src/retro/local-retro-readiness.js';

const repo = 'ArcadeAI/safeword';
const tenantId = 'production';
const installationId = 12_345;
const harnesses = ['claude-code', 'codex', 'cursor'] as const;

function encodeFields(fields: string[]): Buffer {
  return Buffer.concat(
    fields.flatMap(field => {
      const bytes = Buffer.from(field);
      const length = Buffer.alloc(4);
      length.writeUInt32BE(bytes.length);
      return [length, bytes];
    }),
  );
}

function filingIdentity(requestIdentity: string, findings: string[]): string {
  return createHash('sha256')
    .update(requestIdentity)
    .update('\0')
    .update(findings.join('\0'))
    .digest('hex');
}

function requestMarker(requestIdentity: string): string {
  const digest = createHash('sha256')
    .update(
      encodeFields(['1', tenantId, String(installationId), repo.toLowerCase(), requestIdentity]),
    )
    .digest('hex');
  return `<!-- safeword-retro-request-v1: ${digest} -->`;
}

function requestId(index: number): string {
  const digit = String(index + 1);
  return `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
}

const completeFaultDigests: LocalRetroReadinessManifest['recoveredFaults'] = {
  ambiguousCreateMatch: 'a'.repeat(64),
  ambiguousCreateNoMatch: 'b'.repeat(64),
  claimCrash: 'c'.repeat(64),
  retryExhaustion: 'd'.repeat(64),
  workerOutage: 'e'.repeat(64),
};

const manifest: LocalRetroReadinessManifest = {
  enabled: true,
  evidenceCommit: 'a'.repeat(40),
  harnesses: Object.fromEntries(
    harnesses.map((harness, index) => [
      harness,
      {
        artifactDigest: createHash('sha256').update(`artifact:${harness}`).digest('hex'),
        buildCommit: 'a'.repeat(40),
        collectorReceipt: requestId(index + 3),
        hostClass: 'local',
        relayReceipt: `relay-${harness}`,
        requestId: requestId(index),
        sessionScope: createHash('sha256').update(`session:${harness}`).digest('hex'),
        terminal: 'filed',
      },
    ]),
  ) as unknown as LocalRetroReadinessManifest['harnesses'],
  recoveredFaults: completeFaultDigests,
  reviewedAt: '2026-09-07T18:00:00.000Z',
  version: 1,
};

const attestation: LocalRetroProductionAttestation = {
  authority: 'retro-relay-production-v1',
  enabled: true,
  lifecycle: {
    'claude-code': 'claude-code-interactive',
    codex: 'codex-desktop',
    cursor: 'cursor-desktop',
  },
  manifestSha256: digestLocalRetroReadinessManifest(manifest),
  verifiedAt: '2026-09-07T18:30:00.000Z',
  version: 1,
};

const protectedHarnessEvidence = Object.fromEntries(
  harnesses.map(harness => [
    harness,
    {
      artifactDigest: manifest.harnesses[harness].artifactDigest,
      buildCommit: manifest.harnesses[harness].buildCommit,
      lifecycle: attestation.lifecycle[harness],
    },
  ]),
) as Parameters<typeof verifyLocalRetroProductionReadiness>[2]['harnessEvidence'];

function inputUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

type ProductionFault =
  | 'missing-lifecycle'
  | 'missing-raw-marker'
  | 'relay-request-mismatch'
  | 'repository-mismatch'
  | 'session-mismatch';

function harnessResponses(fault?: ProductionFault): Map<string, Response> {
  const responses = new Map<string, Response>();
  for (const harness of harnesses) {
    const evidence = manifest.harnesses[harness];
    const findings = [`${harness} production canary`];
    const sessionScope =
      fault === 'session-mismatch' && harness === 'cursor' ? 'f'.repeat(64) : evidence.sessionScope;
    responses.set(
      `/v1/public-retros/${evidence.collectorReceipt}`,
      Response.json({
        findings,
        sessionScope,
        source: {
          harness,
          hostClass: 'local',
          repository:
            fault === 'repository-mismatch' && harness === 'claude-code' ? 'someone/else' : repo,
        },
        version: 'v3',
      }),
    );
    const relayRequestId =
      fault === 'relay-request-mismatch' && harness === 'codex' ? requestId(0) : evidence.requestId;
    const issueNumber = 4000 + harnesses.indexOf(harness);
    responses.set(
      `/v1/retro-filings/${evidence.relayReceipt}`,
      Response.json({
        issueNumber,
        receiptId: evidence.relayReceipt,
        requestId: relayRequestId,
        state: 'filed',
      }),
    );
    const identity = filingIdentity(evidence.requestId, findings);
    const markers = [
      `<!-- safeword-retro-signature: retro:${identity} -->`,
      `<!-- safeword-retro-canonical: canonical:${identity} -->`,
      requestMarker(evidence.requestId),
    ];
    if (fault === 'missing-raw-marker' && harness === 'claude-code') markers.pop();
    responses.set(
      `/repos/ArcadeAI/safeword/issues/${issueNumber}`,
      Response.json({ body: [...findings, ...markers].join('\n') }),
    );
  }
  return responses;
}

function productionFetch(fault?: ProductionFault): typeof fetch {
  const responses = harnessResponses(fault);
  responses.set(
    '/v1/private/retros',
    Response.json({
      retros: harnesses
        .filter(harness => fault !== 'missing-lifecycle' || harness !== 'claude-code')
        .map(harness => ({
          receipt: manifest.harnesses[harness].collectorReceipt,
          requestId: manifest.harnesses[harness].requestId,
          state: 'completed',
        })),
    }),
  );
  return vi.fn<typeof fetch>(input => {
    const response = responses.get(new URL(inputUrl(input)).pathname);
    return Promise.resolve(response ?? Response.json({ error: 'not_found' }, { status: 404 }));
  });
}

describe('local retro production verifier', () => {
  function verify(
    fetchImplementation: typeof fetch,
    harnessEvidence = protectedHarnessEvidence,
  ): Promise<boolean> {
    return verifyLocalRetroProductionReadiness(manifest, attestation, {
      buildCommit: manifest.evidenceCommit,
      collectorCredential: 'collector-secret',
      collectorOrigin: 'https://collector.example',
      faultDigests: completeFaultDigests,
      fetch: fetchImplementation,
      githubToken: 'github-token',
      harnessEvidence,
      installationId,
      isAncestor: () => Promise.resolve(true),
      now: new Date('2026-09-07T19:00:00.000Z'),
      relayCredential: 'relay-secret',
      relayOrigin: 'https://relay.example',
      repository: repo,
      tenantId,
    });
  }

  it('correlates each harness through collector, relay, and exact raw GitHub evidence', async () => {
    await expect(
      verifyCheckedInLocalRetroProductionReadiness(
        {
          GITHUB_TOKEN: 'github-token',
          SAFEWORD_RETRO_COLLECTOR_OPERATOR_CREDENTIAL: 'collector-secret',
          SAFEWORD_RETRO_COLLECTOR_ORIGIN: 'https://collector.example',
          SAFEWORD_RETRO_FAULT_DIGESTS_JSON: JSON.stringify(completeFaultDigests),
          SAFEWORD_RETRO_HARNESS_EVIDENCE_JSON: JSON.stringify(protectedHarnessEvidence),
          SAFEWORD_RETRO_RELAY_INSTALLATION_ID: String(installationId),
          SAFEWORD_RETRO_RELAY_OPERATOR_CREDENTIAL: 'relay-secret',
          SAFEWORD_RETRO_RELAY_ORIGIN: 'https://relay.example',
          SAFEWORD_RETRO_RELAY_REPOSITORY: repo,
          SAFEWORD_RETRO_RELAY_TENANT_ID: tenantId,
        },
        productionFetch(),
        {
          attestation,
          git: {
            buildCommit: () => manifest.evidenceCommit,
            isAncestor: () => Promise.resolve(true),
          },
          manifest,
        },
      ),
    ).resolves.toBe(true);
  });

  it.each([
    'missing-lifecycle',
    'missing-raw-marker',
    'relay-request-mismatch',
    'repository-mismatch',
    'session-mismatch',
  ] as const)('fails closed for %s evidence', async fault => {
    await expect(verify(productionFetch(fault))).resolves.toBe(false);
  });

  it('rejects fault digests that are not independently held by production', async () => {
    const faultDigests = { ...completeFaultDigests, workerOutage: 'f'.repeat(64) };

    await expect(
      verifyLocalRetroProductionReadiness(manifest, attestation, {
        buildCommit: manifest.evidenceCommit,
        collectorCredential: 'collector-secret',
        collectorOrigin: 'https://collector.example',
        faultDigests,
        fetch: productionFetch(),
        githubToken: 'github-token',
        harnessEvidence: protectedHarnessEvidence,
        installationId,
        isAncestor: () => Promise.resolve(true),
        now: new Date('2026-09-07T19:00:00.000Z'),
        relayCredential: 'relay-secret',
        relayOrigin: 'https://relay.example',
        repository: repo,
        tenantId,
      }),
    ).resolves.toBe(false);
  });

  it('rejects harness evidence that is not independently held by production', async () => {
    const harnessEvidence = {
      ...protectedHarnessEvidence,
      cursor: { ...protectedHarnessEvidence.cursor, lifecycle: 'socket-absent' },
    };

    await expect(verify(productionFetch(), harnessEvidence)).resolves.toBe(false);
  });

  it('rejects evidence outside the release commit ancestry', async () => {
    await expect(
      verifyLocalRetroProductionReadiness(manifest, attestation, {
        buildCommit: manifest.evidenceCommit,
        collectorCredential: 'collector-secret',
        collectorOrigin: 'https://collector.example',
        faultDigests: completeFaultDigests,
        fetch: productionFetch(),
        githubToken: 'github-token',
        harnessEvidence: protectedHarnessEvidence,
        installationId,
        isAncestor: () => Promise.resolve(false),
        now: new Date('2026-09-07T19:00:00.000Z'),
        relayCredential: 'relay-secret',
        relayOrigin: 'https://relay.example',
        repository: repo,
        tenantId,
      }),
    ).resolves.toBe(false);
  });
});
