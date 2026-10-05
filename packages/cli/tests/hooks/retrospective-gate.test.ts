import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  retrospectiveCloseDenial,
  retrospectiveGateDenial,
} from '../../templates/hooks/lib/retrospective-gate.js';

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

  it.runIf(process.platform !== 'win32')(
    'does not accept approval from a project-local Bun on PATH',
    () => {
      stub(outside, JSON.stringify({ state: 'action_required' }));
      const prior = process.env.PATH;
      writeFileSync(nodePath.join(project, 'bun'), `#!/bin/sh\nprintf '%s' '${envelope()}'\n`, {
        mode: 0o755,
      });
      try {
        process.env.PATH = `${project}${nodePath.delimiter}${prior ?? ''}`;
        expect(retrospectiveCloseDenial(project, 'CKWE2D', ledger)).toBeDefined();
      } finally {
        process.env.PATH = prior;
      }
    },
  );

  it.runIf(process.platform !== 'win32')(
    'does not load a project Bun preload while checking the installed CLI',
    () => {
      stub(outside, JSON.stringify({ state: 'action_required' }));
      writeFileSync(nodePath.join(project, 'bunfig.toml'), 'preload = ["./spoof.js"]\n');
      writeFileSync(
        nodePath.join(project, 'spoof.js'),
        `process.stdout.write(${JSON.stringify(envelope())}); process.exit(0);\n`,
      );
      const bun = execFileSync('which', ['bun'], { encoding: 'utf8' }).trim();
      const module = nodePath.resolve(
        import.meta.dirname,
        '../../templates/hooks/lib/retrospective-gate.ts',
      );
      const result = spawnSync(
        bun,
        [
          '--eval',
          `
      const { retrospectiveCloseDenial } = await import(${JSON.stringify(module)});
      const denial = retrospectiveCloseDenial(${JSON.stringify(project)}, 'CKWE2D', ${JSON.stringify(ledger)});
      if (denial === undefined) process.exit(7);
      console.log(denial);
    `,
        ],
        { cwd: outside, env: process.env, encoding: 'utf8' },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('Retrospective closing proof is not current');
    },
  );

  it('does not pass Node preload injection into the installed CLI check', () => {
    stub(outside, JSON.stringify({ state: 'action_required' }));
    const preload = nodePath.join(project, 'spoof.cjs');
    writeFileSync(
      preload,
      `process.stdout.write(${JSON.stringify(envelope())}); process.exit(0);\n`,
    );
    const prior = process.env.NODE_OPTIONS;
    try {
      process.env.NODE_OPTIONS = `--require=${JSON.stringify(preload)}`;
      expect(retrospectiveCloseDenial(project, 'CKWE2D', ledger)).toBeDefined();
    } finally {
      if (prior === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = prior;
    }
  });

  it('checks every identity returned for a VERIFIED row', () => {
    const claim = {
      ticketId: 'CKWE2D',
      scenario: 'example',
      ledger,
      eligibilityId: '11111111-1111-4111-8111-111111111111',
      proofId: '22222222-2222-4222-8222-222222222222',
    };
    const response = (data: Record<string, string>, state = 'healthy') =>
      stub(outside, JSON.stringify({ state, data }));
    response({ ...claim, status: 'approved' });
    expect(retrospectiveGateDenial(project, claim)).toBeUndefined();
    response({ ...claim, status: 'approved' }, 'action_required');
    expect(retrospectiveGateDenial(project, claim)).toBeDefined();
    for (const field of Object.keys(claim) as (keyof typeof claim)[]) {
      response({ ...claim, [field]: 'wrong', status: 'approved' });
      expect(retrospectiveGateDenial(project, claim)).toBeDefined();
    }
    stub(project, JSON.stringify({ state: 'healthy', data: { ...claim, status: 'approved' } }));
    expect(retrospectiveGateDenial(project, claim)).toBeDefined();
  });
});
