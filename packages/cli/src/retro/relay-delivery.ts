import { randomUUID } from 'node:crypto';
import {
  access,
  link,
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

export interface RelayDraftRequest {
  body: string;
  canonicalKey: string;
  installationId: number;
  labels: string[];
  legacySignature: string;
  repository: string;
  requestId: string;
  title: string;
}

export interface RelayClaim {
  bytes: Buffer;
  path: string;
  requestId: string;
}

export interface RelayReceipt {
  issueNumber?: number;
  receiptId: string;
  requestId: string;
  state: string;
}

export function createRelayRequest(
  input: Omit<RelayDraftRequest, 'requestId'>,
  dependencies?: { randomUUID: () => string },
): RelayDraftRequest {
  return { requestId: (dependencies?.randomUUID ?? randomUUID)(), ...input };
}

function relayDirectory(projectDirectory: string): string {
  return path.join(projectDirectory, '.safeword', 'retro-drafts', 'relay');
}

function primaryPath(projectDirectory: string, requestId: string): string {
  return path.join(relayDirectory(projectDirectory), `${requestId}.json`);
}

function ackPath(projectDirectory: string, requestId: string): string {
  return path.join(relayDirectory(projectDirectory), `${requestId}.ack.json`);
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function removeIfPresent(file: string): Promise<void> {
  try {
    await unlink(file);
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }
}

async function sortedFilenames(directory: string): Promise<string[]> {
  const filenames = await readdir(directory);
  return filenames.toSorted((left, right) => left.localeCompare(right));
}

async function writeAtomic(file: string, bytes: Buffer): Promise<boolean> {
  const temporary = `${file}.tmp.${randomUUID()}`;
  await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
  try {
    await link(temporary, file);
    return true;
  } catch (error) {
    if (errorCode(error) !== 'EEXIST') throw error;
    return false;
  } finally {
    await removeIfPresent(temporary);
  }
}

function parseClaim(
  filename: string,
): { claimId: string; expiresAt: number; requestId: string } | undefined {
  const match = /^([0-9a-f-]+)\.claim\.([\w-]+)\.(\d+)\.json$/u.exec(filename);
  if (match === null) return undefined;
  const [, requestId, claimId, expiresAt] = match;
  if (requestId === undefined || claimId === undefined || expiresAt === undefined) {
    return undefined;
  }
  return { claimId, expiresAt: Number(expiresAt), requestId };
}

function parsePrimary(filename: string): string | undefined {
  return /^([0-9a-f-]+)\.json$/u.exec(filename)?.[1];
}

export async function persistRelayRequest(
  projectDirectory: string,
  request: RelayDraftRequest,
): Promise<{ bytes: Buffer; path: string }> {
  const directory = relayDirectory(projectDirectory);
  await mkdir(directory, { recursive: true });
  const bytes = Buffer.from(JSON.stringify(request), 'utf8');
  const file = primaryPath(projectDirectory, request.requestId);
  if (!(await writeAtomic(file, bytes))) {
    const existing = await readFile(file);
    if (!existing.equals(bytes)) {
      throw new Error('relay request identity was reused with a different payload');
    }
  }
  return { bytes, path: file };
}

export async function persistRelayDraft(
  projectDirectory: string,
  draft: Omit<RelayDraftRequest, 'requestId'>,
): Promise<RelayDraftRequest> {
  const candidates = await listRelayRequests(projectDirectory);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.bytes.toString('utf8')) as RelayDraftRequest;
      const persistedDraft: Omit<RelayDraftRequest, 'requestId'> = {
        body: parsed.body,
        canonicalKey: parsed.canonicalKey,
        installationId: parsed.installationId,
        labels: parsed.labels,
        legacySignature: parsed.legacySignature,
        repository: parsed.repository,
        title: parsed.title,
      };
      if (JSON.stringify(persistedDraft) === JSON.stringify(draft)) return parsed;
    } catch {
      // An unreadable immutable file is left visible for operator recovery and
      // cannot authorize replacement or acknowledgement.
    }
  }
  const request = createRelayRequest(draft);
  await persistRelayRequest(projectDirectory, request);
  return request;
}

// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Filesystem CAS branches are the claim state machine.
export async function claimRelayRequest(
  projectDirectory: string,
  options: { claimId: string; excludeRequestIds?: Set<string>; leaseMs: number; now: number },
): Promise<RelayClaim | undefined> {
  await recoverRelaySpool(projectDirectory, options.now);
  const directory = relayDirectory(projectDirectory);
  await mkdir(directory, { recursive: true });
  let filenames = await sortedFilenames(directory);

  for (const filename of filenames) {
    const parsed = parseClaim(filename);
    if (
      parsed === undefined ||
      parsed.expiresAt > options.now ||
      options.excludeRequestIds?.has(parsed.requestId) === true
    ) {
      continue;
    }
    try {
      await rename(path.join(directory, filename), primaryPath(projectDirectory, parsed.requestId));
    } catch (error) {
      if (!['ENOENT', 'EEXIST'].includes(errorCode(error) ?? '')) throw error;
    }
  }

  filenames = await sortedFilenames(directory);
  for (const filename of filenames) {
    const requestId = parsePrimary(filename);
    if (
      requestId === undefined ||
      options.excludeRequestIds?.has(requestId) === true ||
      (await exists(ackPath(projectDirectory, requestId)))
    ) {
      continue;
    }
    const claimed = path.join(
      directory,
      `${requestId}.claim.${options.claimId}.${options.now + options.leaseMs}.json`,
    );
    try {
      await rename(path.join(directory, filename), claimed);
      return { bytes: await readFile(claimed), path: claimed, requestId };
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
    }
  }
  return undefined;
}

