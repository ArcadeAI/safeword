import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildCodexExtractArgv,
  buildDigest,
  buildExtractArgv,
  DEFAULT_CLAUDE_RETRO_MODEL,
  DEFAULT_CODEX_RETRO_MODEL,
  isRetroChild,
  resolveRetroModel,
  RETRO_CHILD_ENV,
  retroChildArgs as retroChildArguments,
  runCodexHeadlessExtraction,
  runCodexHeadlessExtractionChecked,
  runHeadlessExtraction,
} from '../../templates/hooks/lib/retro-extract.js';

// A success envelope as `claude -p --output-format json` emits it: the model's
// findings JSON lives in `.result`.
const envelope = (resultText: string) =>
  JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: resultText });

const validFindings = JSON.stringify([
  {
    category: 'rough-edge',
    title: 'Gate message omits the file',
    safeword_surface: 'hooks/stop-quality.ts',
    what_happened: 'x',
    why_friction: 'y',
    repro: 'z',
  },
]);

function fakeDependencies(over: Record<string, unknown> = {}) {
  const calls: {
    argv: string[];
    options: { cwd: string; env: Record<string, string | undefined> };
  }[] = [];
  return {
    calls,
    deps: {
      spawn: (
        argv: string[],
        options: { cwd: string; env: Record<string, string | undefined> },
      ) => {
        calls.push({ argv, options });
        return Promise.resolve({ code: 0, stdout: envelope(validFindings) });
      },
      writeDigest: (_digest: string) => '/tmp/neutral/digest.txt',
      env: { HOME: '/home/x' },
      cwd: '/tmp/neutral',
      model: 'haiku',
      ...over,
    },
  };
}

describe('buildDigest', () => {
  // invisible-retro-claude.TB2.AC3 — a multi-MB transcript is digested, not fed raw:
  // signal (assistant text + tool-use names) survives under the cap, while an
  // oversized raw tool-result body is omitted (so naive truncation can't keep it
  // and drop the later markers).
  it('invisible-retro-claude.TB2.AC3.large_transcript_is_digested_before_extraction', () => {
    const oversizedBody = `BIGRESULT_${'Z'.repeat(50_000)}`;
    const lines = [
      // oversized tool-result FIRST: if it weren't filtered, truncation would keep
      // it and never reach the markers below.
      JSON.stringify({
        message: { role: 'user', content: [{ type: 'tool_result', content: oversizedBody }] },
      }),
      JSON.stringify({
        message: { role: 'assistant', content: [{ type: 'text', text: 'note MARKER_X here' }] },
      }),
      JSON.stringify({
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'TOOL_Y', input: { a: 1 } }],
        },
      }),
    ];
    const padding = Array.from({ length: 300 }, (_, i) =>
      JSON.stringify({
        message: { role: 'assistant', content: [{ type: 'text', text: `pad line ${i}` }] },
      }),
    );
    const transcript = [...lines, ...padding].join('\n');
    const cap = 4000;

    const digest = buildDigest(transcript, cap);

    expect(digest.length).toBeLessThanOrEqual(cap);
    expect(digest).toContain('MARKER_X');
    expect(digest).toContain('TOOL_Y');
    expect(digest).not.toContain(oversizedBody);
  });

  it('keeps a short error-ish tool-result (friction signal) but is resilient to malformed lines', () => {
    const transcript = [
      'not json at all',
      JSON.stringify({
        message: {
          role: 'user',
          content: [{ type: 'tool_result', content: 'gate BLOCKED: stale' }],
        },
      }),
    ].join('\n');
    const digest = buildDigest(transcript, 10_000);
    expect(digest).toContain('BLOCKED');
  });
});

