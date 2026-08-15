import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';
import { blockChildren } from '../helpers/io-failure.js';

function installFakeGitHubCli(directory: string): { bin: string; log: string } {
  const bin = nodePath.join(directory, 'bin');
  const log = nodePath.join(directory, 'gh.log');
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, 'gh');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
printf '%s\n' "$*" >> "$SAFEWORD_GH_LOG"
case "$*" in
  "auth token")
    if [ "$SAFEWORD_GH_TOKEN_FAIL" = "1" ]; then
      exit 1
    fi
    printf 'keychain-token\n'
    ;;
  "api user --jq .login")
    if [ "$SAFEWORD_GH_AUTH_FAIL" = "1" ]; then
      exit 1
    fi
    printf 'alex\n'
    ;;
  "issue create "*)
    printf 'https://github.com/acme/demo/issues/321\n'
    ;;
  "issue view "*)
    exit 0
    ;;
  "repo view "*)
    printf 'private\n'
    ;;
  *)
    exit 0
    ;;
esac
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return { bin, log };
}

function configuredGitHubProject(directory: string): void {
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword/config.json'),
    `${JSON.stringify(
      {
        ticketBridge: {
          provider: 'github',
          body: 'minimal',
          target: { repo: 'acme/demo' },
        },
      },
      undefined,
      2,
    )}\n`,
  );
}

function githubEnvironment(
  fixture: ReturnType<typeof installFakeGitHubCli>,
): Record<string, string> {
  return {
    PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
    GITHUB_TOKEN: `ghp_${'a'.repeat(24)}`,
    SAFEWORD_GH_LOG: fixture.log,
    SAFEWORD_GH_AUTH_FAIL: '0',
    SAFEWORD_GH_TOKEN_FAIL: '0',
    SAFEWORD_NO_UPDATE_CHECK: '1',
  };
}

