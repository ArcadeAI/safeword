import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { PublicRetroConflict, PublicRetroStore } from './store.js';

const MAXIMUM_BODY_BYTES = 65_536;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SESSION_SCOPE = /^[0-9a-f]{64}$/u;

export interface PublicRetroCollectorRuntime {
  url: string;
  close: () => Promise<void>;
}

export interface PublicRetroCollectorOptions {
  databasePath: string;
  host?: string;
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

function sessionScope(rawBody: Buffer): string | undefined {
  try {
    const value = JSON.parse(rawBody.toString('utf8')) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const scope = (value as { sessionScope?: unknown }).sessionScope;
    return typeof scope === 'string' && SESSION_SCOPE.test(scope) ? scope : undefined;
  } catch {
    return undefined;
  }
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  store: PublicRetroStore,
): Promise<void> {
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
    const scope = sessionScope(rawBody);
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
): Promise<PublicRetroCollectorRuntime> {
  const store = new PublicRetroStore(options.databasePath);
  const server = createServer((request, response) => {
    void handle(request, response, store);
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
