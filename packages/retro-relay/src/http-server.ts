import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import type { CredentialRegistry } from './auth.js';
import { RelayError } from './errors.js';
import type { GitHubRestClient } from './github.js';
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

export async function startRelayServer(input: {
  credentials: CredentialRegistry;
  store: RelayStore;
  github: GitHubRestClient;
  payloadKey: Buffer;
}): Promise<{
  server: ReturnType<typeof createServer>;
  url: string;
  faults: RelayFaults;
}> {
  const faults: RelayFaults = {};
  const service = new RelayService({ ...input, faults });
  const server = createServer((request, response) => {
    void handle(request, response);
  });

  // eslint-disable-next-line complexity -- A single composition-root router keeps the public contract visible.
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
    throw new Error('relay did not bind a TCP address');
  }
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    faults,
  };
}
