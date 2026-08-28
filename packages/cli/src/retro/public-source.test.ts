import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory } from '../../tests/helpers.js';
import { buildPublicRetroEnvelope } from './public-delivery.js';
import {
  buildPublicRetroSource,
  collectPublicGitContext,
  normalizeRepoRemote,
} from './public-source.js';

describe('buildPublicRetroSource', () => {
  it('builds the closed current profile without user identity', () => {
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
        harness: 'codex',
        model: ' gpt-fixture ',
        osFamily: ' darwin ',
      }),
    ).toEqual({
      agentVersion: '1.2.3',
      harness: 'codex',
      hostClass: 'unknown',
      model: 'gpt-fixture',
      osFamily: 'darwin',
      projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      repository: 'github.com/arcadeai/safeword',
      safewordCliVersion: '0.79.0',
    });
  });

  it('does not emit runtime identity or Git email', () => {
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
        harness: 'codex',
        osFamily: 'darwin',
      }),
    ).not.toHaveProperty('userIdentity');
  });

  it.each([
    [256, true],
    [257, false],
  ] as const)('bounds derived optional context at %i UTF-8 bytes', (byteLength, retained) => {
    const directory = createTemporaryDirectory();
    const repo = `gitlab.com/team/${'r'.repeat(byteLength - 'gitlab.com/team/'.length)}`;
    mkdirSync(nodePath.join(directory, '.safeword'));
    mkdirSync(nodePath.join(directory, '.git'));
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
    );
    writeFileSync(
      nodePath.join(directory, '.git', 'config'),
      `[remote "origin"]\nurl = https://${repo}.git\n`,
    );

    const source = buildPublicRetroSource(directory, {
      cliVersion: '0.79.0',
      harness: 'codex',
      osFamily: 'darwin',
    });
    if (source === undefined) throw new TypeError('expected public source');
    const envelope = JSON.parse(
      new TextDecoder().decode(
        buildPublicRetroEnvelope({ finding: 'fixture', sessionId: 'session-fixture', source })
          .bytes,
      ),
    ) as { source: Record<string, unknown> };

    expect(envelope.source.repository === repo).toBe(retained);
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
      }),
    ).toBeUndefined();
  });
});

describe('normalizeRepoRemote', () => {
  it.each([
    ['git@github.com:ArcadeAI/safeword.git', 'github.com/arcadeai/safeword'],
    ['github.com:ArcadeAI/safeword.git', 'github.com/arcadeai/safeword'],
    ['https://github.com/ArcadeAI/safeword/', 'github.com/arcadeai/safeword'],
    ['ssh://git@github.com/ArcadeAI/safeword.git', 'github.com/arcadeai/safeword'],
    [
      'https://x-access-token:ghp_fixture_secret_1234567890@github.com/ArcadeAI/Safeword.git',
      'github.com/arcadeai/safeword',
    ],
    ['https://GitHub.COM/ArcadeAI/Safeword.git', 'github.com/arcadeai/safeword'],
  ])('canonicalizes the supported GitHub remote %s', (remote, expected) => {
    expect(normalizeRepoRemote(remote)).toBe(expected);
  });

  it('preserves the public path of a supported GitLab remote', () => {
    expect(normalizeRepoRemote('git@gitlab.com:Team/Repo.git')).toBe('gitlab.com/Team/Repo');
  });

  it.each([
    ['https://gitlab.example/Team/Repo.git', undefined],
    [
      'https://user@gitlab.example:443/Team/Repo.git?token=ghp_fixture_secret_1234567890#readme',
      undefined,
    ],
    ['https://Evil-GitHub.com/Team/Repo.git', undefined],
    ['https://api.github.com/Team/Repo.git', undefined],
    ['https://github.com.attacker-9f2c.test/team/repo.git', undefined],
    ['/Users/fixture/private/repo', undefined],
    ['/home/alice/Projects/client@acme:internal-tool', undefined],
    ['file:///Users/fixture/private/repo', undefined],
    ['://malformed remote', undefined],
    ['../safeword', undefined],
    ['https://github.com/team/repo/extra', undefined],
    ['https://github.com/team//repo', undefined],
    ['https://github.com/team%2Frepo/project', undefined],
  ])('omits the unsupported repository remote %s', (remote, expected) => {
    expect(normalizeRepoRemote(remote)).toBe(expected);
  });
});

