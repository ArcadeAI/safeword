import process from 'node:process';

/** Narrows an unvalidated GitHub JSON response before reading its fields. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`review-pr: ${name} is required`);
  return value;
}

export async function githubRequest(path: string, init?: RequestInit): Promise<unknown> {
  const token = requiredEnvironment('GITHUB_TOKEN');
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!response.ok) throw new Error(`review-pr: GitHub request failed (${response.status})`);
  return response.status === 204 ? undefined : response.json();
}

/** The pull request this workflow run was dispatched for. */
export function requiredPullNumber(): number {
  const pull = Number(requiredEnvironment('SAFEWORD_PR_NUMBER'));
  if (!Number.isSafeInteger(pull) || pull <= 0) throw new Error('review-pr: invalid pull number');
  return pull;
}
