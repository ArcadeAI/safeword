import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import type { CredentialRegistry } from './auth.js';
import { RelayError } from './errors.js';
import type { GitHubRestClient } from './github.js';
import type { PayloadKeyring } from './payload.js';
import { ProcessLock } from './process-lock.js';
import { type RelayFaults, RelayService } from './service.js';
import type { RelayStore } from './store.js';
import {
  type FileRetroDraftRequest,
  isTerminalReceiptState,
  type RelayPrincipal,
} from './types.js';

const RELAY_API_VERSION = '1';
const RELAY_API_VERSION_HEADER = 'x-safeword-relay-api-version';

const DEFAULT_MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_MAX_REQUESTS_PER_WINDOW = 60;
const DEFAULT_RATE_WINDOW_MS = 60_000;
const DEFAULT_MAINTENANCE_INTERVAL_MS = 60_000;
const SOCKET_TIMEOUT_MS = 10_000;

async function readJson(request: IncomingMessage, maximumBytes: number): Promise<unknown> {
  const contentLength = Number(request.headers['content-length'] ?? '0');
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new RelayError(413, 'relay request body is too large');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > maximumBytes) {
      request.resume();
      throw new RelayError(413, 'relay request body is too large');
    }
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new RelayError(400, 'relay request body is invalid JSON');
  }
}

async function readBytes(request: IncomingMessage, maximumBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > maximumBytes) throw new RelayError(413, 'relay request body is too large');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function shortDigest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function nonemptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string');
}

function collectorFindings(value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RelayError(400, 'collector envelope is invalid');
  }
  const envelope = value as { findings?: unknown; version?: unknown };
  if (envelope.version !== 'v3' || !nonemptyStringArray(envelope.findings)) {
    throw new RelayError(400, 'collector envelope is invalid');
  }
  return envelope.findings;
}

function collectorDraft(
  bytes: Buffer,
  requestId: string,
  principal: RelayPrincipal,
  now: Date,
): FileRetroDraftRequest {
  const envelope = JSON.parse(bytes.toString('utf8')) as { source?: { repository?: unknown } };
  const findings = collectorFindings(envelope);
  const repo = principal.repository;
  const [firstLine = ''] = findings[0]?.split('\n') ?? [];
  const title = firstLine.slice(0, 256);
  if (title.trim() === '') throw new RelayError(400, 'collector envelope is invalid');
  const identity = shortDigest(findings.join('\0'));
  return {
    body: findings.join('\n\n---\n\n'),
    canonicalKey: `canonical:${identity}`,
    installationId: principal.installationId,
    labels: ['self-report', 'retro'],
    legacySignature: `retro:${identity}`,
    repository: repo,
    requestId,
    retryDeadlineAt: new Date(now.getTime() + 86_400_000).toISOString(),
    title,
  };
}

function collectorHeaders(request: IncomingMessage): {
  acceptedAt: string;
  digest: string;
  requestId: string;
} {
  const requestId = request.headers['x-safeword-request-id'];
  const digest = request.headers['x-safeword-envelope-digest'];
  const acceptedAt = request.headers['x-safeword-accepted-at'];
  if (
    typeof requestId !== 'string' ||
    typeof digest !== 'string' ||
    !/^[\da-f]{64}$/u.test(digest) ||
    typeof acceptedAt !== 'string' ||
    !Number.isFinite(Date.parse(acceptedAt))
  ) {
    throw new RelayError(400, 'collector envelope headers are invalid');
  }
  return { acceptedAt, digest, requestId };
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(value));
}

function bearer(request: IncomingMessage): string | undefined {
  return request.headers.authorization;
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new RelayError(400, 'relay receipt path is malformed');
  }
}

const RECONCILE_ROUTE = /^\/v1\/retro-filings\/([^/]+)\/reconcile$/u;
const RECOVER_ROUTE = /^\/v1\/retro-filings\/([^/]+)\/recover$/u;
const RECEIPT_ROUTE = /^\/v1\/retro-filings\/([^/]+)$/u;

/** Returns the decoded receipt id when the request matches the route, else undefined. */
function matchReceiptRoute(
  requestMethod: string | undefined,
  pathname: string,
  expectedMethod: string,
  pattern: RegExp,
): string | undefined {
  if (requestMethod !== expectedMethod) return undefined;
  const segment = pattern.exec(pathname)?.[1];
  return segment === undefined ? undefined : decodePathSegment(segment);
}

