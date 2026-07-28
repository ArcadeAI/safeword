import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

import { CredentialRegistry } from './auth.js';
import { GitHubRestClient } from './github.js';
import { GitHubAppTokenProvider } from './github-app-token.js';
import { startRelayServer } from './http-server.js';
import type { RuntimeConfig } from './runtime-config.js';
import { RelayStore } from './store.js';

export interface RelayRuntime {
  url: string;
  authorization: string;
  authorizations: Record<'claude' | 'codex' | 'cursor' | 'operator', string>;
  close: () => Promise<void>;
}

export async function startRelayRuntime(
  config: RuntimeConfig,
  log: (event: Record<string, unknown>) => void = event => {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  },
): Promise<RelayRuntime> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- The fail-closed parser requires an absolute non-root deployment data directory.
  await mkdir(config.dataDirectory, { recursive: true });
  const store = RelayStore.open(config.databasePath);
  const missingPayloadKeys = store
    .payloadKeyIds()
    .filter(keyId => !config.payloadKeyring.keys.has(keyId));
  if (missingPayloadKeys.length > 0) {
    store.close();
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
      }),
      host: config.host,
      lockPath: config.lockPath,
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
        await new Promise<void>((resolve, reject) => {
          const forceClose = setTimeout(() => {
            relay.server.closeAllConnections();
          }, 25_000);
          forceClose.unref();
          relay.server.close(error => {
            clearTimeout(forceClose);
            if (error === undefined) resolve();
            else reject(error);
          });
        });
        store.close();
      },
    };
  } catch (error) {
    store.close();
    throw error;
  }
}