describe('buildExtractArgv', () => {
  // invisible-retro-claude.TB2.AC1 — the Claude headless extractor argv: print
  // mode + JSON output, NO `--bare` (it breaks cloud managed-proxy auth), and a
  // read-only tool set (the extractor reads the digest; it must not write/exec).
  it('invisible-retro-claude.TB2.AC1.headless_argv_omits_bare_flag', () => {
    const argv = buildExtractArgv({
      model: 'haiku',
      systemPrompt: 'rules',
      prompt: 'read the digest',
    });

    expect(argv).toContain('-p');

    const outputFormatAt = argv.indexOf('--output-format');
    expect(outputFormatAt).toBeGreaterThanOrEqual(0);
    expect(argv[outputFormatAt + 1]).toBe('json');

    // The cloud-auth trap: `--bare` skips the managed-provider setup the container
    // authenticates through. The adapter must never pass it.
    expect(argv).not.toContain('--bare');

    const allowedToolsAt = argv.indexOf('--allowed-tools');
    expect(allowedToolsAt).toBeGreaterThanOrEqual(0);
    const tools = argv[allowedToolsAt + 1] ?? '';
    expect(tools).toContain('Read');
    expect(tools).not.toMatch(/Write|Edit|Bash/);
  });

  it('passes the model, system prompt, and task prompt through', () => {
    const argv = buildExtractArgv({
      model: 'haiku',
      systemPrompt: 'SYSRULES',
      prompt: 'TASKPROMPT',
    });
    const modelAt = argv.indexOf('--model');
    expect(modelAt).toBeGreaterThanOrEqual(0);
    expect(argv[modelAt + 1]).toBe('haiku');
    expect(argv).toContain('SYSRULES');
    // The task prompt is the trailing positional argument.
    expect(argv.at(-1)).toBe('TASKPROMPT');
  });
});

describe('buildCodexExtractArgv', () => {
  // codex-retro-parity.SM1.AC1 — Codex extraction runs through `codex exec` with
  // structured output, closed stdin, no hooks/MCP, and an inline digest prompt.
  it('builds the gated codex exec argv used by the Stop hook child', () => {
    const argv = buildCodexExtractArgv({
      model: 'gpt-5.5',
      outputPath: '/tmp/out.json',
      schemaPath: '/tmp/schema.json',
      prompt: 'INLINE DIGEST',
    });

    expect(argv.slice(0, 2)).toEqual(['exec', '--ignore-user-config']);
    expect(argv).toContain('--disable');
    expect(argv[argv.indexOf('--disable') + 1]).toBe('hooks');
    expect(argv).toContain('-c');
    expect(argv[argv.indexOf('-c') + 1]).toBe('mcp_servers={}');
    expect(argv[argv.indexOf('--output-schema') + 1]).toBe('/tmp/schema.json');
    expect(argv[argv.indexOf('-o') + 1]).toBe('/tmp/out.json');
    expect(argv[argv.indexOf('--sandbox') + 1]).toBe('read-only');
    expect(argv[argv.indexOf('-m') + 1]).toBe('gpt-5.5');
    expect(argv.at(-1)).toBe('INLINE DIGEST');
  });
});

describe('isRetroChild', () => {
  // invisible-retro-claude.NTB1.AC2 (read half) — the recursion guard. The
  // headless child runs WITH hooks (no `--bare`), so without this it would
  // re-fire retro. The sentinel env makes every safeword hook early-return.
  it('invisible-retro-claude.NTB1.AC2.hook_early_returns_under_retro_child_sentinel', () => {
    expect(isRetroChild({ [RETRO_CHILD_ENV]: '1' })).toBe(true);
    expect(isRetroChild({})).toBe(false);
    // Unset/empty is NOT a child — must not suppress a real session's retro.
    expect(isRetroChild({ [RETRO_CHILD_ENV]: '' })).toBe(false);
  });

  it('exposes the sentinel env name the spawn half sets', () => {
    expect(RETRO_CHILD_ENV).toBe('SAFEWORD_RETRO_CHILD');
  });
});

