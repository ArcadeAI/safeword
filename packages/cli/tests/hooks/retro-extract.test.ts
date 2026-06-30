import { describe, expect, it } from 'vitest';

import {
  buildDigest,
  buildExtractArgv,
  isRetroChild,
  RETRO_CHILD_ENV,
} from '../../templates/hooks/lib/retro-extract.js';

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
