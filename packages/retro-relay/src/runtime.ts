import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

import { CredentialRegistry } from './auth.js';
import { GitHubRestClient } from './github.js';
import { GitHubAppTokenProvider } from './github-app-token.js';
import { startRelayServer } from './http-server.js';
import { ProcessLock } from './process-lock.js';
import type { RuntimeConfig } from './runtime-config.js';
import { RelayStore } from './store.js';

export interface RelayRuntime {
  url: string;
  authorization: string;
  authorizations: Record<'claude' | 'codex' | 'cursor' | 'operator' | 'collector-worker', string>;
  close: () => Promise<void>;
}

export async function closeRelayRuntimeResources(
  server: {
    close: (callback: (error?: Error) => void) => void;
    closeAllConnections: () => void;
  },
  store: Pick<RelayStore, 'close'>,
  processLock: Pick<ProcessLock, 'release'>,
): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      const forceClose = setTimeout(() => {
        server.closeAllConnections();
      }, 25_000);
      forceClose.unref();
      server.close(error => {
        clearTimeout(forceClose);
        if (error === undefined) resolve();
        else reject(error);
      });
    });
  } finally {
    try {
      store.close();
    } finally {
      processLock.release();
    }
  }
}

export async function startRelayRuntime(
  config: RuntimeConfig,
  log: (event: Record<string, unknown>) => void = event => {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  },
): Promise<RelayRuntime> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- The fail-closed parser requires an absolute non-root deployment data directory.
  await mkdir(config.dataDirectory, { recursive: true });
  const processLock = ProcessLock.acquire(config.lockPath);
  let store: RelayStore;
  try {
    store = RelayStore.open(config.databasePath);
  } catch (error) {
    processLock.release();
    throw error;
  }
  const missingPayloadKeys = store
    .payloadKeyIds()
    .filter(keyId => !config.payloadKeyring.keys.has(keyId));
  if (missingPayloadKeys.length > 0) {
    store.close();
    processLock.release();
    throw new Error(`missing relay payload keys: ${missingPayloadKeys.join(', ')}`);
  }
  const credentials = new CredentialRegistry(config.credentialPepper);
  const issued = config.credentials.map(credential => ({
    authorization: credentials.issue(credential),
    harness: credential.harness,
  }));
  const authorizations = Object.fromEntries(
    issued.map(item => [item.harness, item.authorization]),
  ) as Partial<RelayRuntime['authorizations']>;
  const authorization = issued[0].authorization;
  const tokenProvider = new GitHubAppTokenProvider({
    appId: config.github.appId,
    baseUrl: config.github.baseUrl,
    privateKey: config.github.privateKey,
  });

  try {
    const relay = await startRelayServer({
      credentials,
      store,
      bootId: randomUUID(),
      github: new GitHubRestClient({
        baseUrl: config.github.baseUrl,
        invalidateInstallationToken: (installationId, repo) => {
          tokenProvider.invalidate(installationId, repo);
        },
        installationToken: async (installationId, repo) => {
          log({ stage: 'github_installation_token', installationId, repository: repo });
          return tokenProvider.token(installationId, repo);
        },
        reconciliationMaxPages: config.reconciliation.maxPages,
        reconciliationTimeoutMs: config.reconciliation.timeoutMs,
      }),
      host: config.host,
      processLock,
      payloadKeyring: config.payloadKeyring,
      port: config.port,
      replicaId: config.replicaId,
      mode: config.mode,
      onAlert: log,
    });
    let closed = false;
    return {
      url: relay.url,
      authorization,
      authorizations: authorizations as RelayRuntime['authorizations'],
      close: async () => {
        if (closed) return;
        closed = true;
        await closeRelayRuntimeResources(relay.server, store, processLock);
      },
    };
  } catch (error) {
    store.close();
    processLock.release();
    throw error;
  }
}
