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
  const credentials = new CredentialRegistry(config.credentialPepper);
  const authorization = credentials.issue(config.credential);
  const tokenProvider = new GitHubAppTokenProvider({
    appId: config.github.appId,
    baseUrl: config.github.baseUrl,
    privateKey: config.github.privateKey,
  });

  try {
    const relay = await startRelayServer({
      credentials,
      store,
      github: new GitHubRestClient({
        baseUrl: config.github.baseUrl,
        installationToken: async (installationId, repo) => {
          log({ stage: 'github_installation_token', installationId, repository: repo });
          return tokenProvider.token(installationId, repo);
        },
      }),
      host: config.host,
      lockPath: config.lockPath,
      payloadKey: config.payloadKey,
      port: config.port,
      replicaId: config.replicaId,
    });
    let closed = false;
    return {
      url: relay.url,
      authorization,
      close: async () => {
        if (closed) return;
        closed = true;
        await new Promise<void>((resolve, reject) => {
          relay.server.close(error => {
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
