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
  replicaId?: string;
  bootId?: string;
  host?: string;
  port?: number;
  mode?: 'production' | 'spike';
  maintenanceIntervalMs?: number;
  onAlert?: (event: {
    event: 'retro_lifecycle_alert';
    eventId: string;
    receiptId: string;
    state: 'ambiguous' | 'dead-letter';
  }) => void;
} & (
  | { lockPath: string; allowUnlockedForTests?: never }
  | { lockPath?: never; allowUnlockedForTests: true }
);

// eslint-disable-next-line complexity -- Lifecycle setup and the public server contract stay visible together.
export async function startRelayServer(input: RelayServerOptions): Promise<{
  server: ReturnType<typeof createServer>;
  url: string;
  faults: RelayFaults;
  observability: {
    logs: Record<string, unknown>[];
    metrics: Record<string, unknown>[];
  };
  maintain: (now?: Date) => Promise<void>;
}> {
  const processLock =
    input.lockPath === undefined ? undefined : ProcessLock.acquire(input.lockPath);
  try {
    input.store.recoverInFlight();
  } catch (error) {
    processLock?.release();
    throw error;
  }
  const faults: RelayFaults = {};
  const observability = {
    logs: [] as Record<string, unknown>[],
    metrics: [] as Record<string, unknown>[],
  };
  const service = new RelayService({ ...input, faults });
  let maintenanceRunning = false;
  const maintain = async (now = new Date()): Promise<void> => {
    if (maintenanceRunning || input.mode === 'spike') return;
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
  const maintenanceTimer =
    input.mode === 'spike'
      ? undefined
      : setInterval(() => {
          void maintain();
        }, input.maintenanceIntervalMs ?? 60_000);
  maintenanceTimer?.unref();
  server.once('close', () => {
    if (maintenanceTimer !== undefined) clearInterval(maintenanceTimer);
    processLock?.release();
  });

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
      if (request.method === 'GET' && url.pathname === '/v1/operations/retro-filings') {
        sendJson(response, 200, {
          ...service.operations(principal),
          bootId: input.bootId ?? 'local',
        });
        return;
      }
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
        const decodedReceipt = decodeURIComponent(reconciliation[1]);
        try {
          const receipt = await service.reconcile(principal, decodedReceipt);
          observability.logs.push({
            event: 'retro_reconciliation',
            receiptId: decodedReceipt,
            subject: principal.subject,
            disposition: 'adopted',
          });
          observability.metrics.push({
            metric: 'retro_reconciliation_outcome',
            disposition: 'adopted',
          });
          sendJson(response, 200, receipt);
        } catch (error) {
          const disposition =
            error instanceof RelayError && typeof error.details?.disposition === 'string'
              ? error.details.disposition
              : undefined;
          if (disposition !== undefined) {
            observability.logs.push({
              event: 'retro_reconciliation',
              receiptId: decodedReceipt,
              subject: principal.subject,
              disposition,
              alert: true,
            });
            observability.metrics.push({
              metric: 'retro_reconciliation_outcome',
              disposition,
            });
          }
          throw error;
        }
        return;
      }
      const status = /^\/v1\/retro-filings\/([^/]+)$/u.exec(url.pathname);
      if (request.method === 'GET' && status?.[1] !== undefined) {
        const receipt = service.status(principal, decodeURIComponent(status[1]));
        if (receipt.state !== 'filed') response.setHeader('retry-after', '1');
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
      server.once('error', reject);
      server.listen(input.port ?? 0, input.host ?? '127.0.0.1', resolve);
    });
  } catch (error) {
    processLock?.release();
    throw error;
  }
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    processLock?.release();
    throw new Error('relay did not bind a TCP address');
  }
  return {
    server,
    url: `http://${input.host === '0.0.0.0' ? '127.0.0.1' : (input.host ?? '127.0.0.1')}:${address.port}`,
    faults,
    observability,
    maintain,
  };
}
