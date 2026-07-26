import type { Server } from 'node:http';

export { RelayStore } from './store.js';

export interface FileRetroDraftRequest {
  requestId: string;
  installationId: number;
  repository: string;
  canonicalKey: string;
  legacySignature: string;
  title: string;
  body: string;
  labels: string[];
}

export class CredentialRegistry {
  readonly #pepper: string;

  constructor(pepper: string) {
    this.#pepper = pepper;
  }

  issue(_input: Record<string, unknown>): string {
    throw new Error(`CredentialRegistry is not implemented (${this.#pepper.length})`);
  }
}

export class GitHubRestClient {
  readonly input: Record<string, unknown>;

  constructor(input: Record<string, unknown>) {
    this.input = input;
  }
}

export function createHarnessAdapters(_url: string, _credential: string): never {
  throw new Error('harness adapters are not implemented');
}

export async function startRelayServer(_input: Record<string, unknown>): Promise<{
  server: Server;
  url: string;
  faults: { afterGitHubCreate?: () => void };
}> {
  await Promise.resolve();
  throw new Error('relay server is not implemented');
}
