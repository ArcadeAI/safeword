import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory } from '../../tests/helpers.js';
import {
  buildPublicRetroSource,
  collectPublicGitContext,
  normalizeRepoRemote,
  selectPublicUserIdentity,
} from './public-source.js';

describe('buildPublicRetroSource', () => {
  it('builds the closed local profile from project config, Git, and runtime metadata', () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'));
    mkdirSync(nodePath.join(directory, '.git'));
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ projectUUID: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA' }),
    );
    writeFileSync(
      nodePath.join(directory, '.git', 'config'),
      '[remote "origin"]\nurl = git@github.com:ArcadeAI/safeword.git\n[user]\nemail = dev@example.com\n',
    );

    expect(
      buildPublicRetroSource(directory, {
        agentVersion: ' 1.2.3 ',
        cliVersion: ' 0.79.0 ',
        environment: { GIT_CONFIG_GLOBAL: '/fixture/missing' },
        harness: 'codex',
        model: ' gpt-fixture ',
        osFamily: ' darwin ',
        pluginVersion: ' 0.79.0 ',
      }),
    ).toEqual({
      agentVersion: '1.2.3',
      harness: 'codex',
      hostClass: 'local',
      model: 'gpt-fixture',
      osFamily: 'darwin',
      projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      repository: 'github.com/arcadeai/safeword',
      safewordCliVersion: '0.79.0',
      safewordPluginVersion: '0.79.0',
      userIdentity: 'dev@example.com',
    });
  });

  it('prefers a verified runtime identity over Git email', () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'));
    mkdirSync(nodePath.join(directory, '.git'));
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
    );
    writeFileSync(nodePath.join(directory, '.git', 'config'), '[user]\nemail = git@example.com\n');

    expect(
      buildPublicRetroSource(directory, {
        cliVersion: '0.79.0',
        environment: { GIT_CONFIG_GLOBAL: '/fixture/missing' },
        harness: 'codex',
        osFamily: 'darwin',
        runtimeIdentity: 'octocat',
      }),
    ).toMatchObject({ userIdentity: 'octocat' });
  });

  it('returns no source when public collection is disabled', () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'));
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({
        projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        publicRetrospectiveCollection: false,
      }),
    );

    expect(
      buildPublicRetroSource(directory, {
        cliVersion: '0.79.0',
        harness: 'codex',
        osFamily: 'darwin',
        runtimeIdentity: 'octocat',
      }),
    ).toBeUndefined();
  });
});

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
    ['/home/alice/Projects/client@acme:internal-tool', undefined],
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

