import { createHash } from 'node:crypto';

import type {
  LocalRetroProductionAttestation,
  LocalRetroReadinessManifest,
} from '../../src/retro/local-retro-readiness.js';
import {
  isLocalRetroProductionAttestationFresh,
  validateLocalRetroReadiness,
} from '../../src/retro/local-retro-readiness.js';

export interface LocalRetroProductionVerificationOptions {
  collectorCredential: string;
  collectorOrigin: string;
  buildCommit: string;
  faultDigests: LocalRetroReadinessManifest['recoveredFaults'];
  fetch: typeof fetch;
  githubToken?: string;
  harnessEvidence: Record<
    keyof LocalRetroReadinessManifest['harnesses'],
    {
      artifactDigest: string;
      buildCommit: string;
      lifecycle: string;
    }
  >;
  installationId: number;
  isAncestor: (ancestor: string, descendant: string) => Promise<boolean>;
  relayCredential: string;
  relayOrigin: string;
  repository: string;
  tenantId: string;
  now?: Date;
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

async function readJson(
  url: URL,
  credential: string | undefined,
  transport: typeof fetch,
): Promise<unknown> {
  const response = await transport(url, {
    headers: {
      accept: 'application/vnd.github+json',
      ...(credential !== undefined && { authorization: `Bearer ${credential}` }),
    },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`production evidence read failed: ${response.status}`);
  return response.json();
}

function encodeFields(fields: string[]): Buffer {
  return Buffer.concat(
    fields.flatMap(field => {
      const bytes = Buffer.from(field, 'utf8');
      const length = Buffer.alloc(4);
      length.writeUInt32BE(bytes.length);
      return [length, bytes];
    }),
  );
}

function expectedMarkers(
  requestId: string,
  findings: string[],
  options: LocalRetroProductionVerificationOptions,
): string[] {
  const identity = createHash('sha256')
    .update(requestId)
    .update('\0')
    .update(findings.join('\0'))
    .digest('hex');
  const requestDigest = createHash('sha256')
    .update(
      encodeFields([
        '1',
        options.tenantId,
        String(options.installationId),
        options.repository.toLowerCase(),
        requestId,
      ]),
    )
    .digest('hex');
  return [
    `<!-- safeword-retro-signature: retro:${identity} -->`,
    `<!-- safeword-retro-canonical: canonical:${identity} -->`,
    `<!-- safeword-retro-request-v1: ${requestDigest} -->`,
  ];
}

function validSource(
  value: unknown,
  harness: keyof LocalRetroReadinessManifest['harnesses'],
  repo: string,
): boolean {
  const source = record(value);
  return (
    source?.harness === harness &&
    source.hostClass === 'local' &&
    typeof source.repository === 'string' &&
    source.repository.toLowerCase() === repo.toLowerCase()
  );
}

function validEnvelope(
  value: unknown,
  harness: keyof LocalRetroReadinessManifest['harnesses'],
  repo: string,
  sessionScope: string,
): value is JsonRecord & { findings: string[] } {
  const envelope = record(value);
  return (
    envelope?.version === 'v3' &&
    envelope.sessionScope === sessionScope &&
    Array.isArray(envelope.findings) &&
    envelope.findings.length > 0 &&
    envelope.findings.every(finding => typeof finding === 'string') &&
    validSource(envelope.source, harness, repo)
  );
}

function hasLifecycle(
  value: unknown,
  evidence: LocalRetroReadinessManifest['harnesses'][keyof LocalRetroReadinessManifest['harnesses']],
): boolean {
  const lifecycle = record(value);
  return (
    lifecycle?.requestId === evidence.requestId &&
    lifecycle.receipt === evidence.collectorReceipt &&
    lifecycle.state === 'completed'
  );
}

function validRelayReceipt(
  receipt: JsonRecord | undefined,
  evidence: LocalRetroReadinessManifest['harnesses'][keyof LocalRetroReadinessManifest['harnesses']],
): receipt is JsonRecord & { issueNumber: number } {
  return (
    receipt?.receiptId === evidence.relayReceipt &&
    receipt.requestId === evidence.requestId &&
    receipt.state === 'filed' &&
    Number.isSafeInteger(receipt.issueNumber)
  );
}

function githubIssueUrl(repo: string, issueNumber: number): URL {
  const [owner = '', name = ''] = repo.split('/', 2);
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/${String(issueNumber)}`;
  return new URL(path, 'https://api.github.com');
}

async function verifyHarness(
  harness: keyof LocalRetroReadinessManifest['harnesses'],
  manifest: LocalRetroReadinessManifest,
  lifecycle: unknown[],
  options: LocalRetroProductionVerificationOptions,
): Promise<boolean> {
  const evidence = manifest.harnesses[harness];
  if (lifecycle.every(item => !hasLifecycle(item, evidence))) return false;
  const collectorPath = `/v1/public-retros/${encodeURIComponent(evidence.collectorReceipt)}`;
  const envelope = await readJson(
    new URL(collectorPath, options.collectorOrigin),
    options.collectorCredential,
    options.fetch,
  );
  if (!validEnvelope(envelope, harness, options.repository, evidence.sessionScope)) return false;
  const relayPath = `/v1/retro-filings/${encodeURIComponent(evidence.relayReceipt)}`;
  const relayReceipt = record(
    await readJson(new URL(relayPath, options.relayOrigin), options.relayCredential, options.fetch),
  );
  if (!validRelayReceipt(relayReceipt, evidence)) return false;
  const issueUrl = githubIssueUrl(options.repository, relayReceipt.issueNumber);
  const issue = record(await readJson(issueUrl, options.githubToken, options.fetch));
  if (typeof issue?.body !== 'string') return false;
  const rawLines = new Set(issue.body.split(/\r?\n/u));
  return expectedMarkers(evidence.requestId, envelope.findings, options).every(marker =>
    rawLines.has(marker),
  );
}

async function verifiedAncestry(
  manifest: LocalRetroReadinessManifest,
  options: LocalRetroProductionVerificationOptions,
): Promise<{ ancestor: string; descendant: string }[] | undefined> {
  const pairs = [
    { ancestor: manifest.evidenceCommit, descendant: options.buildCommit },
    ...Object.values(manifest.harnesses).map(evidence => ({
      ancestor: evidence.buildCommit,
      descendant: manifest.evidenceCommit,
    })),
  ];
  for (const pair of pairs) {
    if (!(await options.isAncestor(pair.ancestor, pair.descendant))) return undefined;
  }
  return pairs;
}

function faultAuthorityMatches(
  manifest: LocalRetroReadinessManifest,
  productionDigests: LocalRetroReadinessManifest['recoveredFaults'],
): boolean {
  const faults = Object.keys(manifest.recoveredFaults);
  return (
    Object.keys(productionDigests).length === faults.length &&
    faults.every(
      fault =>
        productionDigests[fault as keyof typeof productionDigests] ===
        manifest.recoveredFaults[fault as keyof typeof manifest.recoveredFaults],
    )
  );
}

function harnessAuthorityMatches(
  manifest: LocalRetroReadinessManifest,
  attestation: LocalRetroProductionAttestation,
  productionEvidence: LocalRetroProductionVerificationOptions['harnessEvidence'],
): boolean {
  const harnesses = ['claude-code', 'codex', 'cursor'] as const;
  return (
    Object.keys(productionEvidence).length === harnesses.length &&
    harnesses.every(harness => {
      const evidence = productionEvidence[harness];
      return (
        evidence.artifactDigest === manifest.harnesses[harness].artifactDigest &&
        evidence.buildCommit === manifest.harnesses[harness].buildCommit &&
        evidence.lifecycle === attestation.lifecycle[harness]
      );
    })
  );
}

function protectedAuthorityMatches(
  manifest: LocalRetroReadinessManifest,
  attestation: LocalRetroProductionAttestation,
  options: LocalRetroProductionVerificationOptions,
): boolean {
  return (
    faultAuthorityMatches(manifest, options.faultDigests) &&
    harnessAuthorityMatches(manifest, attestation, options.harnessEvidence) &&
    isLocalRetroProductionAttestationFresh(attestation, options.now ?? new Date())
  );
}

async function readLifecycle(options: LocalRetroProductionVerificationOptions): Promise<unknown[]> {
  const response = record(
    await readJson(
      new URL('/v1/private/retros', options.collectorOrigin),
      options.collectorCredential,
      options.fetch,
    ),
  );
  if (!Array.isArray(response?.retros)) throw new Error('collector lifecycle evidence is invalid');
  return response.retros;
}

export async function verifyLocalRetroProductionReadiness(
  manifest: LocalRetroReadinessManifest,
  attestation: LocalRetroProductionAttestation,
  options: LocalRetroProductionVerificationOptions,
): Promise<boolean> {
  try {
    if (!protectedAuthorityMatches(manifest, attestation, options)) return false;
    const ancestorPairs = await verifiedAncestry(manifest, options);
    if (ancestorPairs === undefined) return false;
    if (
      !validateLocalRetroReadiness(manifest, {
        ancestorPairs,
        buildCommit: options.buildCommit,
        productionAttestation: attestation,
        relayReady: true,
      })
    ) {
      return false;
    }
    const lifecycle = await readLifecycle(options);
    const results = await Promise.all(
      (['claude-code', 'codex', 'cursor'] as const).map(harness =>
        verifyHarness(harness, manifest, lifecycle, options),
      ),
    );
    return results.every(Boolean);
  } catch {
    return false;
  }
}
