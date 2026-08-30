import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { PublicRetroConflict, PublicRetroQuotaExceeded, PublicRetroStore } from './store.js';

interface PublicRetroStorePort extends Pick<PublicRetroStore, 'accept' | 'close' | 'read'> {
  claim?: PublicRetroStore['claim'];
  complete?: PublicRetroStore['complete'];
  listLifecycle?: PublicRetroStore['listLifecycle'];
  readServerPayload?: PublicRetroStore['readServerPayload'];
  reject?: PublicRetroStore['reject'];
  release?: PublicRetroStore['release'];
}

const MAXIMUM_BODY_BYTES = 262_144;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SESSION_SCOPE = /^[0-9a-f]{64}$/u;
const V1_FIELDS = ['version', 'finding', 'source', 'sessionScope'] as const;
const V2_FIELDS = ['version', 'findings', 'source', 'sessionScope'] as const;
const REQUIRED_SOURCE_FIELDS = [
  'harness',
  'hostClass',
  'projectUUID',
  'safewordCliVersion',
] as const;
const OPTIONAL_SOURCE_FIELDS = [
  'repository',
  'agentVersion',
  'model',
  'safewordPluginVersion',
  'osFamily',
  'userIdentity',
] as const;
const SOURCE_FIELDS = new Set<string>([...REQUIRED_SOURCE_FIELDS, ...OPTIONAL_SOURCE_FIELDS]);
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const RELAY_AUTHORITY_MARKER = /<!--\s*safeword-retro-(?:canonical|request-v1|signature):/u;

export interface PublicRetroCollectorRuntime {
  url: string;
  close: () => Promise<void>;
}

