import { describe, expect, it } from 'vitest';

import { normalizeRepoRemote } from './public-source.js';

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