describe('resolveRetroModel (SM1.AC2 — config-overridable per-agent defaults)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-model-'));
  });
  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  function writeRetroConfig(config: unknown): void {
    const safewordDirectory = nodePath.join(projectDirectory, '.safeword');
    mkdirSync(safewordDirectory, { recursive: true });
    writeFileSync(nodePath.join(safewordDirectory, 'config.json'), JSON.stringify(config));
  }

  it('defaults to sonnet for Claude and gpt-5.5 for Codex when no retro.model is present', () => {
    expect(DEFAULT_CLAUDE_RETRO_MODEL).toBe('sonnet');
    expect(DEFAULT_CODEX_RETRO_MODEL).toBe('gpt-5.5');

    expect(resolveRetroModel(projectDirectory)).toBe('sonnet');
    expect(resolveRetroModel(projectDirectory, 'claude')).toBe('sonnet');
    expect(resolveRetroModel(projectDirectory, 'codex')).toBe('gpt-5.5');

    writeRetroConfig({ selfReport: { surface: true } }); // config present, no retro.model
    expect(resolveRetroModel(projectDirectory)).toBe('sonnet');
    expect(resolveRetroModel(projectDirectory, 'codex')).toBe('gpt-5.5');
  });

  it('honors a configured retro.model override for both agents', () => {
    writeRetroConfig({ retro: { model: 'haiku' } });
    expect(resolveRetroModel(projectDirectory)).toBe('haiku');
    expect(resolveRetroModel(projectDirectory, 'codex')).toBe('haiku');
  });
});

describe('retroChildArgs (SM2.AC2 — forward session id + window to the child)', () => {
  it('forwards the resolved session id and the delta window offset', () => {
    const args = retroChildArguments({
      transcriptPath: '/t/sess.jsonl',
      windowStart: 4096,
      sessionId: 'cloud-9',
    });
    expect(args).toContain('--auto-extract');
    expect(args[args.indexOf('--transcript') + 1]).toBe('/t/sess.jsonl');
    expect(args[args.indexOf('--window-start') + 1]).toBe('4096');
    // the stable session id reaches the child rather than its 'unknown' env fallback
    expect(args[args.indexOf('--session-id') + 1]).toBe('cloud-9');
  });
});

describe('runHeadlessExtraction', () => {
  // invisible-retro-claude.TB1.AC2 (spawn contract) + NTB1.AC2 (spawn half):
  // the digest is the input, the child runs from the neutral cwd, and the child
  // env carries the recursion sentinel.
  it('invisible-retro-claude.TB1.AC2.extraction_runs_as_an_out_of_band_subprocess', async () => {
    const { calls, deps } = fakeDependencies();
    await runHeadlessExtraction('some transcript', deps);

    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (!call) throw new Error('expected a spawn call');
    const { argv, options } = call;
    // the digest path (the input) is referenced in the task prompt
    expect(argv.at(-1)).toContain('/tmp/neutral/digest.txt');
    // neutral cwd, not the user's project
    expect(options.cwd).toBe('/tmp/neutral');
    // recursion sentinel set on the child
    expect(options.env[RETRO_CHILD_ENV]).toBe('1');
    // no --bare (cloud auth)
    expect(argv).not.toContain('--bare');
  });

  // invisible-retro-claude.TB2.AC2 — synchronous: the runner awaits the spawn and
  // returns its parsed result (it did not return early / detach).
  it('invisible-retro-claude.TB2.AC2.extraction_runs_synchronously', async () => {
    const { deps } = fakeDependencies();
    const findings = await runHeadlessExtraction('t', deps);
    expect(findings).toHaveLength(1);
    expect((findings[0] as { title: string }).title).toBe('Gate message omits the file');
  });

  // retro-recall.SM1.AC2 — when no model is passed, the extraction defaults to
  // sonnet (haiku proved too weak: 1–3 weak findings vs sonnet's 9). ZFGWS1.
  it('retro-recall.SM1.AC2.headless_extraction_defaults_to_sonnet', async () => {
    const { calls, deps } = fakeDependencies({ model: undefined });
    await runHeadlessExtraction('t', deps);
    const argv = calls[0]?.argv ?? [];
    const modelAt = argv.indexOf('--model');
    expect(argv[modelAt + 1]).toBe('sonnet');
  });

  // invisible-retro-claude.TB1.AC1 (fail-open) — extractor error or junk output
  // yields no findings and never throws.
  it('invisible-retro-claude.TB1.AC1.fail_open_stays_silent_when_extraction_errors', async () => {
    const nonZero = fakeDependencies({
      spawn: () => Promise.resolve({ code: 1, stdout: 'Authentication error' }),
    });
    await expect(runHeadlessExtraction('t', nonZero.deps)).resolves.toEqual([]);

    const badJson = fakeDependencies({
      spawn: () => Promise.resolve({ code: 0, stdout: envelope('not json at all') }),
    });
    await expect(runHeadlessExtraction('t', badJson.deps)).resolves.toEqual([]);

    const threw = fakeDependencies({
      spawn: () => Promise.reject(new Error('spawn failed')),
    });
    await expect(runHeadlessExtraction('t', threw.deps)).resolves.toEqual([]);
  });
});

