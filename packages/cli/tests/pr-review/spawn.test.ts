import { describe, expect, it, vi } from 'vitest';

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

  it('attaches the tracker gateway to claude by FILE PATH, never inline', async () => {
    const { calls, spawn } = recordingSpawn({
      status: 0,
      stdout: JSON.stringify({ result: CLEAN_REVIEW }),
    });

    // The config is passed as a path, and the tool-allow name is injected —
    // both because arcade.dev is a GATEWAY: the server name and endpoint are a
    // deployment detail (the real gateway is https://api.bosslevel.dev/mcp/gw_…),
    // and the config file carries a bearer token. Passing that JSON inline would
    // put the token in argv, i.e. the process listing — the exact leak the
    // credentials-never-in-argv test forbids.
    await createVendorRunner({
      vendor: 'claude',
      cwd: '/tmp/r',
      env: { ARCADE_API_KEY: 'arc-secret-value' },
      executionTier: 'degrade',
      mcpConfigPath: '/tmp/r/mcp.json',
      mcpToolGrant: 'mcp__arcade',
      spawn,
      writeFile: () => {},
      readFile: () => '',
    })(JOB, 'a diff');

    const argv = calls[0]?.argv ?? [];
    // Verified flag: claude -p attaches MCP via --mcp-config, and it takes a
    // path so the token stays on disk, out of the argument vector.
    expect(argv[argv.indexOf('--mcp-config') + 1]).toBe('/tmp/r/mcp.json');
    expect(argv.join(' ')).not.toContain('arc-secret-value');
    // The tracker tools must be allow-listed or the config is inert. R6's read
    // is safe on a fork (identity is not execution), so it is granted in both
    // tiers. The grant is injected, not "arcade" hardcoded.
    expect(allowedToolsOf(argv)).toContain('mcp__arcade');
  });

  it('omits --mcp-config entirely when no broker is configured', async () => {
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

    expect(calls[0]?.argv).not.toContain('--mcp-config');
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

  it('defaults the codex reviewer to gpt-5.6 Sol, not retro’s gpt-5.5', async () => {
    const { calls, spawn } = recordingSpawn({ status: 0, stdout: '' });

    await createVendorRunner({
      vendor: 'codex',
      cwd: '/tmp/r',
      env: {},
      executionTier: 'degrade',
      spawn,
      writeFile: () => {},
      readFile: () => CLEAN_REVIEW,
    })(JOB, 'd');

    // Sol is GPT-5.6’s coding + cybersecurity flagship; retro’s gpt-5.5 default
    // is the wrong tier for a reviewer that reads code and inspects auth paths.
    const argv = (calls[0]?.argv ?? []).join(' ');
    expect(argv).toContain('gpt-5.6-sol');
    expect(argv).not.toContain('gpt-5.5');
  });

  it('lets an explicit prReview.model override the codex default', async () => {
    const { calls, spawn } = recordingSpawn({ status: 0, stdout: '' });

    await createVendorRunner({
      vendor: 'codex',
      cwd: '/tmp/r',
      env: {},
      executionTier: 'degrade',
      model: 'gpt-5.6-terra',
      spawn,
      writeFile: () => {},
      readFile: () => CLEAN_REVIEW,
    })(JOB, 'd');

    const argv = (calls[0]?.argv ?? []).join(' ');
    expect(argv).toContain('gpt-5.6-terra');
    expect(argv).not.toContain('gpt-5.6-sol');
  });

  it('warns when the claude reviewer is pointed at a Fable or Mythos model', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const model of ['claude-fable-5', 'fable', 'claude-mythos-5']) {
        warnSpy.mockClear();
        createVendorRunner({
          vendor: 'claude',
          cwd: '/tmp/r',
          env: {},
          executionTier: 'degrade',
          model,
          spawn: () => ({ status: 0, stdout: '' }),
          writeFile: () => {},
          readFile: () => '',
        });
        // Fable/Mythos refuse cyber content and exclude security bug-finding,
        // and this reviewer inspects auth/billing/injection — so warn loudly
        // rather than run a review that will silently underperform or refuse.
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(String(warnSpy.mock.calls[0]?.[0])).toMatch(/security|fable|mythos/i);
      }
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('stays silent for a well-suited model, an unset model, or the codex vendor', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const base = {
        cwd: '/tmp/r',
        env: {},
        executionTier: 'degrade' as const,
        spawn: () => ({ status: 0, stdout: '' }),
        writeFile: () => {},
        readFile: () => '',
      };
      createVendorRunner({ ...base, vendor: 'claude', model: 'claude-opus-4-8' });
      createVendorRunner({ ...base, vendor: 'claude', model: 'sonnet' });
      createVendorRunner({ ...base, vendor: 'claude' });
      // Fable is unreachable via codex anyway (OpenAI models only), so a codex
      // model string is never something this guard should fire on.
      createVendorRunner({ ...base, vendor: 'codex', model: 'gpt-5.6-sol' });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
