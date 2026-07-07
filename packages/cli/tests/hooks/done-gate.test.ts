/**
 * Unit tests for the shared done-gate evidence checks (AKNWZK).
 *
 * `checkVerifyArtifact` is the source of truth both the Claude Stop gate and the
 * Cursor done-edit gate import. `evaluateDoneEvidence` is the composite the Cursor
 * gate runs. The temp projects have no package.json, so the test suite is skipped
 * (no command resolves) and the verify.md / scenario checks carry the verdict —
 * which is exactly the surface these tests pin.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { checkVerifyArtifact, evaluateDoneEvidence } from '../../templates/hooks/lib/done-gate.js';

const VALID_VERIFY = '# Verify\n\n**PR Scope:** ✅ Diff matches ticket scope\n';

describe('checkVerifyArtifact', () => {
  it('passes when a PR-scope line is present and in scope', () => {
    expect(checkVerifyArtifact(VALID_VERIFY)).toEqual({ ok: true });
  });

  it('fails when the PR-scope line is missing', () => {
    const verdict = checkVerifyArtifact('# Verify\n\nlooks fine\n');
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('PR scope');
  });

  it('fails when the PR-scope line reports a failure', () => {
    const verdict = checkVerifyArtifact('**PR Scope:** ❌ piggybacked changes\n');
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('piggybacked');
  });

  // 1F08DD: a passing ✅ status whose PROSE mentions "piggybacked changes"
  // (negated) must not be read as a failure — found live when the boundary
  // gate rejected CDRJTW's honest "No piggybacked changes." verify.md.
  it('passes a ✅ status that merely mentions piggybacked changes in prose', () => {
    const verdict = checkVerifyArtifact(
      '**PR Scope:** ✅ Diff matches ticket scope — No piggybacked changes.\n',
    );
    expect(verdict).toEqual({ ok: true });
  });

  it('fails a glyph-less status that positively claims piggybacked changes', () => {
    const verdict = checkVerifyArtifact('**PR Scope:** Piggybacked changes: src/foo.ts\n');
    expect(verdict.ok).toBe(false);
  });

  it('fails a status carrying ❌ even when a ✅ also appears later in the line', () => {
    const verdict = checkVerifyArtifact(
      '**PR Scope:** ❌ Piggybacked changes: src/foo.ts (was ✅ before the late edit)\n',
    );
    expect(verdict.ok).toBe(false);
  });
});

describe('evaluateDoneEvidence', () => {
  // Pin the CLI to repo source so the test-runner resolves locally instead of
  // reaching for `bunx safeword`; an empty temp project resolves no test command.
  const previousCli = process.env.SAFEWORD_CLI;
  beforeAll(() => {
    process.env.SAFEWORD_CLI = nodePath.resolve(__dirname, '../../src/cli.ts');
  });
  afterAll(() => {
    if (previousCli === undefined) delete process.env.SAFEWORD_CLI;
    else process.env.SAFEWORD_CLI = previousCli;
  });

  let projectDirectory: string;
  let ticketDirectory: string;

  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'done-gate-'));
    ticketDirectory = nodePath.join(projectDirectory, '.project', 'tickets', 'T1-x');
    mkdirSync(ticketDirectory, { recursive: true });
  });

  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('blocks a task close when verify.md is absent', () => {
    const verdict = evaluateDoneEvidence({
      projectDir: projectDirectory,
      ticketDir: ticketDirectory,
      ticketType: 'task',
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('verify.md');
  });

  it('allows a task close when verify.md is valid', () => {
    writeFileSync(nodePath.join(ticketDirectory, 'verify.md'), VALID_VERIFY);
    expect(
      evaluateDoneEvidence({
        projectDir: projectDirectory,
        ticketDir: ticketDirectory,
        ticketType: 'task',
      }),
    ).toEqual({ ok: true });
  });

  it('blocks a feature close when test-definitions.md is missing', () => {
    writeFileSync(nodePath.join(ticketDirectory, 'verify.md'), VALID_VERIFY);
    const verdict = evaluateDoneEvidence({
      projectDir: projectDirectory,
      ticketDir: ticketDirectory,
      ticketType: 'feature',
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('test-definitions.md');
  });

  it('blocks a feature close when a scenario is still unchecked', () => {
    writeFileSync(nodePath.join(ticketDirectory, 'verify.md'), VALID_VERIFY);
    writeFileSync(
      nodePath.join(ticketDirectory, 'test-definitions.md'),
      '## Rule: x\n- [x] one\n- [ ] two\n',
    );
    const verdict = evaluateDoneEvidence({
      projectDir: projectDirectory,
      ticketDir: ticketDirectory,
      ticketType: 'feature',
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('scenarios');
  });

  it('allows a feature close when verify.md and all scenarios are complete', () => {
    writeFileSync(nodePath.join(ticketDirectory, 'verify.md'), VALID_VERIFY);
    writeFileSync(
      nodePath.join(ticketDirectory, 'test-definitions.md'),
      '## Rule: x\n- [x] one\n- [x] two\n',
    );
    expect(
      evaluateDoneEvidence({
        projectDir: projectDirectory,
        ticketDir: ticketDirectory,
        ticketType: 'feature',
      }),
    ).toEqual({ ok: true });
  });
});
