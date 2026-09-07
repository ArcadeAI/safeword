import { createHash } from 'node:crypto';

import type {
  LocalRetroProductionAttestation,
  LocalRetroReadinessManifest,
} from '../../src/retro/local-retro-readiness.js';
import { validateLocalRetroReadiness } from '../../src/retro/local-retro-readiness.js';

export interface LocalRetroProductionVerificationOptions {
  collectorCredential: string;
  collectorOrigin: string;
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
  return source?.harness === harness && source.hostClass === 'local' && source.repository === repo;
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

async function verifyHarness(
  harness: keyof LocalRetroReadinessManifest['harnesses'],
  manifest: LocalRetroReadinessManifest,
  lifecycle: unknown[],
  options: LocalRetroProductionVerificationOptions,
): Promise<boolean> {
  const evidence = manifest.harnesses[harness];
  if (lifecycle.every(item => !hasLifecycle(item, evidence))) return false;
  const envelope = await readJson(
    new URL(`/v1/public-retros/${evidence.collectorReceipt}`, options.collectorOrigin),
    options.collectorCredential,
    options.fetch,
  );
  if (!validEnvelope(envelope, harness, options.repository, evidence.sessionScope)) return false;
  const relayReceipt = record(
    await readJson(
      new URL(`/v1/retro-filings/${evidence.relayReceipt}`, options.relayOrigin),
      options.relayCredential,
      options.fetch,
    ),
  );
  if (
    relayReceipt?.receiptId !== evidence.relayReceipt ||
    relayReceipt.requestId !== evidence.requestId ||
    relayReceipt.state !== 'filed' ||
    !Number.isSafeInteger(relayReceipt.issueNumber)
  ) {
    return false;
  }
  const [owner, repo] = options.repository.split('/', 2);
  const issueNumber = String(relayReceipt.issueNumber);
  const issue = record(
    await readJson(
      new URL(`/repos/${owner}/${repo}/issues/${issueNumber}`, 'https://api.github.com'),
      options.githubToken,
      options.fetch,
    ),
  );
  if (typeof issue?.body !== 'string') return false;
  const rawLines = new Set(issue.body.split(/\r?\n/u));
  return expectedMarkers(evidence.requestId, envelope.findings, options).every(marker =>
    rawLines.has(marker),
  );
}

function manifestAncestry(manifest: LocalRetroReadinessManifest): {
  ancestor: string;
  descendant: string;
}[] {
  return [
    { ancestor: manifest.evidenceCommit, descendant: manifest.evidenceCommit },
    ...Object.values(manifest.harnesses).map(evidence => ({
      ancestor: evidence.buildCommit,
      descendant: manifest.evidenceCommit,
    })),
  ];
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

export async function verifyLocalRetroProductionReadiness(
  manifest: LocalRetroReadinessManifest,
  attestation: LocalRetroProductionAttestation,
  options: LocalRetroProductionVerificationOptions,
): Promise<boolean> {
  try {
    if (!faultAuthorityMatches(manifest, options.faultDigests)) return false;
    if (
      !validateLocalRetroReadiness(manifest, {
        ancestorPairs: manifestAncestry(manifest),
        buildCommit: manifest.evidenceCommit,
        now: options.now ?? new Date(),
        productionAttestation: attestation,
        relayReady: true,
      })
    ) {
      return false;
    }
    const lifecycleResponse = record(
      await readJson(
        new URL('/v1/private/retros', options.collectorOrigin),
        options.collectorCredential,
        options.fetch,
      ),
    );
    if (!Array.isArray(lifecycleResponse?.retros)) return false;
    for (const harness of ['claude-code', 'codex', 'cursor'] as const) {
      if (!(await verifyHarness(harness, manifest, lifecycleResponse.retros, options)))
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
