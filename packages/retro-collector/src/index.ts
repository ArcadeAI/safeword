import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { PublicRetroConflict, PublicRetroStore } from './store.js';

type PublicRetroStorePort = Pick<PublicRetroStore, 'accept' | 'close' | 'read'>;

const MAXIMUM_BODY_BYTES = 65_536;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SESSION_SCOPE = /^[0-9a-f]{64}$/u;
const TOP_LEVEL_FIELDS = ['version', 'finding', 'source', 'sessionScope'] as const;
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

export interface PublicRetroCollectorRuntime {
  url: string;
  close: () => Promise<void>;
}

export interface PublicRetroCollectorOptions {
  databasePath: string;
  host?: string;
  operatorCredential?: string;
  port?: number;
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
  const authorization = request.headers.authorization;
  const expected = `Bearer ${credential}`;
  if (authorization?.length !== expected.length) return undefined;
  if (!timingSafeEqual(Buffer.from(authorization), Buffer.from(expected))) return undefined;
  const match = /^\/v1\/public-retros\/([0-9a-f-]{36})$/u.exec(request.url ?? '');
  return match?.[1] !== undefined && UUID.test(match[1]) ? match[1] : undefined;
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

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > MAXIMUM_BODY_BYTES) throw new RangeError('public retro body is too large');
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

function validSource(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (REQUIRED_SOURCE_FIELDS.some(key => !keys.includes(key))) return false;
  if (keys.some(key => !SOURCE_FIELDS.has(key))) return false;
  if (Object.values(value).some(item => !nonemptyString(item))) return false;
  return (
    (value.harness === 'claude-code' || value.harness === 'codex') &&
    value.hostClass === 'local' &&
    typeof value.projectUUID === 'string' &&
    UUID.test(value.projectUUID)
  );
}

function envelopeSessionScope(rawBody: Buffer): string | undefined {
  try {
    const source = UTF8_DECODER.decode(rawBody);
    const value = JSON.parse(source) as unknown;
    if (JSON.stringify(value) !== source) return undefined;
    if (!isRecord(value) || !hasExactKeys(value, TOP_LEVEL_FIELDS)) return undefined;
    if (value.version !== 'v1' || !nonemptyString(value.finding)) return undefined;
    if (!validSource(value.source)) return undefined;
    return typeof value.sessionScope === 'string' && SESSION_SCOPE.test(value.sessionScope)
      ? value.sessionScope
      : undefined;
  } catch {
    return undefined;
  }
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  store: PublicRetroStorePort,
  operatorCredential: string | undefined,
): Promise<void> {
  if (serveReadRoute(request, response, store, operatorCredential)) return;
  if (!validPublicRequest(request)) {
    sendJson(response, 404, { error: 'not_found' });
    return;
  }
  const requestId = request.headers['x-safeword-request-id'];
  if (typeof requestId !== 'string' || !UUID.test(requestId)) {
    sendJson(response, 400, { error: 'invalid_request' });
    return;
  }
  try {
    const rawBody = await readBody(request);
    const scope = envelopeSessionScope(rawBody);
    if (scope === undefined) {
      sendJson(response, 400, { error: 'invalid_request' });
      return;
    }
    const result = store.accept(requestId, scope, rawBody);
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
    sendJson(response, 500, { error: 'store_unavailable' });
  }
}

export async function startPublicRetroCollector(
  options: PublicRetroCollectorOptions,
  store: PublicRetroStorePort = new PublicRetroStore(options.databasePath),
): Promise<PublicRetroCollectorRuntime> {
  const configuredCredential = options.operatorCredential?.trim();
  const operatorCredential = configuredCredential === '' ? undefined : configuredCredential;
  const server = createServer((request, response) => {
    void handle(request, response, store, operatorCredential).catch(() => {
      if (response.headersSent) {
        response.destroy();
      } else {
        sendJson(response, 500, { error: 'store_unavailable' });
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, options.host ?? '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    store.close();
    throw new Error('Public retro collector did not bind a TCP address.');
  }
  return {
    url: `http://${address.address}:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error === undefined) resolve();
          else reject(error);
        });
      });
      store.close();
    },
  };
}