export interface RelayServerFaults extends RelayFaults {
  afterReceiptCommit?: () => void;
}

type RelayServerOptions = {
  credentials: CredentialRegistry;
  store: RelayStore;
  github: GitHubRestClient;
  replicaId?: string;
  bootId?: string;
  host?: string;
  port?: number;
  mode?: 'production' | 'spike';
  maintenanceIntervalMs?: number;
  now?: () => Date;
  faults?: RelayServerFaults;
  resourceLimits?: {
    maxBodyBytes?: number;
    maxRequestsPerWindow?: number;
    windowMs?: number;
  };
  onAlert?: (event: {
    event: 'retro_lifecycle_alert';
    eventId: string;
    receiptId: string;
    state: 'ambiguous' | 'dead-letter';
  }) => void;
} & (
  | { lockPath: string; allowUnlockedForTests?: never }
  | { processLock: ProcessLock; lockPath?: never; allowUnlockedForTests?: never }
  | { lockPath?: never; allowUnlockedForTests: true }
) &
  (
    | { payloadKeyring: PayloadKeyring; payloadKey?: never }
    | { payloadKey: Buffer; payloadKeyring?: never }
  );

function resolvePayloadKeyring(input: RelayServerOptions): PayloadKeyring {
  if (input.payloadKeyring !== undefined) return input.payloadKeyring;
  return {
    activeKeyId: 'legacy',
    keys: new Map([['legacy', input.payloadKey]]),
  };
}

function resolveProcessLock(input: RelayServerOptions): {
  lock: ProcessLock | undefined;
  owned: boolean;
} {
  if ('processLock' in input) return { lock: input.processLock, owned: false };
  if (input.lockPath === undefined) return { lock: undefined, owned: false };
  return { lock: ProcessLock.acquire(input.lockPath), owned: true };
}

