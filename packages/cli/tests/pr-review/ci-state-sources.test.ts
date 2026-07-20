import { describe, expect, it } from 'vitest';

import { fetchCheckRuns, fetchCommitStatuses } from '../../src/pr-review/github.js';
import type { GitHubRequest } from '../../src/pr-review/poster.js';
import { computeCiState } from '../../src/pr-review/trigger.js';

const CONTEXT = { owner: 'acme', repo: 'monorepo' };

describe('reading CI state completely (36EEMY)', () => {
  it('paginates check-runs — a failure on page 2 must not read as green', async () => {
    // The concrete "reviews RED code" input. A matrix-heavy monorepo routinely
    // exceeds 100 check runs on one commit; with a single unpaginated request
    // the list truncates, every RETURNED check passes, and the all-checks tier
    // computes 'green' while CI is red.
    const paths: string[] = [];
    const page1 = Array.from({ length: 100 }, (_, index) => ({
      name: `check-${index}`,
      conclusion: 'success',
    }));
    const request: GitHubRequest = (_method, path) => {
      paths.push(path);
      const isSecondPage = path.includes('page=2');
      return Promise.resolve({
        total_count: 101,
        check_runs: isSecondPage ? [{ name: 'slow-e2e', conclusion: 'failure' }] : page1,
      });
    };

    const checks = await fetchCheckRuns(request, CONTEXT, 'sha');

    expect(paths.length).toBeGreaterThan(1);
    expect(checks).toHaveLength(101);
    expect(computeCiState(checks, undefined)).toBe('red');
  });

  it('stops paginating once every check is collected', async () => {
    const paths: string[] = [];
    const request: GitHubRequest = (_method, path) => {
      paths.push(path);
      return Promise.resolve({
        total_count: 2,
        check_runs: [
          { name: 'a', conclusion: 'success' },
          { name: 'b', conclusion: 'success' },
        ],
      });
    };

    await fetchCheckRuns(request, CONTEXT, 'sha');

    expect(paths).toHaveLength(1);
  });

  it('reads legacy commit statuses, which are not check-runs at all', async () => {
    // Ruleset `required_status_checks` contexts routinely name commit STATUSES
    // (CircleCI, Buildkite, Jenkins, Vercel). Those never appear in
    // /check-runs, so a required context that is a status stays permanently
    // unmatched and the reviewer waits for a green that never arrives.
    const request: GitHubRequest = () =>
      Promise.resolve({
        statuses: [
          { context: 'ci/circleci: build', state: 'success' },
          { context: 'vercel', state: 'pending' },
        ],
      });

    await expect(fetchCommitStatuses(request, CONTEXT, 'sha')).resolves.toEqual([
      { name: 'ci/circleci: build', conclusion: 'success' },
      { name: 'vercel', conclusion: undefined },
    ]);
  });

  it('maps a failed commit status to a failure conclusion', async () => {
    const request: GitHubRequest = () =>
      Promise.resolve({
        statuses: [
          { context: 'ci/jenkins', state: 'failure' },
          { context: 'legacy', state: 'error' },
        ],
      });

    const statuses = await fetchCommitStatuses(request, CONTEXT, 'sha');
    expect(computeCiState(statuses, ['ci/jenkins'])).toBe('red');
    expect(computeCiState(statuses, ['legacy'])).toBe('red');
  });

  it('a required context satisfied only by a commit status resolves green once merged', () => {
    // The end state this exists for: check-runs and statuses combined are what
    // the required set is evaluated against.
    const checks = [{ name: 'build', conclusion: 'success' as const }];
    const statuses = [{ name: 'ci/circleci: test', conclusion: 'success' as const }];

    expect(computeCiState(checks, ['build', 'ci/circleci: test'])).toBe('pending');
    expect(computeCiState([...checks, ...statuses], ['build', 'ci/circleci: test'])).toBe('green');
  });
});
