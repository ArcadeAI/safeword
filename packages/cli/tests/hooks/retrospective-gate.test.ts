import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { retrospectiveCloseDenial } from '../../templates/hooks/lib/retrospective-gate.js';

const ledger =
  '.project/tickets/CKWE2D-keep-reviews-focused-on-authored-inputs/test-definitions.md';

describe('installed retrospective closing gate', () => {
  let project: string;
  let outside: string;
  let previousCli: string | undefined;
  let previousPluginRoot: string | undefined;

  beforeEach(() => {
    project = mkdtempSync(nodePath.join(tmpdir(), 'retrospective-project-'));
    outside = mkdtempSync(nodePath.join(tmpdir(), 'retrospective-plugin-'));
    previousCli = process.env.SAFEWORD_PLUGIN_CLI;
    previousPluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
    delete process.env.CLAUDE_PLUGIN_ROOT;
  });

  afterEach(() => {
    if (previousCli === undefined) delete process.env.SAFEWORD_PLUGIN_CLI;
    else process.env.SAFEWORD_PLUGIN_CLI = previousCli;
    if (previousPluginRoot === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
    else process.env.CLAUDE_PLUGIN_ROOT = previousPluginRoot;
    rmSync(project, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  function stub(directory: string, output: string): string {
    const path = nodePath.join(directory, 'cli.js');
    mkdirSync(nodePath.dirname(path), { recursive: true });
    writeFileSync(path, `process.stdout.write(${JSON.stringify(output)});\n`);
    process.env.SAFEWORD_PLUGIN_CLI = path;
    return path;
  }

  function envelope(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      state: 'healthy',
      data: { status: 'approved', ticketId: 'CKWE2D', ledger, ...overrides },
    });
  }

  it('accepts only the installed CLI approval for the exact ticket and ledger', () => {
    stub(outside, envelope());
    expect(retrospectiveCloseDenial(project, 'CKWE2D', ledger)).toBeUndefined();
    expect(retrospectiveCloseDenial(project, 'OTHER1', ledger)).toBeDefined();
    expect(retrospectiveCloseDenial(project, 'CKWE2D', 'other.md')).toBeDefined();
  });

  it.each([
    [
      'blocked state',
      JSON.stringify({
        state: 'action_required',
        data: { status: 'approved', ticketId: 'CKWE2D', ledger },
      }),
    ],
    ['wrong ticket', envelope({ ticketId: 'OTHER1' })],
    ['wrong ledger', envelope({ ledger: 'other.md' })],
    ['non-JSON output', 'broken'],
  ])('rejects %s from the CLI process', (_case, output) => {
    stub(outside, output);
    expect(retrospectiveCloseDenial(project, 'CKWE2D', ledger)).toBeDefined();
  });

  it('rejects a project-writable CLI even when it prints approval', () => {
    stub(project, envelope());
    expect(retrospectiveCloseDenial(project, 'CKWE2D', ledger)).toBeDefined();
  });
});