// eslint-disable-next-line complexity -- Lifecycle setup and the public server contract stay visible together.
export async function startRelayServer(input: RelayServerOptions): Promise<{
  server: ReturnType<typeof createServer>;
  url: string;
  observability: {
    logs: Record<string, unknown>[];
    metrics: Record<string, unknown>[];
  };
  maintain: (now?: Date) => Promise<void>;
}> {
  const { lock: processLock, owned: ownsProcessLock } = resolveProcessLock(input);
  try {
    input.store.recoverInFlight();
  } catch (error) {
    if (ownsProcessLock) processLock?.release();
    throw error;
  }
  const { afterReceiptCommit, ...serviceFaults } = input.faults ?? {};
  const observability = {
    logs: [] as Record<string, unknown>[],
    metrics: [] as Record<string, unknown>[],
  };
  const payloadKeyring = resolvePayloadKeyring(input);
  const service = new RelayService({
    store: input.store,
    github: input.github,
    payloadKeyring,
    faults: serviceFaults,
    ...(input.now !== undefined && { now: input.now }),
  });
  const maxBodyBytes = input.resourceLimits?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const maxRequestsPerWindow =
    input.resourceLimits?.maxRequestsPerWindow ?? DEFAULT_MAX_REQUESTS_PER_WINDOW;
  const rateWindowMs = input.resourceLimits?.windowMs ?? DEFAULT_RATE_WINDOW_MS;
  const rateWindows = new Map<string, { count: number; startedAt: number }>();
  const consumeRequestCapacity = (credentialId: string): boolean => {
    const now = (input.now?.() ?? new Date()).getTime();
    const current = rateWindows.get(credentialId);
    if (current === undefined || now - current.startedAt >= rateWindowMs) {
      rateWindows.set(credentialId, { count: 1, startedAt: now });
      return true;
    }
    if (current.count >= maxRequestsPerWindow) return false;
    current.count += 1;
    return true;
  };
  let released = false;
  let maintenanceRunning = false;
  const maintain = async (now = new Date()): Promise<void> => {
    if (released || maintenanceRunning || input.mode === 'spike') return;
    maintenanceRunning = true;
    try {
      await service.maintain(now);
      for (const alert of input.store.pendingAlerts()) {
        const event = {
          event: 'retro_lifecycle_alert' as const,
          eventId: alert.eventId,
          receiptId: alert.receiptId,
          state: alert.state,
        };
        observability.logs.push(event);
        observability.metrics.push({
          metric: 'retro_lifecycle_alert',
          eventId: alert.eventId,
          state: alert.state,
        });
        input.onAlert?.(event);
        input.store.markAlertDelivered(alert.eventId);
      }
    } catch {
      observability.logs.push({ event: 'retro_maintenance_error' });
    } finally {
      maintenanceRunning = false;
    }
  };
  const server = createServer((request, response) => {
    void handle(request, response);
  });
  server.requestTimeout = SOCKET_TIMEOUT_MS;
  server.headersTimeout = SOCKET_TIMEOUT_MS;
  const maintenanceTimer =
    input.mode === 'spike'
      ? undefined
      : setInterval(() => {
          void maintain();
        }, input.maintenanceIntervalMs ?? DEFAULT_MAINTENANCE_INTERVAL_MS);
  maintenanceTimer?.unref();
  /**
   * Releases everything startup acquired, once.
   *
   * Startup can fail after the maintenance interval exists, and a failed
   * `listen` never emits 'close' — so leaving cleanup to the close handler
   * alone leaves that interval sweeping the real store and GitHub client on
   * behalf of a server the caller was told did not start, with another added
   * per retry. Every failure path calls this rather than releasing the lock
   * piecemeal and hoping 'close' arrives.
   */
  const releaseResources = (): void => {
    if (released) return;
    released = true;
    if (maintenanceTimer !== undefined) clearInterval(maintenanceTimer);
    if (ownsProcessLock) processLock?.release();
  };
  server.once('close', releaseResources);

  const recordReconciliationOutcome = (entry: {
    receiptId: string;
    subject: string;
    disposition: string;
    alert?: boolean;
  }): void => {
    observability.logs.push({
      event: 'retro_reconciliation',
      receiptId: entry.receiptId,
      subject: entry.subject,
      disposition: entry.disposition,
      ...(entry.alert === true && { alert: true }),
    });
    observability.metrics.push({
      metric: 'retro_reconciliation_outcome',
      disposition: entry.disposition,
    });
  };

  const respondWithReconciliation = async (
    response: ServerResponse,
    receiptId: string,
    subject: string,
    run: () => Promise<{ disposition: string; receipt: unknown }>,
  ): Promise<void> => {
    try {
      const { disposition, receipt } = await run();
      recordReconciliationOutcome({ receiptId, subject, disposition });
      sendJson(response, 200, receipt);
    } catch (error) {
      const disposition =
        error instanceof RelayError && typeof error.details?.disposition === 'string'
          ? error.details.disposition
          : undefined;
      if (disposition !== undefined) {
        recordReconciliationOutcome({ receiptId, subject, disposition, alert: true });
      }
      throw error;
    }
  };

  const respondWithSubmission = async (
    request: IncomingMessage,
    response: ServerResponse,
    principal: RelayPrincipal,
  ): Promise<void> => {
    const requestedVersion = Reflect.get(request.headers, RELAY_API_VERSION_HEADER);
    if (requestedVersion !== undefined && requestedVersion !== RELAY_API_VERSION) {
      throw new RelayError(400, 'unsupported relay API version', {
        supportedVersion: RELAY_API_VERSION,
      });
    }
    const receipt = await service.submit(
      principal,
      (await readJson(request, maxBodyBytes)) as FileRetroDraftRequest,
    );
    observability.logs.push({
      event: 'retro_filing',
      harness: principal.harness,
      requestId: receipt.requestId,
      state: receipt.state,
    });
    observability.metrics.push({
      metric: 'retro_filing_outcome',
      requestId: receipt.requestId,
      state: receipt.state,
    });
    try {
      afterReceiptCommit?.();
    } catch {
      response.destroy();
      return;
    }
    const terminal = isTerminalReceiptState(receipt.state);
    if (!terminal) response.setHeader('retry-after', '1');
    let statusCode = 202;
    if (receipt.state === 'filed') statusCode = 201;
    else if (terminal) statusCode = 200;
    response.setHeader(RELAY_API_VERSION_HEADER, RELAY_API_VERSION);
    sendJson(response, statusCode, receipt);
  };

  const respondWithCollectorSubmission = async (
    request: IncomingMessage,
    response: ServerResponse,
    principal: RelayPrincipal,
  ): Promise<void> => {
    if (!principal.roles.includes('ingest')) throw new RelayError(403, 'ingest role is required');
    const headers = collectorHeaders(request);
    const bytes = await readBytes(request, maxBodyBytes);
    const actualDigest = createHash('sha256').update(bytes).digest('hex');
    if (actualDigest !== headers.digest)
      throw new RelayError(409, 'collector envelope digest differs');
    const filingPrincipal: RelayPrincipal = { ...principal, roles: ['file'] };
    const receipt = await service.submit(
      filingPrincipal,
      collectorDraft(bytes, headers.requestId, principal, input.now?.() ?? new Date()),
      headers.acceptedAt,
    );
    sendJson(response, receipt.state === 'filed' ? 201 : 202, receipt);
  };

  // eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- A single composition-root router keeps the public contract visible.
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', 'https://relay.invalid');
      if (request.method === 'GET' && url.pathname === '/health') {
        try {
          sendJson(response, 200, {
            status: 'ok',
            schemaVersion: input.store.schemaVersion(),
            replicaId: input.replicaId ?? 'local',
            bootId: input.bootId ?? 'local',
          });
        } catch {
          sendJson(response, 503, { status: 'unavailable' });
        }
        return;
      }
      if (input.mode === 'spike') {
        throw new RelayError(503, 'spike mode exposes health only');
      }
      const principal = input.credentials.authenticate(bearer(request));
      if (principal === undefined) throw new RelayError(401, 'authentication is required');
      if (!consumeRequestCapacity(principal.credentialId)) {
        throw new RelayError(429, 'relay request rate limit exceeded');
      }
      if (request.method === 'GET' && url.pathname === '/v1/operations/retro-filings') {
        sendJson(response, 200, {
          ...service.operations(principal),
          bootId: input.bootId ?? 'local',
        });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/v1/retro-filings') {
        await respondWithSubmission(request, response, principal);
        return;
      }
      if (request.method === 'POST' && url.pathname === '/v1/collector-retros') {
        await respondWithCollectorSubmission(request, response, principal);
        return;
      }
      const toReconcile = matchReceiptRoute(request.method, url.pathname, 'POST', RECONCILE_ROUTE);
      if (toReconcile !== undefined) {
        await respondWithReconciliation(response, toReconcile, principal.subject, async () => ({
          disposition: 'adopted',
          receipt: await service.reconcile(principal, toReconcile),
        }));
        return;
      }
      const toRecover = matchReceiptRoute(request.method, url.pathname, 'POST', RECOVER_ROUTE);
      if (toRecover !== undefined) {
        await respondWithReconciliation(response, toRecover, principal.subject, async () => {
          const recovered = await service.recover(principal, toRecover);
          return { disposition: recovered.disposition, receipt: recovered.receipt };
        });
        return;
      }
      const toRead = matchReceiptRoute(request.method, url.pathname, 'GET', RECEIPT_ROUTE);
      if (toRead !== undefined) {
        const receipt = service.status(principal, toRead);
        if (!isTerminalReceiptState(receipt.state)) {
          response.setHeader('retry-after', '1');
        }
        sendJson(response, 200, receipt);
        return;
      }
      throw new RelayError(404, 'route not found');
    } catch (error) {
      if (error instanceof RelayError) {
        sendJson(response, error.status, {
          error: error.message,
          ...error.details,
        });
        return;
      }
      sendJson(response, 500, { error: 'internal relay error' });
    }
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        server.off('listening', onListening);
        reject(error);
      };
      const onListening = (): void => {
        server.off('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(input.port ?? 0, input.host ?? '127.0.0.1');
    });
    server.on('error', error => {
      observability.logs.push({ event: 'retro_server_error', message: error.message });
    });
  } catch (error) {
    releaseResources();
    throw error;
  }
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    releaseResources();
    throw new Error('relay did not bind a TCP address');
  }
  return {
    server,
    url: `http://${input.host === '0.0.0.0' ? '127.0.0.1' : (input.host ?? '127.0.0.1')}:${address.port}`,
    observability,
    maintain,
  };
}