describe('runCodexHeadlessExtraction', () => {
  function codexDependencies(over: Record<string, unknown> = {}) {
    const files = new Map<string, string>();
    const calls: {
      argv: string[];
      options: { cwd: string; env: Record<string, string | undefined>; stdio: 'ignore' };
    }[] = [];

    return {
      calls,
      files,
      deps: {
        spawn: (
          argv: string[],
          options: { cwd: string; env: Record<string, string | undefined>; stdio: 'ignore' },
        ) => {
          calls.push({ argv, options });
          files.set(
            '/tmp/neutral/out.json',
            JSON.stringify({ findings: JSON.parse(validFindings) }),
          );
          return Promise.resolve({ code: 0, stdout: '' });
        },
        writeFile: (path: string, content: string) => files.set(path, content),
        readFile: (path: string) => {
          const content = files.get(path);
          if (content === undefined) throw new Error(`missing file: ${path}`);
          return content;
        },
        cwd: '/tmp/neutral',
        env: { HOME: '/home/x' },
        model: 'gpt-5.5',
        schemaPath: '/tmp/neutral/schema.json',
        outputPath: '/tmp/neutral/out.json',
        ...over,
      },
    };
  }

  it('codex-retro-parity.SM1.AC1.runs_synchronously_with_schema_output_and_closed_stdio', async () => {
    const { calls, deps } = codexDependencies();
    const transcript = JSON.stringify({
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'INLINE_TRANSCRIPT_SIGNAL' }],
      },
    });
    const findings = await runCodexHeadlessExtraction(transcript, deps);

    expect(findings).toHaveLength(1);
    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (!call) throw new Error('expected a spawn call');
    expect(call.argv[0]).toBe('exec');
    expect(call.argv).toContain('--output-schema');
    expect(call.argv).toContain('--json');
    expect(call.argv.at(-1)).toContain('INLINE_TRANSCRIPT_SIGNAL');
    expect(call.options.cwd).toBe('/tmp/neutral');
    expect(call.options.stdio).toBe('ignore');
    expect(call.options.env[RETRO_CHILD_ENV]).toBe('1');
  });

  it('codex-retro-parity.SM2.AC1.fail_open_stays_silent_when_codex_output_is_unusable', async () => {
    const nonZero = codexDependencies({
      spawn: () => Promise.resolve({ code: 1, stdout: '' }),
    });
    await expect(runCodexHeadlessExtraction('t', nonZero.deps)).resolves.toEqual([]);
    await expect(runCodexHeadlessExtractionChecked('t', nonZero.deps)).resolves.toEqual({
      ok: false,
      findings: [],
    });

    const invalid = codexDependencies({
      spawn: (
        _argv: string[],
        _options: { cwd: string; env: Record<string, string | undefined>; stdio: 'ignore' },
      ) => {
        invalid.files.set('/tmp/neutral/out.json', '{not json');
        return Promise.resolve({ code: 0, stdout: '' });
      },
    });
    await expect(runCodexHeadlessExtraction('t', invalid.deps)).resolves.toEqual([]);
    await expect(runCodexHeadlessExtractionChecked('t', invalid.deps)).resolves.toEqual({
      ok: false,
      findings: [],
    });
  });

  it('treats schema-valid empty Codex findings as a successful extraction', async () => {
    const empty = codexDependencies({
      spawn: (
        _argv: string[],
        _options: { cwd: string; env: Record<string, string | undefined>; stdio: 'ignore' },
      ) => {
        empty.files.set('/tmp/neutral/out.json', JSON.stringify({ findings: [] }));
        return Promise.resolve({ code: 0, stdout: '' });
      },
    });

    await expect(runCodexHeadlessExtractionChecked('t', empty.deps)).resolves.toEqual({
      ok: true,
      findings: [],
    });
  });
});
