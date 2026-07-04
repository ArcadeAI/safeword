/**
 * Integration test for the NMSD94 Tier 1 review gate, wired into the real
 * pre-tool-quality hook. Verifies the wired path the unit tests can't: the gate
 * is default-off, and when enabled it denies an unreviewed/stale/cross-ticket
 * spec and allows a matching stamp or a logged skip. Proves the content-binding
 * fix from the quality-review end-to-end.
 *
 * Fixture is a `task` (not a feature): 87Y167 promoted the feature spec-review
 * demand to always-on (flag-independent), so the `reviewGate` flag now governs
 * only non-feature tickets that carry a spec.md — this suite covers that
 * population. The feature always-on path lives in
 * artifact-precedence-gate.feature and the jtbd/quality-gates suites.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, it } from 'vitest';

import { hashArtifact, reviewScope } from '../../templates/hooks/lib/review-ledger.js';
import { expectHookAllow, expectHookDeny, type HookResult } from '../helpers';

const HOOK_PATH = nodePath.resolve(__dirname, '../../templates/hooks/pre-tool-quality.ts');
const TICKET_ID = 'ABC123';

const TICKET_FRONTMATTER = [
  'id: ABC123',
  'type: task',
  'phase: define-behavior',
  'status: in_progress',
  'scope:',
  '  - does a thing',
  'out_of_scope:',
  '  - another thing',
  'done_when:',
  '  - the thing works',
].join('\n');

const SPEC = [
  '# Spec: x',
  '',
  '## Jobs To Be Done',
  '',
  '### feat.PO1 — title',
  '',
  '**Persona:** Platform Operator (PO)',
  '',
  '> When I do x, I want y, so I can z.',
  '',
  '#### feat.PO1.AC1 — a capability',
  '',
  'The capability.',
  '',
].join('\n');

const PERSONAS = '# Personas\n\n## Platform Operator (PO)\n\n**Role:** Owns infra.\n';

describe('NMSD94 Tier 1 review gate (wired)', () => {
  let projectRoot: string;
  let ticketDirectory: string;

  function runWriteScenarios(): HookResult {
    const result = spawnSync('bun', [HOOK_PATH], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: {
          file_path: nodePath.join(ticketDirectory, 'test-definitions.md'),
          content: '# Test Definitions\n',
        },
      }),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  function writeConfig(reviewGate: boolean): void {
    mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(projectRoot, '.safeword', 'config.json'),
      JSON.stringify({ reviewGate }),
    );
  }

  function writeLog(line: string): void {
    writeFileSync(nodePath.join(projectRoot, '.safeword-project', 'skill-invocations.log'), line);
  }

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'review-gate-'));
    ticketDirectory = nodePath.join(projectRoot, '.safeword-project', 'tickets', TICKET_ID);
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), `---\n${TICKET_FRONTMATTER}\n---\n`);
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), SPEC);
    writeFileSync(nodePath.join(ticketDirectory, 'dimensions.md'), 'skip: one obvious dimension');
    writeFileSync(nodePath.join(projectRoot, '.safeword-project', 'personas.md'), PERSONAS);
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('default-off: with no reviewGate flag, scenarios are allowed (inert)', () => {
    writeConfig(false);
    expectHookAllow(runWriteScenarios());
  });

  it('enabled + unreviewed: denies, asking for a spec review', () => {
    writeConfig(true);
    expectHookDeny(runWriteScenarios(), 'must be reviewed');
  });

  it('enabled + matching stamp: allows', () => {
    writeConfig(true);
    writeLog(
      `2026-06-03T00:00:00Z sess review:${reviewScope(TICKET_ID, 'spec', hashArtifact(SPEC))}`,
    );
    expectHookAllow(runWriteScenarios());
  });

  it('enabled + stale stamp (old content hash): denies', () => {
    writeConfig(true);
    writeLog(
      `2026-06-03T00:00:00Z sess review:${reviewScope(TICKET_ID, 'spec', hashArtifact('old spec'))}`,
    );
    expectHookDeny(runWriteScenarios(), 'must be reviewed');
  });

  it('enabled + skip stamp: allows', () => {
    writeConfig(true);
    const scope = reviewScope(TICKET_ID, 'spec', hashArtifact(SPEC));
    writeLog(`2026-06-03T00:00:00Z sess review:${scope} skip:trivial spec`);
    expectHookAllow(runWriteScenarios());
  });
});