describe('collectPublicGitContext', () => {
  const noGlobalConfig = { environment: { GIT_CONFIG_GLOBAL: '/fixture/missing' } };

  it('reads repository identity and local email from the repository Git config', () => {
    const directory = createTemporaryDirectory();
    const gitDirectory = nodePath.join(directory, '.git');
    mkdirSync(gitDirectory);
    writeFileSync(
      nodePath.join(gitDirectory, 'config'),
      `[remote "origin"]
  url = https://x-access-token:fixture-secret@github.com/ArcadeAI/Safeword.git
[user]
  email = local@example.com
`,
    );

    expect(collectPublicGitContext(directory, noGlobalConfig)).toEqual({
      repository: 'github.com/arcadeai/safeword',
      localEmail: 'local@example.com',
    });
  });

  it('normalizes quoted values and strips trailing Git comments', () => {
    const directory = createTemporaryDirectory();
    const gitDirectory = nodePath.join(directory, '.git');
    mkdirSync(gitDirectory);
    writeFileSync(
      nodePath.join(gitDirectory, 'config'),
      '[remote "origin"]\nurl = "git@github.com:ArcadeAI/safeword.git" # primary\n[user]\nemail = dev@example.com ; local\n',
    );

    expect(collectPublicGitContext(directory, noGlobalConfig)).toEqual({
      repository: 'github.com/arcadeai/safeword',
      localEmail: 'dev@example.com',
    });
  });

  it('omits Git email when a consulted config delegates through an include', () => {
    const directory = createTemporaryDirectory();
    const gitDirectory = nodePath.join(directory, '.git');
    mkdirSync(gitDirectory);
    writeFileSync(
      nodePath.join(gitDirectory, 'config'),
      `[include]
  path = /private/identity
[remote "origin"]
  url = git@github.com:ArcadeAI/safeword.git
[user]
  email = local@example.com
`,
    );

    const globalConfig = nodePath.join(directory, 'global.gitconfig');
    writeFileSync(globalConfig, '[user]\n  email = global@example.com\n');

    expect(
      collectPublicGitContext(directory, {
        environment: { GIT_CONFIG_GLOBAL: globalConfig },
      }),
    ).toEqual({
      repository: 'github.com/arcadeai/safeword',
    });
  });

  it('omits Git email when delegation is written beside its section header', () => {
    const directory = createTemporaryDirectory();
    const gitDirectory = nodePath.join(directory, '.git');
    const globalConfig = nodePath.join(directory, 'global.gitconfig');
    mkdirSync(gitDirectory);
    writeFileSync(
      nodePath.join(gitDirectory, 'config'),
      '[include] path = /private/identity\n[user] email = local@example.com\n',
    );
    writeFileSync(globalConfig, '[user]\nemail = global@example.com\n');

    expect(
      collectPublicGitContext(directory, {
        environment: { GIT_CONFIG_GLOBAL: globalConfig },
      }),
    ).toEqual({});
  });

  it('omits Git email for whitespace variants and unquoted continuations', () => {
    const directory = createTemporaryDirectory();
    const gitDirectory = nodePath.join(directory, '.git');
    mkdirSync(gitDirectory);
    writeFileSync(
      nodePath.join(gitDirectory, 'config'),
      '[includeIf\t"gitdir:~/work/"] path = /private/identity\n[user]\nemail = leaked\\\n',
    );

    expect(collectPublicGitContext(directory, noGlobalConfig)).toEqual({});
  });

  it('ignores a symlinked Git directory', () => {
    const directory = createTemporaryDirectory();
    const foreign = createTemporaryDirectory();
    mkdirSync(nodePath.join(foreign, '.git'));
    writeFileSync(nodePath.join(foreign, '.git/config'), '[user]\nemail = foreign@example.com\n');
    symlinkSync(nodePath.join(foreign, '.git'), nodePath.join(directory, '.git'));

    expect(collectPublicGitContext(directory, noGlobalConfig)).toEqual({});
  });

  it('ignores a symlinked repository config', () => {
    const directory = createTemporaryDirectory();
    const foreign = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.git'));
    writeFileSync(nodePath.join(foreign, 'config'), '[user]\nemail = foreign@example.com\n');
    symlinkSync(nodePath.join(foreign, 'config'), nodePath.join(directory, '.git/config'));

    expect(collectPublicGitContext(directory, noGlobalConfig)).toEqual({});
  });

  it('follows linked-worktree gitdir and commondir pointers', () => {
    const directory = createTemporaryDirectory();
    const commonDirectory = nodePath.join(directory, '.bare');
    const worktreeGitDirectory = nodePath.join(commonDirectory, 'worktrees/client');
    mkdirSync(worktreeGitDirectory, { recursive: true });
    writeFileSync(nodePath.join(directory, '.git'), `gitdir: ${worktreeGitDirectory}\n`);
    writeFileSync(nodePath.join(worktreeGitDirectory, 'commondir'), '../..\n');
    writeFileSync(nodePath.join(worktreeGitDirectory, 'gitdir'), nodePath.join(directory, '.git'));
    writeFileSync(
      nodePath.join(commonDirectory, 'config'),
      `[remote "origin"]
  url = git@gitlab.example:Team/Repo.git
[user]
  email = worktree@example.com
`,
    );

    expect(collectPublicGitContext(directory, noGlobalConfig)).toEqual({
      repository: 'gitlab.example/Team/Repo',
      localEmail: 'worktree@example.com',
    });
  });

  it('ignores a gitdir pointer that does not prove it belongs to this worktree', () => {
    const directory = createTemporaryDirectory();
    const foreign = createTemporaryDirectory();
    mkdirSync(nodePath.join(foreign, '.git'));
    writeFileSync(nodePath.join(foreign, '.git/config'), '[user]\nemail = foreign@example.com\n');
    writeFileSync(nodePath.join(directory, '.git'), `gitdir: ${nodePath.join(foreign, '.git')}\n`);

    expect(collectPublicGitContext(directory, noGlobalConfig)).toEqual({});
  });

  it('reads the explicit global Git config without invoking Git', () => {
    const directory = createTemporaryDirectory();
    const gitDirectory = nodePath.join(directory, '.git');
    const globalConfig = nodePath.join(directory, 'fixture-global.gitconfig');
    mkdirSync(gitDirectory);
    writeFileSync(nodePath.join(gitDirectory, 'config'), '[core]\n  bare = false\n');
    writeFileSync(globalConfig, '[user]\n  email = global@example.com\n');

    expect(
      collectPublicGitContext(directory, {
        environment: { GIT_CONFIG_GLOBAL: globalConfig },
        homeDirectory: nodePath.join(directory, 'unused-home'),
      }),
    ).toEqual({ globalEmail: 'global@example.com' });
  });

  it('ignores relative global config environment paths', () => {
    const directory = createTemporaryDirectory();
    const gitDirectory = nodePath.join(directory, '.git');
    mkdirSync(gitDirectory);
    writeFileSync(nodePath.join(gitDirectory, 'config'), '[core]\nbare = false\n');

    expect(
      collectPublicGitContext(directory, {
        environment: {
          GIT_CONFIG_GLOBAL: 'git/config',
          XDG_CONFIG_HOME: 'relative-config',
        },
        homeDirectory: nodePath.join(directory, 'missing-home'),
      }),
    ).toEqual({});
  });

  it('omits a global email when global config delegates identity', () => {
    const directory = createTemporaryDirectory();
    const gitDirectory = nodePath.join(directory, '.git');
    const globalConfig = nodePath.join(directory, 'global.gitconfig');
    mkdirSync(gitDirectory);
    writeFileSync(nodePath.join(gitDirectory, 'config'), '[core]\nbare = false\n');
    writeFileSync(
      globalConfig,
      '[includeIf "gitdir:~/work/"]\npath = /private/identity\n[user]\nemail = global@example.com\n',
    );

    expect(
      collectPublicGitContext(directory, {
        environment: { GIT_CONFIG_GLOBAL: globalConfig },
      }),
    ).toEqual({});
  });

  it('reads standard global configs with home config taking precedence over XDG', () => {
    const directory = createTemporaryDirectory();
    const gitDirectory = nodePath.join(directory, '.git');
    const homeDirectory = nodePath.join(directory, 'home');
    const xdgDirectory = nodePath.join(directory, 'xdg');
    mkdirSync(gitDirectory);
    mkdirSync(nodePath.join(xdgDirectory, 'git'), { recursive: true });
    mkdirSync(homeDirectory);
    writeFileSync(nodePath.join(gitDirectory, 'config'), '[core]\nbare = false\n');
    writeFileSync(nodePath.join(xdgDirectory, 'git/config'), '[user]\nemail = xdg@example.com\n');
    writeFileSync(nodePath.join(homeDirectory, '.gitconfig'), '[user]\nemail = home@example.com\n');

    expect(
      collectPublicGitContext(directory, {
        environment: { XDG_CONFIG_HOME: xdgDirectory },
        homeDirectory,
      }),
    ).toEqual({ globalEmail: 'home@example.com' });
  });
});