export interface PublicRetroCollectorOptions {
  breakGlassCredential?: string;
  databasePath: string;
  collectorWorkerCredential?: string;
  host?: string;
  filingLimitPerHour?: number;
  intakeLimitPerMinute?: number;
  operatorCredential?: string;
  port?: number;
  projectFilingLimitPerHour?: number;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function validPublicRequest(request: IncomingMessage): boolean {
  return (
    request.method === 'POST' &&
    request.url === '/v1/public-retros' &&
    request.headers['content-type'] === 'application/json; charset=utf-8' &&
    request.headers.authorization === undefined &&
    request.headers.cookie === undefined &&
    request.headers['x-api-key'] === undefined
  );
}

function operatorReceipt(
  request: IncomingMessage,
  credential: string | undefined,
): string | undefined {
  if (request.method !== 'GET' || credential === undefined) return undefined;
  if (!matchesCredential(request.headers.authorization, credential)) return undefined;
  const match = /^\/v1\/public-retros\/([0-9a-f-]{36})$/u.exec(request.url ?? '');
  return match?.[1] !== undefined && UUID.test(match[1]) ? match[1] : undefined;
}

function matchesCredential(authorization: string | undefined, credential: string): boolean {
  if (authorization === undefined) return false;
  const actualBytes = Buffer.from(authorization);
  const expectedBytes = Buffer.from(`Bearer ${credential}`);
  return (
    actualBytes.byteLength === expectedBytes.byteLength &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

function serveOperatorRead(
  request: IncomingMessage,
  response: ServerResponse,
  store: PublicRetroStorePort,
  credential: string | undefined,
): boolean {
  const receipt = operatorReceipt(request, credential);
  if (receipt === undefined) return false;
  const record = store.read(receipt);
  if (record === undefined) {
    sendJson(response, 404, { error: 'not_found' });
    return true;
  }
  response.statusCode = 200;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-safeword-receipt', record.receipt);
  response.end(record.rawBody);
  return true;
}

function serveLiveness(request: IncomingMessage, response: ServerResponse): boolean {
  if (request.method !== 'GET' || request.url !== '/health') return false;
  sendJson(response, 200, { status: 'ok' });
  return true;
}

function serveReadRoute(
  request: IncomingMessage,
  response: ServerResponse,
  store: PublicRetroStorePort,
  operatorCredential: string | undefined,
): boolean {
  if (serveLiveness(request, response)) return true;
  return serveOperatorRead(request, response, store, operatorCredential);
}

function servePrivateInspection(
  request: IncomingMessage,
  response: ServerResponse,
  store: PublicRetroStorePort,
  operatorCredential: string | undefined,
  breakGlassCredential: string | undefined,
): boolean {
  if (request.method !== 'GET') return false;
  if (request.url === '/v1/private/retros')
    return serveLifecycleInspection(request, response, store, operatorCredential);
  const requestId = /^\/v1\/private\/retros\/([0-9a-f-]{36})\/payload$/u.exec(
    request.url ?? '',
  )?.[1];
  if (requestId === undefined) return false;
  return servePayloadInspection(request, response, store, breakGlassCredential, requestId);
}

function serveLifecycleInspection(
  request: IncomingMessage,
  response: ServerResponse,
  store: PublicRetroStorePort,
  credential: string | undefined,
): true {
  if (
    credential === undefined ||
    !matchesCredential(request.headers.authorization, credential) ||
    store.listLifecycle === undefined
  ) {
    sendJson(response, 404, { error: 'not_found' });
    return true;
  }
  sendJson(response, 200, { retros: store.listLifecycle() });
  return true;
}

function servePayloadInspection(
  request: IncomingMessage,
  response: ServerResponse,
  store: PublicRetroStorePort,
  credential: string | undefined,
  requestId: string,
): true {
  if (
    credential === undefined ||
    !matchesCredential(request.headers.authorization, credential) ||
    store.readServerPayload === undefined
  ) {
    sendJson(response, 404, { error: 'not_found' });
    return true;
  }
  const payload = store.readServerPayload(requestId, 'break-glass');
  if (payload === undefined) sendJson(response, 404, { error: 'not_found' });
  else {
    response.statusCode = 200;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('x-content-type-options', 'nosniff');
    response.end(payload);
  }
  return true;
}

interface PrivateCredentials {
  breakGlass?: string;
  operator?: string;
  worker?: string;
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > MAXIMUM_BODY_BYTES) {
      request.resume();
      throw new RangeError('public retro body is too large');
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
}

function nonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validSourceRoute(harness: unknown, hostClass: unknown): boolean {
  const supportedHarness =
    typeof harness === 'string' && ['claude-code', 'codex', 'cursor'].includes(harness);
  return supportedHarness && (hostClass === 'unknown' || hostClass === 'local');
}

function validV3SourceRoute(harness: unknown, hostClass: unknown): boolean {
  return (
    typeof harness === 'string' &&
    ['claude-code', 'codex', 'cursor'].includes(harness) &&
    hostClass === 'local'
  );
}

function validSourceFields(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return (
    REQUIRED_SOURCE_FIELDS.every(key => keys.includes(key)) &&
    keys.every(key => SOURCE_FIELDS.has(key)) &&
    Object.values(value).every(nonemptyString)
  );
}

function validSource(value: unknown, version: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (!validSourceFields(value)) return false;
  if (keys.includes('userIdentity') && (version !== 'v1' || value.harness === 'cursor'))
    return false;
  return (
    (version === 'v3'
      ? validV3SourceRoute(value.harness, value.hostClass)
      : validSourceRoute(value.harness, value.hostClass)) &&
    typeof value.projectUUID === 'string' &&
    UUID.test(value.projectUUID)
  );
}

function validEnvelopeFindings(value: Record<string, unknown>): boolean {
  if (value.version === 'v1') {
    return hasExactKeys(value, V1_FIELDS) && nonemptyString(value.finding);
  }
  if (
    (value.version !== 'v2' && value.version !== 'v3') ||
    !hasExactKeys(value, V2_FIELDS) ||
    !Array.isArray(value.findings) ||
    value.findings.length === 0 ||
    !value.findings.every(nonemptyString)
  ) {
    return false;
  }
  return value.version !== 'v3' || validV3Findings(value.findings);
}

function validV3Findings(findings: string[]): boolean {
  return (
    findings.length <= 50 &&
    findings.every(
      finding =>
        Buffer.byteLength(JSON.stringify(finding), 'utf8') <= 4096 &&
        !RELAY_AUTHORITY_MARKER.test(finding),
    )
  );
}

function envelopeMetadata(
  rawBody: Buffer,
): { projectUUID: string; sessionScope: string; version: 'legacy' | 'v3' } | undefined {
  try {
    const source = UTF8_DECODER.decode(rawBody);
    const value = JSON.parse(source) as unknown;
    if (JSON.stringify(value) !== source) return undefined;
    if (!isRecord(value) || !validEnvelopeFindings(value)) return undefined;
    if (!validSource(value.source, value.version)) return undefined;
    return typeof value.sessionScope === 'string' && SESSION_SCOPE.test(value.sessionScope)
      ? {
          projectUUID: (value.source as Record<string, unknown>).projectUUID as string,
          sessionScope: value.sessionScope,
          version: value.version === 'v3' ? 'v3' : 'legacy',
        }
      : undefined;
  } catch {
    return undefined;
  }
}

function workerAuthorized(
  request: IncomingMessage,
  credential: string | undefined,
  store: PublicRetroStorePort,
): boolean {
  return (
    credential !== undefined &&
    matchesCredential(request.headers.authorization, credential) &&
    store.claim !== undefined
  );
}

function sendNoContent(response: ServerResponse): void {
  response.statusCode = 204;
  response.end();
}

function workerLeaseInput(
  request: IncomingMessage,
): { action: 'complete' | 'reject' | 'release'; leaseToken: string } | undefined {
  const leaseToken = request.headers['x-safeword-lease-token'];
  if (typeof leaseToken !== 'string' || !UUID.test(leaseToken)) return undefined;
  if (request.method === 'DELETE') return { action: 'release', leaseToken };
  if (request.method === 'PATCH') return { action: 'reject', leaseToken };
  if (request.method === 'PUT') return { action: 'complete', leaseToken };
  return undefined;
}

function serveWorkerLifecycle(
  request: IncomingMessage,
  response: ServerResponse,
  store: PublicRetroStorePort,
  requestId: string,
): void {
  const input = workerLeaseInput(request);
  if (
    !UUID_V4.test(requestId) ||
    input === undefined ||
    store.complete === undefined ||
    store.reject === undefined ||
    store.release === undefined
  ) {
    sendJson(response, 400, { error: 'invalid_request' });
    return;
  }
  let changed: boolean;
  switch (input.action) {
    case 'release': {
      changed = store.release(requestId, input.leaseToken);
      break;
    }
    case 'reject': {
      changed = store.reject(requestId, input.leaseToken);
      break;
    }
    case 'complete': {
      changed = store.complete(requestId, input.leaseToken);
      break;
    }
  }
  if (changed) sendNoContent(response);
  else sendJson(response, 409, { error: 'lease_conflict' });
}

function serveWorkerRoute(
  request: IncomingMessage,
  response: ServerResponse,
  store: PublicRetroStorePort,
  credential: string | undefined,
): boolean {
  const route = workerRoute(request);
  if (route === undefined) return false;
  if (!workerAuthorized(request, credential, store)) {
    sendJson(response, 404, { error: 'not_found' });
    return true;
  }
  if (route.kind === 'lifecycle') {
    serveWorkerLifecycle(request, response, store, route.requestId);
    return true;
  }
  const claim = store.claim?.();
  if (claim === undefined) {
    sendNoContent(response);
  } else {
    sendJson(response, 200, claim);
  }
  return true;
}

function workerRoute(
  request: IncomingMessage,
): { kind: 'claim' } | { kind: 'lifecycle'; requestId: string } | undefined {
  if (request.method === 'POST' && request.url === '/v1/private/retro-claims') {
    return { kind: 'claim' };
  }
  const requestId = /^\/v1\/private\/retro-claims\/([0-9a-f-]{36})$/u.exec(request.url ?? '')?.[1];
  return requestId === undefined ? undefined : { kind: 'lifecycle', requestId };
}

function validRequestIdentity(requestId: unknown, version: 'legacy' | 'v3'): requestId is string {
  return (
    typeof requestId === 'string' &&
    (version === 'legacy' ? UUID.test(requestId) : UUID_V4.test(requestId))
  );
}

async function servePublicSubmission(
  request: IncomingMessage,
  response: ServerResponse,
  store: PublicRetroStorePort,
): Promise<void> {
  const requestId = request.headers['x-safeword-request-id'];
  if (typeof requestId !== 'string' || !UUID.test(requestId)) {
    sendJson(response, 400, { error: 'invalid_request' });
    return;
  }
  try {
    const rawBody = await readBody(request);
    const metadata = envelopeMetadata(rawBody);
    if (metadata === undefined || !validRequestIdentity(requestId, metadata.version)) {
      sendJson(response, 400, { error: 'invalid_request' });
      return;
    }
    const result = store.accept(
      requestId,
      metadata.sessionScope,
      rawBody,
      metadata.version,
      metadata.projectUUID,
    );
    sendJson(response, result.status === 'accepted' ? 201 : 200, {
      requestId: result.requestId,
      receipt: result.receipt,
    });
  } catch (error) {
    if (error instanceof PublicRetroConflict) {
      sendJson(response, 409, { error: 'conflict' });
      return;
    }
    if (error instanceof RangeError) {
      sendJson(response, 413, { error: 'too_large' });
      return;
    }
    if (error instanceof PublicRetroQuotaExceeded) {
      sendJson(response, 429, { error: 'intake_quota_exhausted' });
      return;
    }
    sendJson(response, 500, { error: 'store_unavailable' });
  }
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  store: PublicRetroStorePort,
  credentials: PrivateCredentials,
): Promise<void> {
  if (serveWorkerRoute(request, response, store, credentials.worker)) return;
  if (
    servePrivateInspection(request, response, store, credentials.operator, credentials.breakGlass)
  )
    return;
  if (serveReadRoute(request, response, store, credentials.operator)) return;
  if (!validPublicRequest(request)) {
    sendJson(response, 404, { error: 'not_found' });
    return;
  }
  await servePublicSubmission(request, response, store);
}

export async function startPublicRetroCollector(
  options: PublicRetroCollectorOptions,
  store: PublicRetroStorePort = new PublicRetroStore(options.databasePath, {
    filingLimitPerHour: options.filingLimitPerHour,
    intakeLimitPerMinute: options.intakeLimitPerMinute,
    projectFilingLimitPerHour: options.projectFilingLimitPerHour,
  }),
): Promise<PublicRetroCollectorRuntime> {
  const credentials: PrivateCredentials = {
    breakGlass: normalizedCredential(options.breakGlassCredential),
    operator: normalizedCredential(options.operatorCredential),
    worker: normalizedCredential(options.collectorWorkerCredential),
  };
  const server = createServer((request, response) => {
    void handle(request, response, store, credentials).catch(() => {
      if (response.headersSent) {
        response.destroy();
      } else {
        sendJson(response, 500, { error: 'store_unavailable' });
      }
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(options.port ?? 0, options.host ?? '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
  } catch (error) {
    store.close();
    throw error;
  }
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    store.close();
    throw new Error('Public retro collector did not bind a TCP address.');
  }
  return {
    url: `http://${address.address}:${address.port}`,
    close: async () => {
      server.closeIdleConnections();
      try {
        await new Promise<void>((resolve, reject) => {
          server.close(error => {
            if (error === undefined) resolve();
            else reject(error);
          });
        });
      } finally {
        store.close();
      }
    },
  };
}

function normalizedCredential(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === '' ? undefined : normalized;
}
