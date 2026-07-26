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
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export class GitHubAppTokenProvider {
  readonly #appId: string;
  readonly #baseUrl: string;
  readonly #cache = new Map<string, CachedToken>();
  readonly #now: () => number;
  readonly #privateKey: string;

  constructor(options: GitHubAppTokenProviderOptions) {
    this.#appId = options.appId;
    this.#baseUrl = options.baseUrl.replace(/\/$/u, '');
    this.#privateKey = options.privateKey;
    this.#now = options.now ?? Date.now;
  }

  // eslint-disable-next-line complexity -- Cache, response validation, and fail-closed token parsing stay at this boundary.
  async token(installationId: number, repo: string): Promise<string> {
    const cacheKey = `${installationId}:${repo}`;
    const cached = this.#cache.get(cacheKey);
    const now = this.#now();
    if (cached !== undefined && cached.expiresAt - now > 5 * 60_000) return cached.token;

    const repoName = /^[^/]+\/([^/]+)$/u.exec(repo)?.[1];
    if (repoName === undefined) throw new Error('repository must be owner/name');
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
      },
    );
    if (!response.ok) {
      this.#cache.delete(cacheKey);
      throw new Error(`GitHub installation token failed with ${response.status}`);
    }
    const result = (await response.json()) as {
      token?: unknown;
      expires_at?: unknown;
      permissions?: { issues?: unknown };
    };
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
