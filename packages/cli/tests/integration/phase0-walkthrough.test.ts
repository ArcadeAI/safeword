/**
 * Ticket E1K5ZW (epic DZ2NM5 integration) — end-to-end demonstration that the
 * merged Phase 0 flow composes: one feature (`oauth-flow`, persona Platform
 * Operator) threaded through the four artifact layers the children shipped
 * separately —
 *
 *   spec.md scaffold → JTBD/AC intake-exit gates → numbered Phase-3 scenarios
 *   → `safeword check` coverage report.
 *
 * Two halves:
 *  1. Composition — drives the REAL pre-tool-quality hook and the REAL
 *     `safeword check` CLI over a single ticket, proving the gates and the
 *     coverage advisory chain together (not just per-layer, as the per-child
 *     suites prove). Mirrors jtbd-gate.test.ts (hook spawn) + check.test.ts
 *     Test 8.7 (coverage advisory).
 *  2. Doc-presence — the agent reads DISCOVERY.md at intake start, so the
 *     worked-example walkthrough living in the file IS the shipped behavior.
 *     describe.each over canonical + dogfood copies, per discovery-jtbd-substep.test.ts.
 *
 * Run from packages/cli (cwd), per the project's vitest convention.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createConfiguredProject,
  createTemporaryDirectory,
  expectHookAllow,
  expectHookDeny,
  type HookResult,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

const HOOK_PATH = nodePath.resolve(__dirname, '../../templates/hooks/pre-tool-quality.ts');

const TICKET_ID = 'E2E001';
const TICKET_RELATIVE = `.project/tickets/${TICKET_ID}`;

// One persona the JTBD reference resolves against at the gate.
const PERSONAS = ['## Platform Operator (PO)', '', '**Role:** Owns the fleet servers.', ''].join(
  '\n',
);

// Feature ticket sitting at the intake→define-behavior boundary: the JTBD/AC
// gate fires here (phase + scope frontmatter), and `safeword check` reads it as
// an in-progress feature for the coverage advisory.
const TICKET = [
  '---',
  `id: ${TICKET_ID}`,
  'type: feature',
  'phase: define-behavior',
  'status: in_progress',
  'scope:',
  '  - dual-key validation with a grace TTL',
  'out_of_scope:',
  '  - automatic rotation scheduling',
  'done_when:',
  '  - previous key works within the TTL and fails after it',
  '---',
  '',
].join('\n');

const JTBD = [
  '### oauth-flow.PO1 — Rotate credentials without a flag day',
  '',
  '**Persona:** Platform Operator (PO)',
  '',
  '> When I rotate a server API key, I want the previous key to keep working',
  '> for a short grace period, so I can roll the change across my fleet.',
].join('\n');

const AC1 = '#### oauth-flow.PO1.AC1 — The previous key keeps authenticating for a grace window';
const AC2 = '#### oauth-flow.PO1.AC2 — The operator can see which keys are currently live';

const AC1_SCENARIO = 'oauth-flow.PO1.AC1.previous_key_authenticates_within_grace_window';
const AC2_SCENARIO = 'oauth-flow.PO1.AC2.keys_list_shows_each_key_state';

/** Wrap a Jobs-To-Be-Done body in a minimal but well-formed spec.md. */
function specWith(jtbdBody: string): string {
  return [
    '# Spec: oauth-flow',
    '',
    '## Intent',
    '',
    'Rotate API keys without coordinated downtime.',
    '',
    '## Jobs To Be Done',
    '',
    jtbdBody,
    '',
    '## Outcomes',
    '',
    'Operators rotate keys with no flag day.',
    '',
  ].join('\n');
}

/** A test-definitions.md whose scenario titles carry the AC lineage scheme. */
function testDefinitionsCovering(...scenarioTitles: string[]): string {
  const blocks = scenarioTitles.flatMap(title => [
    `### Scenario: ${title}`,
    '',
    'Given a freshly rotated key',
    'When a request arrives signed with the previous key',
    'Then it is accepted within the grace window',
    '',
    '- [ ] RED',
    '- [ ] GREEN',
    '- [ ] REFACTOR',
    '',
  ]);
  return ['# Test Definitions', '', '## Rule: key rotation grace window', '', ...blocks].join('\n');
}

