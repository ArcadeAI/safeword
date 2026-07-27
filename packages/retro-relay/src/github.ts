interface GitHubIssue {
  number: number;
  body: string | null;
  pull_request?: unknown;
}

export interface MarkerScan {
  complete: boolean;
  issueNumbers: number[];
}

export interface GitHubRestClientOptions {
  baseUrl: string;
  installationToken: (installationId: number, repo: string) => Promise<string>;
  maxConcurrentRequests?: number;
  reconciliationMaxPages?: number;
  reconciliationTimeoutMs?: number;
  requestTimeoutMs?: number;
}

export class GitHubCreateError extends Error {
  readonly outcome: 'ambiguous' | 'rejected' | 'retryable';
  readonly status: number;

  constructor(status: number) {
    super(`GitHub create failed with ${status}`);
    this.status = status;
    if ([400, 404, 410].includes(status)) this.outcome = 'rejected';
    else if ([401, 403, 422, 429].includes(status)) this.outcome = 'retryable';
    else this.outcome = 'ambiguous';
  }
}

function hasExactMarker(body: string | null, marker: string): boolean {
  return body?.split(/\r?\n/u).includes(marker) ?? false;
}

function hasNextPage(link: string | null): boolean | undefined {
  if (link === null) return undefined;
  return link.split(',').some(value => /;\s*rel="next"/u.test(value));
}

const GITHUB_HEADERS = {
  accept: 'application/vnd.github+json',
  'user-agent': 'safeword-retro-relay',
  'x-github-api-version': '2022-11-28',
} as const;

function rejectAfter(milliseconds: number): Promise<never> {
  return new Promise((_resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DOMException('GitHub request deadline exceeded', 'AbortError'));
    }, milliseconds);
    timer.unref();
  });
}

export class GitHubRestClient {
  readonly #baseUrl: string;
  readonly #maxConcurrentRequests: number;
  readonly #reconciliationMaxPages: number;
  readonly #reconciliationTimeoutMs: number;
  readonly #requestTimeoutMs: number;
  readonly #installationToken: GitHubRestClientOptions['installationToken'];
  #activeRequests = 0;
  readonly #capacityWaiters: (() => void)[] = [];

  constructor(options: GitHubRestClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/u, '');
    this.#installationToken = options.installationToken;
    this.#maxConcurrentRequests = options.maxConcurrentRequests ?? 4;
    this.#reconciliationMaxPages = options.reconciliationMaxPages ?? 10;
    this.#reconciliationTimeoutMs = options.reconciliationTimeoutMs ?? 30_000;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
  }

  async #acquireCapacity(deadlineAt: number): Promise<void> {
    if (this.#activeRequests < this.#maxConcurrentRequests) {
      this.#activeRequests += 1;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs <= 0) {
        reject(new DOMException('GitHub request deadline exceeded', 'AbortError'));
        return;
      }
      const timer = setTimeout(() => {
        const index = this.#capacityWaiters.indexOf(grant);
        if (index !== -1) this.#capacityWaiters.splice(index, 1);
        reject(new DOMException('GitHub request deadline exceeded', 'AbortError'));
      }, remainingMs);
      timer.unref();
      const grant = () => {
        clearTimeout(timer);
        resolve();
      };
      this.#capacityWaiters.push(grant);
    });
  }

  #releaseCapacity(): void {
    const next = this.#capacityWaiters.shift();
    if (next === undefined) this.#activeRequests -= 1;
    else next();
  }

  async #withinDeadline<T>(operation: Promise<T>, deadlineAt: number): Promise<T> {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) throw new DOMException('GitHub request deadline exceeded', 'AbortError');
    return Promise.race([operation, rejectAfter(remainingMs)]);
  }

  async #request<T>(
    input: string | URL,
    init: RequestInit,
    consume: (response: Response) => Promise<T>,
    deadlineAt = Date.now() + this.#requestTimeoutMs,
  ): Promise<T> {
    await this.#acquireCapacity(deadlineAt);
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) {
      this.#releaseCapacity();
      throw new DOMException('GitHub request deadline exceeded', 'AbortError');
    }
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        controller.abort();
      },
      Math.min(this.#requestTimeoutMs, remainingMs),
    );
    timer.unref();
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      return await consume(response);
    } finally {
      clearTimeout(timer);
      this.#releaseCapacity();
    }
  }

  async createIssue(input: {
    repository: string;
    title: string;
    body: string;
    labels: string[];
    installationToken: string;
  }): Promise<number> {
    const result = await this.#request(
      `${this.#baseUrl}/repos/${input.repository}/issues`,
      {
        method: 'POST',
        headers: {
          ...GITHUB_HEADERS,
          authorization: `Bearer ${input.installationToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: input.title, body: input.body, labels: input.labels }),
      },
      async response => ({
        issue: response.ok ? ((await response.json()) as Pick<GitHubIssue, 'number'>) : undefined,
        status: response.status,
      }),
    );
    if (result.issue === undefined) throw new GitHubCreateError(result.status);
    return result.issue.number;
  }

  installationToken(installationId: number, repo: string): Promise<string> {
    return this.#installationToken(installationId, repo);
  }

  // eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Pagination completion, deadline, and page-budget checks form one fail-closed scan boundary.
  async scanExactMarker(input: {
    installationId: number;
    repository: string;
    marker: string;
  }): Promise<MarkerScan> {
    const scanDeadline = Date.now() + this.#reconciliationTimeoutMs;
    let token: string;
    try {
      token = await this.#withinDeadline(
        this.#installationToken(input.installationId, input.repository),
        scanDeadline,
      );
    } catch {
      return { complete: false, issueNumbers: [] };
    }
    const matches: number[] = [];
    for (let page = 1; page <= this.#reconciliationMaxPages; page += 1) {
      const remainingMs = scanDeadline - Date.now();
      if (remainingMs <= 0) return { complete: false, issueNumbers: [] };
      const url = new URL(`${this.#baseUrl}/repos/${input.repository}/issues`);
      url.searchParams.set('state', 'all');
      url.searchParams.set('per_page', '100');
      url.searchParams.set('page', String(page));
      let result: { issues: GitHubIssue[]; link: string | null; ok: boolean };
      try {
        result = await this.#request(
          url,
          {
            headers: {
              ...GITHUB_HEADERS,
              accept: 'application/vnd.github.raw+json',
              authorization: `Bearer ${token}`,
            },
          },
          async response => ({
            issues: response.ok ? ((await response.json()) as GitHubIssue[]) : [],
            link: response.headers.get('link'),
            ok: response.ok,
          }),
          scanDeadline,
        );
      } catch {
        return { complete: false, issueNumbers: [] };
      }
      if (!result.ok) return { complete: false, issueNumbers: [] };
      const { issues } = result;
      for (const issue of issues) {
        if (issue.pull_request === undefined && hasExactMarker(issue.body, input.marker)) {
          matches.push(issue.number);
        }
      }
      const linkedNextPage = hasNextPage(result.link);
      if (linkedNextPage === false || (linkedNextPage === undefined && issues.length < 100)) {
        return { complete: true, issueNumbers: matches };
      }
    }
    return { complete: false, issueNumbers: [] };
  }
}