export async function acknowledgeRelayClaim(
  claim: RelayClaim,
  receipt: RelayReceipt,
  options: { faultAfterAck?: () => Promise<void> } = {},
): Promise<boolean> {
  if (receipt.requestId !== claim.requestId || !(await exists(claim.path))) return false;
  const projectDirectory = path.resolve(path.dirname(claim.path), '..', '..', '..');
  const durableAck = ackPath(projectDirectory, claim.requestId);
  const written = await writeAtomic(durableAck, Buffer.from(JSON.stringify(receipt), 'utf8'));
  if (!written) {
    const current = JSON.parse(await readFile(durableAck, 'utf8')) as RelayReceipt;
    if (current.requestId !== receipt.requestId || current.receiptId !== receipt.receiptId) {
      throw new Error('relay acknowledgement conflicts with the durable receipt');
    }
  }
  await options.faultAfterAck?.();
  await removeIfPresent(claim.path);
  return true;
}

export async function recoverRelaySpool(projectDirectory: string, _now: number): Promise<void> {
  const directory = relayDirectory(projectDirectory);
  await mkdir(directory, { recursive: true });
  const filenames = await readdir(directory);
  const acknowledged = new Set(
    filenames
      .map(filename => /^([0-9a-f-]+)\.ack\.json$/u.exec(filename)?.[1])
      .filter((requestId): requestId is string => requestId !== undefined),
  );
  await Promise.all(
    filenames.map(async filename => {
      const requestId = parsePrimary(filename) ?? parseClaim(filename)?.requestId;
      if (requestId === undefined || !acknowledged.has(requestId)) return;
      await removeIfPresent(path.join(directory, filename));
    }),
  );
}

export async function listRelayRequests(
  projectDirectory: string,
): Promise<{ bytes: Buffer; requestId: string }[]> {
  await recoverRelaySpool(projectDirectory, Date.now());
  const directory = relayDirectory(projectDirectory);
  const requests: { bytes: Buffer; requestId: string }[] = [];
  const filenames = await sortedFilenames(directory);
  for (const filename of filenames) {
    const requestId = parsePrimary(filename) ?? parseClaim(filename)?.requestId;
    if (requestId === undefined) continue;
    requests.push({ bytes: await readFile(path.join(directory, filename)), requestId });
  }
  return requests;
}

async function rearmClaim(projectDirectory: string, claim: RelayClaim): Promise<void> {
  if (await exists(ackPath(projectDirectory, claim.requestId))) return;
  try {
    await rename(claim.path, primaryPath(projectDirectory, claim.requestId));
  } catch (error) {
    if (!['ENOENT', 'EEXIST'].includes(errorCode(error) ?? '')) throw error;
  }
}

export async function deliverRelayRequests(
  projectDirectory: string,
  options: {
    credential: string;
    deadlineMs: number;
    fetch: typeof fetch;
    nativeFallback: () => unknown;
    now: () => number;
    relayUrl: string;
  },
): Promise<{ accepted: number; retryable: number }> {
  const initial = await listRelayRequests(projectDirectory);
  const processed = new Set<string>();
  let accepted = 0;
  let retryable = 0;
  for (const request of initial) {
    if (processed.has(request.requestId)) continue;
    const claim = await claimRelayRequest(projectDirectory, {
      claimId: randomUUID(),
      excludeRequestIds: processed,
      leaseMs: Math.max(options.deadlineMs * 2, 1000),
      now: options.now(),
    });
    if (claim === undefined) break;
    processed.add(claim.requestId);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, options.deadlineMs);
    timer.unref();
    try {
      const response = await options.fetch(`${options.relayUrl}/v1/retro-filings`, {
        body: claim.bytes,
        headers: {
          authorization: `Bearer ${options.credential}`,
          'content-type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      });
      const body = (await response.json()) as RelayReceipt;
      if (
        !response.ok ||
        body.requestId !== claim.requestId ||
        typeof body.receiptId !== 'string'
      ) {
        throw new Error('relay returned an invalid durable receipt');
      }
      if (await acknowledgeRelayClaim(claim, body)) accepted += 1;
      else retryable += 1;
    } catch {
      retryable += 1;
      await rearmClaim(projectDirectory, claim);
    } finally {
      clearTimeout(timer);
    }
  }
  return { accepted, retryable };
}
