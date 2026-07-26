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

export class GitHubRestClient {
  readonly #baseUrl: string;
  readonly #installationToken: GitHubRestClientOptions['installationToken'];

  constructor(options: GitHubRestClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/u, '');
    this.#installationToken = options.installationToken;
  }

  async createIssue(input: {
    installationId: number;
    repository: string;
    title: string;
    body: string;
    labels: string[];
  }): Promise<number> {
    const token = await this.#installationToken(input.installationId, input.repository);
    const response = await fetch(`${this.#baseUrl}/repos/${input.repository}/issues`, {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: input.title, body: input.body, labels: input.labels }),
    });
    if (!response.ok) throw new Error(`GitHub create failed with ${response.status}`);
    const issue = (await response.json()) as Pick<GitHubIssue, 'number'>;
    return issue.number;
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
      if (issues.length < 100) return { complete: true, issueNumbers: matches };
    }
  }
}
