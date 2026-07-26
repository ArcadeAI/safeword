import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import type { CredentialRegistry } from './auth.js';
import { RelayError } from './errors.js';
import type { GitHubRestClient } from './github.js';
import { ProcessLock } from './process-lock.js';
import { type RelayFaults, RelayService } from './service.js';
import type { RelayStore } from './store.js';
import type { FileRetroDraftRequest } from './types.js';

async function readJson(request: IncomingMessage): Promise<unknown> {
  let body = '';
  for await (const chunk of request) body += String(chunk);

  return JSON.parse(body) as unknown;
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(value));
}

function bearer(request: IncomingMessage): string | undefined {
  return request.headers.authorization;
}

type RelayServerOptions = {
  credentials: CredentialRegistry;
  store: RelayStore;
  github: GitHubRestClient;
  payloadKey: Buffer;
} & (
  | { lockPath: string; allowUnlockedForTests?: never }
  | { lockPath?: never; allowUnlockedForTests: true }
);

export async function startRelayServer(input: RelayServerOptions): Promise<{
  server: ReturnType<typeof createServer>;
  url: string;
  faults: RelayFaults;
  observability: {
    logs: Record<string, unknown>[];
    metrics: Record<string, unknown>[];
  };
}> {
  const processLock =
    input.lockPath === undefined ? undefined : ProcessLock.acquire(input.lockPath);
  input.store.recoverInFlight();
  const faults: RelayFaults = {};
  const observability = {
    logs: [] as Record<string, unknown>[],
    metrics: [] as Record<string, unknown>[],
  };
  const service = new RelayService({ ...input, faults });
  const server = createServer((request, response) => {
    void handle(request, response);
  });
  server.once('close', () => processLock?.release());

  // eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- A single composition-root router keeps the public contract visible.
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const principal = input.credentials.authenticate(bearer(request));
      if (principal === undefined) throw new RelayError(401, 'authentication is required');
      const url = new URL(request.url ?? '/', 'https://relay.invalid');
      if (request.method === 'POST' && url.pathname === '/v1/retro-filings') {
        const receipt = await service.submit(
          principal,
          (await readJson(request)) as FileRetroDraftRequest,
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
          faults.afterReceiptCommit?.();
        } catch {
          response.destroy();
          return;
        }
        if (receipt.state !== 'filed') response.setHeader('retry-after', '1');
        sendJson(response, receipt.state === 'filed' ? 201 : 202, receipt);
        return;
      }
      const reconciliation = /^\/v1\/retro-filings\/([^/]+)\/reconcile$/u.exec(url.pathname);
      if (request.method === 'POST' && reconciliation?.[1] !== undefined) {
        const receipt = await service.reconcile(principal, decodeURIComponent(reconciliation[1]));
        sendJson(response, 200, receipt);
        return;
      }
      const status = /^\/v1\/retro-filings\/([^/]+)$/u.exec(url.pathname);
      if (request.method === 'GET' && status?.[1] !== undefined) {
        sendJson(response, 200, service.status(principal, decodeURIComponent(status[1])));
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

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    processLock?.release();
    throw new Error('relay did not bind a TCP address');
  }
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    faults,
    observability,
  };
}
