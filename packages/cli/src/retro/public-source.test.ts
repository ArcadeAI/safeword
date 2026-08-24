import { describe, expect, it } from 'vitest';

import { normalizeRepoRemote, selectPublicUserIdentity } from './public-source.js';

describe('normalizeRepoRemote', () => {
  it.each([
    ['git@github.com:ArcadeAI/safeword.git', 'github.com/arcadeai/safeword'],
    ['https://github.com/ArcadeAI/safeword/', 'github.com/arcadeai/safeword'],
    ['ssh://git@github.com/ArcadeAI/safeword.git', 'github.com/arcadeai/safeword'],
    ['git@gitlab.example:Team/Repo.git', 'gitlab.example/Team/Repo'],
    ['https://gitlab.example/Team/Repo.git', 'gitlab.example/Team/Repo'],
    [
      'https://user@gitlab.example:443/Team/Repo.git?token=ghp_fixture_secret_1234567890#readme',
      'gitlab.example/Team/Repo',
    ],
    [
      'https://x-access-token:ghp_fixture_secret_1234567890@github.com/ArcadeAI/Safeword.git',
      'github.com/arcadeai/safeword',
    ],
    ['https://GitHub.COM/ArcadeAI/Safeword.git', 'github.com/arcadeai/safeword'],
    ['https://Evil-GitHub.com/Team/Repo.git', 'evil-github.com/Team/Repo'],
    ['https://api.github.com/Team/Repo.git', 'api.github.com/Team/Repo'],
    ['/Users/fixture/private/repo', undefined],
    ['file:///Users/fixture/private/repo', undefined],
    ['://malformed remote', undefined],
    ['../safeword', undefined],
  ])('normalizes %s without exposing credentials', (remote, expected) => {
    expect(normalizeRepoRemote(remote)).toBe(expected);
  });
});

describe('selectPublicUserIdentity', () => {
  it.each([
    ['octocat', 'local@example.com', 'global@example.com', 'octocat'],
    ['octocat', undefined, undefined, 'octocat'],
    [' '.repeat(3), 'local@example.com', 'global@example.com', 'local@example.com'],
    ['', 'local@example.com', 'global@example.com', 'local@example.com'],
    [' '.repeat(3), undefined, 'global@example.com', 'global@example.com'],
    ['', undefined, 'global@example.com', 'global@example.com'],
    [undefined, 'local@example.com', 'global@example.com', 'local@example.com'],
    [undefined, undefined, 'global@example.com', 'global@example.com'],
    [undefined, ' '.repeat(3), 'global@example.com', 'global@example.com'],
    [undefined, ' '.repeat(3), undefined, undefined],
    [undefined, undefined, ' '.repeat(3), undefined],
    [undefined, undefined, undefined, undefined],
  ])(
    'prefers runtime identity, then local email, then global email',
    (runtimeIdentity, localEmail, globalEmail, expected) => {
      expect(selectPublicUserIdentity(runtimeIdentity, localEmail, globalEmail)).toBe(expected);
    },
  );
});
