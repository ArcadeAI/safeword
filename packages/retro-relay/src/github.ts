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
}

function hasExactMarker(body: string | null, marker: string): boolean {
  return body?.split(/\r?\n/u).includes(marker) ?? false;
}

function hasNextPage(response: Response): boolean | undefined {
  const link = response.headers.get('link');
  if (link === null) return undefined;
  return link.split(',').some(value => /;\s*rel="next"/u.test(value));
}

const GITHUB_HEADERS = {
  accept: 'application/vnd.github+json',
  'user-agent': 'safeword-retro-relay',
  'x-github-api-version': '2022-11-28',
} as const;

export class GitHubRestClient {
  readonly #baseUrl: string;
  readonly #installationToken: GitHubRestClientOptions['installationToken'];

  constructor(options: GitHubRestClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/u, '');
    this.#installationToken = options.installationToken;
  }

  async createIssue(input: {
    repository: string;
    title: string;
    body: string;
    labels: string[];
    installationToken: string;
  }): Promise<number> {
    const response = await fetch(`${this.#baseUrl}/repos/${input.repository}/issues`, {
      method: 'POST',
      headers: {
        ...GITHUB_HEADERS,
        authorization: `Bearer ${input.installationToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: input.title, body: input.body, labels: input.labels }),
    });
    if (!response.ok) throw new Error(`GitHub create failed with ${response.status}`);
    const issue = (await response.json()) as Pick<GitHubIssue, 'number'>;
    return issue.number;
  }

  installationToken(installationId: number, repo: string): Promise<string> {
    return this.#installationToken(installationId, repo);
  }

  async scanExactMarker(input: {
    installationId: number;
    repository: string;
    marker: string;
  }): Promise<MarkerScan> {
    const token = await this.#installationToken(input.installationId, input.repository);
    const matches: number[] = [];
    for (let page = 1; ; page += 1) {
      const url = new URL(`${this.#baseUrl}/repos/${input.repository}/issues`);
      url.searchParams.set('state', 'all');
      url.searchParams.set('per_page', '100');
      url.searchParams.set('page', String(page));
      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            ...GITHUB_HEADERS,
            accept: 'application/vnd.github.raw+json',
            authorization: `Bearer ${token}`,
          },
        });
      } catch {
        return { complete: false, issueNumbers: [] };
      }
      if (!response.ok) return { complete: false, issueNumbers: [] };
      const issues = (await response.json()) as GitHubIssue[];
      for (const issue of issues) {
        if (issue.pull_request === undefined && hasExactMarker(issue.body, input.marker)) {
          matches.push(issue.number);
        }
      }
      const linkedNextPage = hasNextPage(response);
      if (linkedNextPage === false || (linkedNextPage === undefined && issues.length < 100)) {
        return { complete: true, issueNumbers: matches };
      }
    }
  }
}