function runHook(input: object): HookResult {
  const result = spawnSync('bun', [HOOK_PATH], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

describe('Phase 0 end-to-end walkthrough (E1K5ZW): oauth-flow composes across all four layers', () => {
  let projectRoot: string;
  let absTicketDirectory: string;

  beforeEach(async () => {
    projectRoot = createTemporaryDirectory();
    await createConfiguredProject(projectRoot);
    // Overwrite the scaffolded (comment-only) personas.md with a real entry so
    // the JTBD's persona reference resolves at the gate.
    writeTestFile(projectRoot, '.project/personas.md', PERSONAS);
    writeTestFile(projectRoot, `${TICKET_RELATIVE}/ticket.md`, TICKET);
    writeTestFile(projectRoot, `${TICKET_RELATIVE}/dimensions.md`, 'skip: one obvious dimension');
    absTicketDirectory = nodePath.join(projectRoot, '.project', 'tickets', TICKET_ID);
  });

  afterEach(() => {
    removeTemporaryDirectory(projectRoot);
  });

  /** Attempt the test-definitions.md write that the intake-exit gate guards. */
  function attemptDefineBehavior(): HookResult {
    return runHook({
      tool_name: 'Write',
      tool_input: {
        file_path: nodePath.join(absTicketDirectory, 'test-definitions.md'),
        content: '# Test Definitions\n',
      },
    });
  }

  it('gate denies leaving intake while a JTBD has a persona but no Acceptance Criterion', () => {
    // Persona-resolved JTBD present, AC layer missing → the gate blocks the
    // jump to define-behavior, citing the missing AC.
    writeTestFile(projectRoot, `${TICKET_RELATIVE}/spec.md`, specWith(JTBD));

    expectHookDeny(attemptDefineBehavior(), 'AC');
  });

  it('gate allows once persona + JTBD + AC are all present (the product-layer artifacts)', () => {
    writeTestFile(
      projectRoot,
      `${TICKET_RELATIVE}/spec.md`,
      specWith(`${JTBD}\n\n${AC1}\n\n${AC2}`),
    );

    expectHookAllow(attemptDefineBehavior());
  });

  it('safeword check reports an AC that no numbered scenario covers, then clears once covered', async () => {
    writeTestFile(
      projectRoot,
      `${TICKET_RELATIVE}/spec.md`,
      specWith(`${JTBD}\n\n${AC1}\n\n${AC2}`),
    );

    // Phase-3 scenarios cover AC1 only — AC2 should surface as uncovered.
    writeTestFile(
      projectRoot,
      `${TICKET_RELATIVE}/test-definitions.md`,
      testDefinitionsCovering(AC1_SCENARIO),
    );

    const partial = await runCli(['check', '--offline'], { cwd: projectRoot });
    expect(partial.exitCode).toBe(0); // coverage gaps are advisories, never a gate
    const partialOutput = `${partial.stdout}\n${partial.stderr}`;
    expect(partialOutput).toMatch(/E2E001:.*oauth-flow\.PO1\.AC2.*uncovered/i);

    // Add a scenario for AC2 — the advisory clears.
    writeTestFile(
      projectRoot,
      `${TICKET_RELATIVE}/test-definitions.md`,
      testDefinitionsCovering(AC1_SCENARIO, AC2_SCENARIO),
    );

    const full = await runCli(['check', '--offline'], { cwd: projectRoot });
    expect(full.exitCode).toBe(0);
    expect(`${full.stdout}\n${full.stderr}`).not.toMatch(/oauth-flow\.PO1\.AC2.*uncovered/i);
  });
});

const CANONICAL = fileURLToPath(
  new URL('../../templates/skills/bdd/DISCOVERY.md', import.meta.url),
);
const DOGFOOD = fileURLToPath(
  new URL('../../../../.claude/skills/bdd/DISCOVERY.md', import.meta.url),
);

describe.each([
  ['canonical template', CANONICAL],
  ['dogfood copy', DOGFOOD],
])('DISCOVERY.md intake worked example — %s', (_label, filePath) => {
  const content = readFileSync(filePath, 'utf8');
  const exampleAt = content.indexOf('## Worked example: intake end to end');
  const afterExample = content.indexOf('## Intake Exit', exampleAt + 1);
  const exampleEnd = afterExample === -1 ? content.length : afterExample;
  const section = exampleAt === -1 ? '' : content.slice(exampleAt, exampleEnd);

  it('has a "Worked example: intake end to end" capstone section', () => {
    expect(exampleAt).toBeGreaterThan(-1);
  });

  it('exercises all four intake artifact types in one walkthrough', () => {
    // 1 — persona reference (from personas.md)
    expect(section).toMatch(/Platform Operator \(PO\)/);
    // 2 — JTBD: the id plus the "When I…, I want…, so I can…" form
    expect(section).toMatch(/oauth-flow\.PO1/);
    expect(section).toMatch(/When I /);
    expect(section).toMatch(/I want /);
    expect(section).toMatch(/so I can/);
    // 3 — Acceptance Criterion under the JTBD
    expect(section).toMatch(/#### oauth-flow\.PO1\.AC1/);
    // 4 — engineering scope / out-of-scope / done-when
    expect(section).toMatch(/scope:/);
    expect(section).toMatch(/out_of_scope:/);
    expect(section).toMatch(/done_when:/);
  });

  it('shows the numbered define-behavior scenario lineage and the coverage report', () => {
    expect(section).toMatch(/oauth-flow\.PO1\.AC1\.[a-z_]+/);
    expect(section).toMatch(/safeword check/);
    expect(section).toMatch(/uncovered/);
  });

  it('threads the B0JZQN sub-phase gates through the walkthrough', () => {
    expect(section).toMatch(/JTBD gate/);
    expect(section).toMatch(/AC gate/);
    expect(section).toMatch(/Scope gate/);
  });
});