describe('collectPublicGitContext', () => {
  it('uses the first origin URL, matching Git config precedence', () => {
    const directory = createTemporaryDirectory();
    const gitDirectory = nodePath.join(directory, '.git');
    mkdirSync(gitDirectory);
    writeFileSync(
      nodePath.join(gitDirectory, 'config'),
      '[remote "origin"]\nurl = ssh://git@internal.example/team/repo.git\nurl = https://github.com/team/repo.git\n',
    );

    expect(collectPublicGitContext(directory)).toEqual({});
  });

  it('reads repository identity without local email from the repository Git config', () => {
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

    expect(collectPublicGitContext(directory)).toEqual({
      repository: 'github.com/arcadeai/safeword',
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

    expect(collectPublicGitContext(directory)).toEqual({
      repository: 'github.com/arcadeai/safeword',
    });
  });

  it('does not treat a case-distinct remote subsection as origin', () => {
    const directory = createTemporaryDirectory();
    const gitDirectory = nodePath.join(directory, '.git');
    mkdirSync(gitDirectory);
    writeFileSync(
      nodePath.join(gitDirectory, 'config'),
      '[remote "Origin"]\nurl = git@github.com:evil/leaked.git\n',
    );

    expect(collectPublicGitContext(directory)).toEqual({});
  });

  it('fails closed when the repository config declares a URL rewrite', () => {
    const directory = createTemporaryDirectory();
    const gitDirectory = nodePath.join(directory, '.git');
    mkdirSync(gitDirectory);
    writeFileSync(
      nodePath.join(gitDirectory, 'config'),
      '[url "https://internal.example/"]\ninsteadOf = https://github.com/\n[remote "origin"]\nurl = https://github.com/ArcadeAI/safeword.git\n',
    );

    expect(collectPublicGitContext(directory)).toEqual({});
  });

  it('fails closed when the repository config delegates through an include', () => {
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

    expect(collectPublicGitContext(directory)).toEqual({});
  });

  it('fails closed when delegation is written beside its section header', () => {
    const directory = createTemporaryDirectory();
    const gitDirectory = nodePath.join(directory, '.git');
    mkdirSync(gitDirectory);
    writeFileSync(
      nodePath.join(gitDirectory, 'config'),
      '[include] path = /private/config\n[remote "origin"] url = git@github.com:ArcadeAI/safeword.git\n',
    );

    expect(collectPublicGitContext(directory)).toEqual({});
  });

  it('omits Git email for whitespace variants and unquoted continuations', () => {
    const directory = createTemporaryDirectory();
    const gitDirectory = nodePath.join(directory, '.git');
    mkdirSync(gitDirectory);
    writeFileSync(
      nodePath.join(gitDirectory, 'config'),
      '[includeIf\t"gitdir:~/work/"] path = /private/identity\n[user]\nemail = leaked\\\n',
    );

    expect(collectPublicGitContext(directory)).toEqual({});
  });

  it('ignores a symlinked Git directory', () => {
    const directory = createTemporaryDirectory();
    const foreign = createTemporaryDirectory();
    mkdirSync(nodePath.join(foreign, '.git'));
    writeFileSync(
      nodePath.join(foreign, '.git/config'),
      '[remote "origin"]\nurl = git@github.com:evil/leaked.git\n',
    );
    symlinkSync(nodePath.join(foreign, '.git'), nodePath.join(directory, '.git'));

    expect(collectPublicGitContext(directory)).toEqual({});
  });

  it('ignores a symlinked repository config', () => {
    const directory = createTemporaryDirectory();
    const foreign = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.git'));
    writeFileSync(
      nodePath.join(foreign, 'config'),
      '[remote "origin"]\nurl = git@github.com:evil/leaked.git\n',
    );
    symlinkSync(nodePath.join(foreign, 'config'), nodePath.join(directory, '.git/config'));

    expect(collectPublicGitContext(directory)).toEqual({});
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
  url = git@gitlab.com:Team/Repo.git
[user]
  email = worktree@example.com
`,
    );

    expect(collectPublicGitContext(directory)).toEqual({
      repository: 'gitlab.com/Team/Repo',
    });
  });

  it('ignores a gitdir pointer that does not prove it belongs to this worktree', () => {
    const directory = createTemporaryDirectory();
    const foreign = createTemporaryDirectory();
    mkdirSync(nodePath.join(foreign, '.git'));
    writeFileSync(
      nodePath.join(foreign, '.git/config'),
      '[remote "origin"]\nurl = git@github.com:evil/leaked.git\n',
    );
    writeFileSync(nodePath.join(directory, '.git'), `gitdir: ${nodePath.join(foreign, '.git')}\n`);

    expect(collectPublicGitContext(directory)).toEqual({});
  });
});
