import { describe, expect, it } from 'vitest';

import { createReviewJob } from '../../src/pr-review/invoke.js';
import { createVendorRunner, type RawSpawn } from '../../src/pr-review/spawn.js';

const JOB = createReviewJob('You review a pull request.');
const CLEAN_REVIEW = JSON.stringify({ verdict: 'reviewed', findings: [] });

/** Records argv and returns a scripted child result. */
function recordingSpawn(result: { status: number | null; stdout: string }): {
  calls: { binary: string; argv: string[] }[];
  spawn: RawSpawn;
} {
  const calls: { binary: string; argv: string[] }[] = [];
  return {
    calls,
    spawn: (binary, argv) => {
      calls.push({ binary, argv });
      return result;
    },
  };
}

describe('the headless vendor adapter (36EEMY)', () => {
  it('runs codex with the review schema and the arcade broker attached', async () => {
    const files = new Map<string, string>();
    const { calls, spawn } = recordingSpawn({ status: 0, stdout: '' });

    const run = createVendorRunner({
      vendor: 'codex',
      cwd: '/tmp/review',
      env: {},
      executionTier: 'degrade',
      mcpServers: '{"arcade":{"url":"https://api.arcade.dev/mcp"}}',
      spawn,
      writeFile: (path, content) => files.set(path, content),
      readFile: () => CLEAN_REVIEW,
    });

    const result = await run(JOB, 'a diff');

    expect(calls[0]?.binary).toBe('codex');
    const argv = calls[0]?.argv ?? [];
    expect(argv).toContain('exec');
    // The reviewer needs a real broker to read the tracker — retro disables MCP.
    expect(argv).toContain('mcp_servers={"arcade":{"url":"https://api.arcade.dev/mcp"}}');
    expect(result.ok).toBe(true);
    expect(result.output).toMatchObject({ verdict: 'reviewed' });
  });

  it('tiers the sandbox by whether the code may be executed', async () => {
    const read = () => CLEAN_REVIEW;
    const degraded = recordingSpawn({ status: 0, stdout: '' });
    await createVendorRunner({
      vendor: 'codex',
      cwd: '/tmp/r',
      env: {},
      executionTier: 'degrade',
      spawn: degraded.spawn,
      writeFile: () => {},
      readFile: read,
    })(JOB, 'd');

    const executing = recordingSpawn({ status: 0, stdout: '' });
    await createVendorRunner({
      vendor: 'codex',
      cwd: '/tmp/r',
      env: {},
      executionTier: 'execute',
      spawn: executing.spawn,
      writeFile: () => {},
      readFile: read,
    })(JOB, 'd');

    const sandboxOf = (calls: { argv: string[] }[]) => {
      const argv = calls[0]?.argv ?? [];
      return argv[argv.indexOf('--sandbox') + 1];
    };

    // A fork is read-only. Raising it is the pwn-request surface SM1.R3 guards.
    expect(sandboxOf(degraded.calls)).toBe('read-only');
    expect(sandboxOf(executing.calls)).toBe('workspace-write');
  });

  const allowedToolsOf = (argv: string[]): string =>
    argv[argv.indexOf('--allowed-tools') + 1] ?? '';

  it('grants the trusted tier full tools, so it can run the project’s own suite', async () => {
    const { calls, spawn } = recordingSpawn({
      status: 0,
      stdout: JSON.stringify({ result: CLEAN_REVIEW }),
    });

    await createVendorRunner({
      vendor: 'claude',
      cwd: '/tmp/r',
      env: {},
      executionTier: 'execute',
      spawn,
      writeFile: () => {},
      readFile: () => '',
    })(JOB, 'a diff');

    // R13's fix gate runs the tests a patch could break; R17 exercises the
    // project. Both need Bash. Read-only made those gates untestable in prod.
    const tools = allowedToolsOf(calls[0]?.argv ?? []);
    expect(tools).toContain('Bash');
    expect(tools).toContain('Read');
  });

  it('withholds execution on a fork — read-only, the pwn-request tripwire', async () => {
    const { calls, spawn } = recordingSpawn({
      status: 0,
      stdout: JSON.stringify({ result: CLEAN_REVIEW }),
    });

    await createVendorRunner({
      vendor: 'claude',
      cwd: '/tmp/r',
      env: {},
      executionTier: 'degrade',
      spawn,
      writeFile: () => {},
      readFile: () => '',
    })(JOB, 'a diff');

    // Reading a fork's tree is safe; executing it with a credential present is
    // the exact act SM1.R3 forbids. Grep/Glob are reads; Bash is not.
    const tools = allowedToolsOf(calls[0]?.argv ?? []);
    expect(tools).toContain('Read');
    expect(tools).not.toContain('Bash');
  });

  it('runs claude with the injected prompt and no --bare', async () => {
    const { calls, spawn } = recordingSpawn({
      status: 0,
      stdout: JSON.stringify({ result: CLEAN_REVIEW }),
    });

    const result = await createVendorRunner({
      vendor: 'claude',
      cwd: '/tmp/r',
      env: {},
      executionTier: 'degrade',
      spawn,
      writeFile: () => {},
      readFile: () => '',
    })(JOB, 'a diff');

    expect(calls[0]?.binary).toBe('claude');
    // --bare skips the managed-provider setup cloud containers authenticate
    // through; retro proved that live.
    expect(calls[0]?.argv).not.toContain('--bare');
    expect(calls[0]?.argv).toContain('You review a pull request.');
    expect(result.ok).toBe(true);
  });

  it('reports a non-zero exit as a failure, never as an empty review', async () => {
    const { spawn } = recordingSpawn({ status: 1, stdout: '' });

    const result = await createVendorRunner({
      vendor: 'codex',
      cwd: '/tmp/r',
      env: {},
      executionTier: 'degrade',
      spawn,
      writeFile: () => {},
      readFile: () => '',
    })(JOB, 'd');

    // The whole reason createVendorReview throws downstream: an errored vendor
    // whose empty result posts as `reviewed` is a clean bill of health for a
    // review that never happened.
    expect(result.ok).toBe(false);
    expect(result.output).toBeUndefined();
  });

  it('never puts a credential in argv, where it would reach process listings and logs', async () => {
    const { calls, spawn } = recordingSpawn({ status: 0, stdout: '' });

    await createVendorRunner({
      vendor: 'codex',
      cwd: '/tmp/r',
      env: { CODEX_API_KEY: 'sk-secret-value', ARCADE_API_KEY: 'arc-secret' },
      executionTier: 'degrade',
      spawn,
      writeFile: () => {},
      readFile: () => CLEAN_REVIEW,
    })(JOB, 'd');

    const argv = (calls[0]?.argv ?? []).join(' ');
    expect(argv).not.toContain('sk-secret-value');
    expect(argv).not.toContain('arc-secret');
  });
});