describe('configured public-command wiring', () => {
  it('drives tracker connect through Commander, config persistence, verification, and sidecar seed', async () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    const github = installFakeGitHubCli(directory);

    const result = await runCli(
      [
        'tracker',
        'connect',
        'github',
        '--repo',
        'acme/demo',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      { cwd: directory, env: githubEnvironment(github) },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'changed',
      changed: true,
      data: { command: 'tracker connect', provider: 'github', connected: true },
    });
    const configPath = nodePath.join(directory, '.safeword/config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(config).toMatchObject({
      ticketBridge: { provider: 'github', target: { repo: 'acme/demo' } },
    });
    const trackerMapPath = nodePath.join(directory, '.safeword/tracker-map.json');
    const trackerMap = JSON.parse(readFileSync(trackerMapPath, 'utf8'));
    expect(trackerMap).toEqual({ version: 1, issues: {} });
    expect(readFileSync(github.log, 'utf8')).toContain('api user --jq .login');
  });

  it('reports config and network effects when tracker verification fails', async () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    const github = installFakeGitHubCli(directory);

    const result = await runCli(
      [
        'tracker',
        'connect',
        'github',
        '--repo',
        'acme/demo',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      {
        cwd: directory,
        env: { ...githubEnvironment(github), SAFEWORD_GH_AUTH_FAIL: '1' },
      },
    );

    expect(result).toMatchObject({ exitCode: 1, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: true,
      effects: {
        files: [{ kind: 'create', target: '.safeword/config.json', operation: 'write' }],
        network: [{ kind: 'verify-auth', target: 'github', operation: 'read' }],
      },
      recovery: [
        {
          command: `safeword tracker connect 'github' --repo 'acme/demo' --cwd '${directory}'`,
          requires_human: false,
        },
      ],
    });
    expect(readFileSync(nodePath.join(directory, '.safeword/config.json'), 'utf8')).toContain(
      '"provider": "github"',
    );
    expect(readFileSync(github.log, 'utf8')).toContain('api user --jq .login');
  });

  it('reports completed connect effects when tracker-map seeding fails', async () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword/tracker-map.json'), { recursive: true });
    const github = installFakeGitHubCli(directory);

    const result = await runCli(
      [
        'tracker',
        'connect',
        'github',
        '--repo',
        'acme/demo',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      { cwd: directory, env: githubEnvironment(github) },
    );

    expect(result).toMatchObject({ exitCode: 1, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: true,
      effects: {
        files: [{ kind: 'create', target: '.safeword/config.json', operation: 'write' }],
        network: [{ kind: 'verify-auth', target: 'github', operation: 'read' }],
      },
      recovery: [
        {
          command: `safeword tracker connect 'github' --repo 'acme/demo' --cwd '${directory}'`,
          requires_human: false,
        },
      ],
    });
    expect(readFileSync(nodePath.join(directory, '.safeword/config.json'), 'utf8')).toContain(
      '"provider": "github"',
    );
    expect(readFileSync(github.log, 'utf8')).toContain('api user --jq .login');
  });

  it('preserves a populated tracker-map when reconnecting', async () => {
    const directory = createTemporaryDirectory();
    configuredGitHubProject(directory);
    const trackerMapPath = nodePath.join(directory, '.safeword/tracker-map.json');
    const trackerMap = `${JSON.stringify({
      version: 1,
      issues: {
        AB12CD: {
          ref: { provider: 'github', id: '321', url: 'https://github.com/acme/demo/issues/321' },
          status: 'recorded',
        },
      },
    })}\n`;
    writeFileSync(trackerMapPath, trackerMap);
    const github = installFakeGitHubCli(directory);

    const result = await runCli(
      [
        'tracker',
        'connect',
        'github',
        '--repo',
        'acme/demo',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      { cwd: directory, env: githubEnvironment(github) },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout).effects.files).not.toContainEqual(
      expect.objectContaining({ target: '.safeword/tracker-map.json' }),
    );
    expect(readFileSync(trackerMapPath, 'utf8')).toBe(trackerMap);
  });

  it('drives online tracker sync through the real corpus, writer, and sidecar collaborators', async () => {
    const directory = createTemporaryDirectory();
    configuredGitHubProject(directory);
    const github = installFakeGitHubCli(directory);
    const ticketDirectory = nodePath.join(directory, '.project/tickets/AB12CD-login');
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      ['---', 'id: AB12CD', 'type: task', 'status: in_progress', 'title: Login', '---', ''].join(
        '\n',
      ),
    );
    writeFileSync(
      nodePath.join(directory, '.safeword/tracker-map.json'),
      `${JSON.stringify({ version: 1, issues: {} }, undefined, 2)}\n`,
    );

    const result = await runCli(['tracker', 'sync', '--json', '--no-input', '--cwd', directory], {
      cwd: directory,
      env: githubEnvironment(github),
    });

    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'changed',
      changed: true,
      data: { command: 'tracker sync', provider: 'github' },
    });
    const trackerMapPath = nodePath.join(directory, '.safeword/tracker-map.json');
    const trackerMap = JSON.parse(readFileSync(trackerMapPath, 'utf8'));
    expect(trackerMap).toMatchObject({
      issues: {
        AB12CD: {
          ref: {
            provider: 'github',
            id: '321',
            url: 'https://github.com/acme/demo/issues/321',
          },
          status: 'recorded',
        },
      },
    });
    const calls = readFileSync(github.log, 'utf8');
    expect(calls).toContain('issue create');
    expect(calls).toContain('issue edit 321');
  });

  it('drives public tracker sync with GitHub CLI authentication and no token environment', async () => {
    const directory = createTemporaryDirectory();
    configuredGitHubProject(directory);
    const github = installFakeGitHubCli(directory);
    const ticketDirectory = nodePath.join(directory, '.project/tickets/AB12CD-keychain');
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      ['---', 'id: AB12CD', 'type: task', 'status: in_progress', 'title: Keychain', '---', ''].join(
        '\n',
      ),
    );
    writeFileSync(
      nodePath.join(directory, '.safeword/tracker-map.json'),
      `${JSON.stringify({ version: 1, issues: {} }, undefined, 2)}\n`,
    );
    const environment = githubEnvironment(github);
    delete environment.GITHUB_TOKEN;

    const result = await runCli(['tracker', 'sync', '--json', '--no-input', '--cwd', directory], {
      cwd: directory,
      env: environment,
    });

    expect(result.exitCode, result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'changed',
      data: { command: 'tracker sync', provider: 'github' },
    });
    const calls = readFileSync(github.log, 'utf8');
    expect(calls).toContain('auth token');
    expect(calls).toContain('issue create');
  });

  it('drives tracker-backed ticket creation through Commander and the live writer adapter', async () => {
    const directory = createTemporaryDirectory();
    configuredGitHubProject(directory);
    const github = installFakeGitHubCli(directory);

    const result = await runCli(
      [
        'ticket',
        'new',
        'tracker-backed',
        '--type',
        'task',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      { cwd: directory, env: githubEnvironment(github) },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'changed',
      changed: true,
      data: { command: 'ticket new', ticket_id: '321' },
    });
    expect(
      existsSync(nodePath.join(directory, '.project/tickets/321-tracker-backed/ticket.md')),
    ).toBe(true);
    const trackerMapPath = nodePath.join(directory, '.safeword/tracker-map.json');
    const trackerMap = JSON.parse(readFileSync(trackerMapPath, 'utf8'));
    expect(trackerMap).toMatchObject({
      issues: {
        '321': {
          ref: {
            provider: 'github',
            id: '321',
            url: 'https://github.com/acme/demo/issues/321',
          },
          status: 'recorded',
        },
      },
    });
    expect(readFileSync(github.log, 'utf8')).toContain('issue create');
  });

  it('reports a remote issue and pending sidecar when local ticket creation fails', async () => {
    const directory = createTemporaryDirectory();
    configuredGitHubProject(directory);
    blockChildren(nodePath.join(directory, '.project/tickets'));
    const github = installFakeGitHubCli(directory);

    {
      const result = await runCli(
        [
          'ticket',
          'new',
          'partial-ticket',
          '--type',
          'task',
          '--json',
          '--no-input',
          '--cwd',
          directory,
        ],
        { cwd: directory, env: githubEnvironment(github) },
      );

      expect(result).toMatchObject({ exitCode: 1, stderr: '' });
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'failed',
        changed: true,
        effects: {
          files: [{ kind: 'create', target: '.safeword/tracker-map.json', operation: 'write' }],
          network: [{ kind: 'issue-create', target: 'github', operation: 'write' }],
        },
        recovery: [
          {
            command: 'safeword tracker sync',
            requires_human: false,
          },
        ],
      });
      expect(readFileSync(github.log, 'utf8')).toContain('issue create');
      const sidecar = readFileSync(nodePath.join(directory, '.safeword/tracker-map.json'), 'utf8');
      expect(JSON.parse(sidecar)).toMatchObject({
        issues: {
          '321': { status: 'pending', ref: { provider: 'github', id: '321' } },
        },
      });
    }
  });

  it('preserves the configured ticket invocation when offline mode refuses its network path', async () => {
    const directory = createTemporaryDirectory();
    configuredGitHubProject(directory);
    const github = installFakeGitHubCli(directory);

    const result = await runCli(
      [
        'ticket',
        'new',
        'offline-safe',
        '--type',
        'task',
        '--title',
        "Alex's offline ticket",
        '--json',
        '--no-input',
        '--offline',
        '--cwd',
        directory,
      ],
      { cwd: directory, env: githubEnvironment(github) },
    );

    expect(result).toMatchObject({ exitCode: 2, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      changed: false,
      effects: { files: [], network: [] },
      next_actions: [
        {
          command: `safeword ticket new 'offline-safe' --type 'task' --title 'Alex'"'"'s offline ticket' --cwd '${directory}'`,
          mutates: true,
          requires_human: false,
        },
      ],
    });
    expect(existsSync(nodePath.join(directory, '.project'))).toBe(false);
    expect(existsSync(github.log)).toBe(false);
  });

  it.each([
    ['canonical command', ['retro', 'run']],
    ['retained alias', ['retro']],
  ] as const)(
    'drives retro run through extraction, egress, triage, and recoverable spooling via the %s',
    async (_label, command) => {
      const directory = createTemporaryDirectory();
      const github = installFakeGitHubCli(directory);
      const transcript = nodePath.join(directory, 'transcript.jsonl');
      const findings = nodePath.join(directory, 'findings.json');
      writeFileSync(transcript, '{"type":"user","message":"the gate omitted its source"}\n');
      writeFileSync(
        findings,
        JSON.stringify([
          {
            category: 'rough-edge',
            title: 'Coverage gate message omits file and number',
            safeword_surface: 'hooks/stop-quality.ts',
            what_happened: 'The coverage gate blocked with no file and no number.',
            why_friction: 'I could not tell the user how to unblock.',
            repro: 'safeword check after an edit that drops coverage',
          },
        ]),
      );

      const result = await runCli(
        [
          ...command,
          '--transcript',
          transcript,
          '--findings',
          findings,
          '--session-id',
          'configured-wiring',
          '--json',
          '--no-input',
          '--cwd',
          directory,
        ],
        {
          cwd: directory,
          env: {
            ...githubEnvironment(github),
            GITHUB_TOKEN: '',
            SAFEWORD_GH_TOKEN_FAIL: '1',
          },
        },
      );

      expect(result.exitCode, result.stdout).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'changed',
        changed: true,
        effects: {
          files: [
            {
              kind: 'create',
              target: `.safeword/retro-drafts/configured-wiring.jsonl`,
            },
          ],
        },
        data: {
          command: 'retro run',
          agent_filing_needed: true,
          result: {
            created: [],
            failed: ['Coverage gate message omits file and number'],
          },
        },
      });
      expect(
        existsSync(nodePath.join(directory, '.safeword/retro-drafts/configured-wiring.jsonl')),
      ).toBe(true);
    },
  );

  it('drives retro reconcile into the real credential/network composition root', async () => {
    const directory = createTemporaryDirectory();
    const github = installFakeGitHubCli(directory);

    const result = await runCli(
      ['retro', 'reconcile', '--json', '--no-input', '--cwd', directory],
      {
        cwd: directory,
        env: {
          ...githubEnvironment(github),
          GITHUB_TOKEN: '',
          SAFEWORD_GH_TOKEN_FAIL: '1',
        },
      },
    );

    expect(result).toMatchObject({ exitCode: 1, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: false,
      errors: [
        {
          code: 'RETRO_COMMAND_FAILED',
        },
      ],
    });
  });
});
