/**
 * Integration test for the intake-exit JTBD gate (ticket Y2HCNJ, slice C,
 * test-definitions.md Rule 7). Spawns the real pre-tool-quality hook and
 * verifies it gates test-definitions.md creation on spec.md JTBD content,
 * and (ticket 9EA27P) denies a feature that has no spec.md at all — the
 * transitional no-spec grandfather skip is gone; features fail closed.
 *
 * The hook signals denial the PreToolUse way — a `permissionDecision: deny`
 * JSON object on stdout, exit 0 — so assertions go through the shared
 * expectHookDeny / expectHookAllow helpers rather than inspecting exit codes.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, it } from 'vitest';

import {
  formatReviewStamp,
  hashArtifact,
  reviewScope,
} from '../../templates/hooks/lib/review-ledger';
import { expectHookAllow, expectHookDeny, type HookResult } from '../helpers';

const HOOK_PATH = nodePath.resolve(__dirname, '../../templates/hooks/pre-tool-quality.ts');

/**
 * Satisfy the always-on spec-review demand (87Y167, #644 G1) so a feature's
 * test-definitions.md write reaches the JTBD/AC checks these suites pin.
 */
function seedSpecStamp(projectRoot: string, ticketFolder: string, specContent: string): void {
  const scope = reviewScope(ticketFolder, 'spec', hashArtifact(specContent));
  writeFileSync(
    nodePath.join(projectRoot, '.safeword-project', 'skill-invocations.log'),
    `2026-01-01T00:00:00.000Z test-session ${formatReviewStamp(scope)}\n`,
  );
}

const TICKET_FRONTMATTER = [
  'id: ABC123',
  'type: feature',
  'phase: define-behavior',
  'status: in_progress',
  'scope:',
  '  - does a thing',
  'out_of_scope:',
  '  - another thing',
  'done_when:',
  '  - the thing works',
].join('\n');

const PERSONAS = '# Personas\n\n## Platform Operator (PO)\n\n**Role:** Owns infra.\n';

function runHook(input: object, projectDirectory?: string): HookResult {
  const result = spawnSync('bun', [HOOK_PATH], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    // Match the real invocation: stamps resolve under the edited ticket's
    // project. Without this the always-on spec-review demand (87Y167) reads
    // the wrong namespace and a seeded stamp never matches.
    env: projectDirectory ? { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory } : process.env,
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function jtbdSpec(jtbdBody: string): string {
  return `# Spec: x\n\n## Intent\n\nWhy.\n\n## Jobs To Be Done\n\n${jtbdBody}\n\n## Outcomes\n\nDone.\n`;
}

function attemptTestDefinitions(ticketDirectory: string, projectRoot?: string): HookResult {
  return runHook(
    {
      tool_name: 'Write',
      tool_input: {
        file_path: nodePath.join(ticketDirectory, 'test-definitions.md'),
        content: '# Test Definitions\n',
      },
    },
    projectRoot,
  );
}

describe('intake-exit JTBD gate (Rule 7)', () => {
  let projectRoot: string;
  let ticketDirectory: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'jtbd-gate-'));
    ticketDirectory = nodePath.join(projectRoot, '.safeword-project', 'tickets', 'ABC123');
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), `---\n${TICKET_FRONTMATTER}\n---\n`);
    writeFileSync(nodePath.join(ticketDirectory, 'dimensions.md'), 'skip: one obvious dimension');
    writeFileSync(nodePath.join(projectRoot, '.safeword-project', 'personas.md'), PERSONAS);
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('denies when spec.md has no JTBD', () => {
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), jtbdSpec('(none yet)'));
    expectHookDeny(attemptTestDefinitions(ticketDirectory, projectRoot), 'JTBD');
  });

  it('allows when spec.md has a JTBD whose persona resolves and an AC under it', () => {
    const spec = jtbdSpec(
      '### x.PO1 — t\n\n**Persona:** Platform Operator (PO)\n\n> When I a, I want b, so I can c.\n\n#### x.PO1.AC1 — b is reliably delivered',
    );
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), spec);
    seedSpecStamp(projectRoot, 'ABC123', spec);
    expectHookAllow(attemptTestDefinitions(ticketDirectory, projectRoot));
  });

  it('denies a feature with no spec.md — the no-spec grandfather skip is gone (9EA27P)', () => {
    // No spec.md written. Features now fail closed: the JTBD/AC gates no longer
    // silently skip on spec.md absence — the feature is denied until it carries
    // a spec.md (real JTBDs, or a `skip:` under `## Jobs To Be Done`).
    expectHookDeny(attemptTestDefinitions(ticketDirectory, projectRoot), 'spec.md');
  });
});

describe('intake-exit AC gate (31W8M3)', () => {
  let projectRoot: string;
  let ticketDirectory: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'ac-gate-'));
    ticketDirectory = nodePath.join(projectRoot, '.safeword-project', 'tickets', 'ABC123');
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), `---\n${TICKET_FRONTMATTER}\n---\n`);
    writeFileSync(nodePath.join(ticketDirectory, 'dimensions.md'), 'skip: one obvious dimension');
    writeFileSync(nodePath.join(projectRoot, '.safeword-project', 'personas.md'), PERSONAS);
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  const RESOLVING_JTBD =
    '### x.PO1 — t\n\n**Persona:** Platform Operator (PO)\n\n> When I a, I want b, so I can c.';

  it('denies when a JTBD has no Acceptance Criteria', () => {
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), jtbdSpec(RESOLVING_JTBD));
    expectHookDeny(attemptTestDefinitions(ticketDirectory, projectRoot), 'AC');
  });

  it('allows a JTBD with an AC heading under it', () => {
    const spec = jtbdSpec(`${RESOLVING_JTBD}\n\n#### x.PO1.AC1 — b is reliably delivered`);
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), spec);
    seedSpecStamp(projectRoot, 'ABC123', spec);
    expectHookAllow(attemptTestDefinitions(ticketDirectory, projectRoot));
  });

  it('denies a feature with no spec.md — the no-spec grandfather skip is gone (9EA27P)', () => {
    // Same fail-closed rule, reached from the AC gate's side: no spec.md ⇒ denied.
    expectHookDeny(attemptTestDefinitions(ticketDirectory, projectRoot), 'spec.md');
  });
});
