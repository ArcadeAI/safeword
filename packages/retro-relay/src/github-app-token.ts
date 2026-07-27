/* eslint-disable unicorn/consistent-class-member-order -- Public token operation precedes its JWT encoding helper. */

import { sign } from 'node:crypto';

interface CachedToken {
  token: string;
  expiresAt: number;
}

export interface GitHubAppTokenProviderOptions {
  appId: string;
  baseUrl: string;
  privateKey: string;
  now?: () => number;
  requestTimeoutMs?: number;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export class GitHubAppTokenProvider {
  readonly #appId: string;
  readonly #baseUrl: string;
  readonly #cache = new Map<string, CachedToken>();
  readonly #inFlight = new Map<string, Promise<string>>();
  readonly #now: () => number;
  readonly #privateKey: string;
  readonly #requestTimeoutMs: number;

  constructor(options: GitHubAppTokenProviderOptions) {
    this.#appId = options.appId;
    this.#baseUrl = options.baseUrl.replace(/\/$/u, '');
    this.#privateKey = options.privateKey;
    this.#now = options.now ?? Date.now;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
  }

  async token(installationId: number, repo: string): Promise<string> {
    const cacheKey = `${installationId}:${repo}`;
    const cached = this.#cache.get(cacheKey);
    const now = this.#now();
    if (cached !== undefined && cached.expiresAt - now > 5 * 60_000) return cached.token;
    const existing = this.#inFlight.get(cacheKey);
    if (existing !== undefined) return existing;
    const mint = this.#mint(cacheKey, installationId, repo, now);
    this.#inFlight.set(cacheKey, mint);
    try {
      return await mint;
    } finally {
      this.#inFlight.delete(cacheKey);
    }
  }

  async #mint(
    cacheKey: string,
    installationId: number,
    repo: string,
    now: number,
  ): Promise<string> {
    const repoName = /^[^/]+\/([^/]+)$/u.exec(repo)?.[1];
    if (repoName === undefined) throw new Error('repository must be owner/name');
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.#requestTimeoutMs);
    timer.unref();
    let status: number;
    let result:
      | {
          token?: unknown;
          expires_at?: unknown;
          permissions?: { issues?: unknown };
        }
      | undefined;
    try {
      const response = await fetch(
        `${this.#baseUrl}/app/installations/${installationId}/access_tokens`,
        {
          method: 'POST',
          headers: {
            accept: 'application/vnd.github+json',
            authorization: `Bearer ${this.#jwt(now)}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            repositories: [repoName],
            permissions: { issues: 'write' },
          }),
          signal: controller.signal,
        },
      );
      status = response.status;
      if (response.ok) {
        result = (await response.json()) as {
          token?: unknown;
          expires_at?: unknown;
          permissions?: { issues?: unknown };
        };
      }
    } finally {
      clearTimeout(timer);
    }
    if (result === undefined) {
      this.#cache.delete(cacheKey);
      throw new Error(`GitHub installation token failed with ${status}`);
    }
    if (
      typeof result.token !== 'string' ||
      typeof result.expires_at !== 'string' ||
      result.permissions?.issues !== 'write'
    ) {
      throw new Error('GitHub returned an invalid installation token');
    }
    const expiresAt = Date.parse(result.expires_at);
    if (!Number.isFinite(expiresAt)) throw new Error('GitHub returned an invalid token expiry');
    this.#cache.set(cacheKey, { token: result.token, expiresAt });
    return result.token;
  }

  #jwt(nowMilliseconds: number): string {
    const nowSeconds = Math.floor(nowMilliseconds / 1000);
    const header = encodeJson({ alg: 'RS256', typ: 'JWT' });
    const payload = encodeJson({
      iat: nowSeconds - 60,
      exp: nowSeconds + 9 * 60,
      iss: this.#appId,
    });
    const unsigned = `${header}.${payload}`;
    const signature = sign('RSA-SHA256', Buffer.from(unsigned), this.#privateKey).toString(
      'base64url',
    );
    return `${unsigned}.${signature}`;
  }
}
