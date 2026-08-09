/**
 * TXRHMD (#480) transition gate: a new-flow feature ticket may only advance
 * plan-implementation → implement once impl-plan.md parses valid with status
 * `planned`. Wiring test — spawns the real pre-tool-quality hook with real
 * hook-lib collaborators; only the filesystem (temp project) is controlled.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { evaluateImplementEntry } from '../../templates/hooks/lib/plan-gate.js';
import { expectHookAllow, expectHookDeny, type HookResult } from '../helpers';

const GATE_PATH = nodePath.resolve(__dirname, '../../templates/hooks/pre-tool-quality.ts');
const CODEX_GATE_PATH = nodePath.resolve(
  __dirname,
  '../../templates/hooks/codex/pre-tool-quality.ts',
);
const CURSOR_GATE_PATH = nodePath.resolve(
  __dirname,
  '../../templates/hooks/cursor/pre-tool-quality.ts',
);
const TICKET_ID = 'TX480G';
const TODAY = new Date().toISOString().slice(0, 10);

const ticketBody = (phase: string, type = 'feature', activated = false): string =>
  [
    '---',
    `id: ${TICKET_ID}`,
    `type: ${type}`,
    `phase: ${phase}`,
    'status: in_progress',
    'scope:',
    '  - gate the implement entry',
    'out_of_scope:',
    '  - unrelated',
    'done_when:',
    '  - gated',
    ...(activated
      ? [
          'inspiration_contract: v1',
          'inspiration_contract_scaffold: v1',
          `created: ${TODAY}T00:00:00.000Z`,
        ]
      : []),
    '---',
    '',
    '# Ticket',
    '',
  ].join('\n');

const VALID_PLAN = [
  '# Impl Plan: gate the implement entry',
  '',
  '**Status:** planned',
  '',
  '## Approach',
  '',
  'Riskiest assumption: the gate fires → scenario 1.',
  '',
  '## Decisions',
  '',
  '### Recorded Decisions',
  '',
  '| Decision | Choice | Alternatives considered | Rejected because |',
  '| - | - | - | - |',
  '| gate | pre-tool | stop-only | too late |',
  '',
  '## Arch alignment',
  '',
  'skip: no ADRs in this project yet',
  '',
  '## Known deviations',
  '',
  'skip: no deviations planned',
  '',
  '## Assessment triggers',
  '',
  'Revisit when a second gate consumer appears.',
  '',
].join('\n');

const VALID_INSPIRATION = [
  '### Implementation Inspiration',
  '',
  '| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  `| https://spec.commonmark.org/0.31.2/ | ${TODAY} | 0.31.2 | 0.31.2 | Exact comment grammar | Exact marker | Strict subset only |`,
  '',
  '**Decision impact:** retained: exact markers fit the gate',
].join('\n');

const ACTIVATED_PLAN = VALID_PLAN.replace(
  '**Status:** planned',
  () => `**Status:** planned\n**Planned on:** ${TODAY}`,
)
  .replace('## Decisions\n', () => `## Decisions\n\n${VALID_INSPIRATION}\n`)
  .replace('| gate | pre-tool |', () => '| gate | https://spec.commonmark.org/0.31.2/ |');

describe('TXRHMD plan-implementation → implement transition gate (wired)', () => {
  let projectRoot: string;
  let ticketDirectory: string;
  let ticketFile: string;

  function runAdvance(fromPhase: string, toPhase: string): HookResult {
    const result = spawnSync('bun', [GATE_PATH], {
      input: JSON.stringify({
        tool_name: 'Edit',
        tool_input: {
          file_path: ticketFile,
          old_string: `phase: ${fromPhase}`,
          new_string: `phase: ${toPhase}`,
        },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  function runCodexAdvance(fromPhase: string, toPhase: string): HookResult {
    const result = spawnSync('bun', [CODEX_GATE_PATH], {
      cwd: projectRoot,
      input: JSON.stringify({
        session_id: 'plan-codex',
        tool_name: 'Edit',
        tool_input: {
          file_path: ticketFile,
          old_string: `phase: ${fromPhase}`,
          new_string: `phase: ${toPhase}`,
        },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  function runCursorWrite(
    filePath: string,
    content: string,
  ): { permission?: string; user_message?: string } {
    const result = spawnSync('bun', [CURSOR_GATE_PATH], {
      cwd: projectRoot,
      input: JSON.stringify({
        conversation_id: 'plan-cursor',
        workspace_roots: [projectRoot],
        tool_name: 'Write',
        tool_input: { file_path: filePath, content },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
    });
    return JSON.parse(result.stdout || '{}') as { permission?: string; user_message?: string };
  }

  function runCursorAdvance(content: string): { permission?: string; user_message?: string } {
    return runCursorWrite(ticketFile, content);
  }

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'sw-plan-gate-'));
    ticketDirectory = nodePath.join(projectRoot, '.project', 'tickets', `${TICKET_ID}-gate`);
    mkdirSync(ticketDirectory, { recursive: true });
    mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
    ticketFile = nodePath.join(ticketDirectory, 'ticket.md');
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('allows implement entry when a valid planned impl-plan.md exists', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation'));
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Spec\n');
    writeFileSync(nodePath.join(ticketDirectory, 'impl-plan.md'), VALID_PLAN);
    expectHookAllow(runAdvance('plan-implementation', 'implement'));
  });

  it('denies activated implement entry without Implementation Inspiration', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation', 'feature', true));
    writeFileSync(
      nodePath.join(ticketDirectory, 'spec.md'),
      '# Spec\n<!-- safeword:inspiration-contract:v1 -->\n',
    );
    writeFileSync(
      nodePath.join(ticketDirectory, 'impl-plan.md'),
      VALID_PLAN.replace(
        '**Status:** planned',
        () => `**Status:** planned\n**Planned on:** ${TODAY}`,
      ),
    );

    expectHookDeny(runAdvance('plan-implementation', 'implement'), 'Implementation Inspiration');
  });

  it('denies activated implement entry without spec.md', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation', 'feature', true));

    expectHookDeny(runAdvance('plan-implementation', 'implement'), 'missing spec.md');
  });

  it('denies missing Implementation Inspiration through CRLF artifacts', () => {
    writeFileSync(
      ticketFile,
      ticketBody('plan-implementation', 'feature', true).replaceAll('\n', '\r\n'),
    );
    writeFileSync(
      nodePath.join(ticketDirectory, 'spec.md'),
      '# Spec\r\n<!-- safeword:inspiration-contract:v1 -->\r\n',
    );
    writeFileSync(
      nodePath.join(ticketDirectory, 'impl-plan.md'),
      VALID_PLAN.replace(
        '**Status:** planned',
        () => `**Status:** planned\r\n**Planned on:** ${TODAY}`,
      ).replaceAll('\n', '\r\n'),
    );

    expectHookDeny(runAdvance('plan-implementation', 'implement'), 'Implementation Inspiration');
  });

  it('allows activated implement entry with current version-matched inspiration', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation', 'feature', true));
    writeFileSync(
      nodePath.join(ticketDirectory, 'spec.md'),
      '# Spec\n<!-- safeword:inspiration-contract:v1 -->\n',
    );
    writeFileSync(nodePath.join(ticketDirectory, 'impl-plan.md'), ACTIVATED_PLAN);

    expectHookAllow(runAdvance('plan-implementation', 'implement'));
  });

  it('carries implementation inspiration denial and acceptance through the Codex adapter', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation', 'feature', true));
    writeFileSync(
      nodePath.join(ticketDirectory, 'spec.md'),
      '# Spec\n<!-- safeword:inspiration-contract:v1 -->\n',
    );
    writeFileSync(
      nodePath.join(ticketDirectory, 'impl-plan.md'),
      VALID_PLAN.replace(
        '**Status:** planned',
        () => `**Status:** planned\n**Planned on:** ${TODAY}`,
      ),
    );
    expectHookDeny(
      runCodexAdvance('plan-implementation', 'implement'),
      'Implementation Inspiration',
    );

    writeFileSync(nodePath.join(ticketDirectory, 'impl-plan.md'), ACTIVATED_PLAN);
    expectHookAllow(runCodexAdvance('plan-implementation', 'implement'));
  });

  it('carries implementation inspiration denial and acceptance through the Cursor adapter', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation', 'feature', true));
    writeFileSync(
      nodePath.join(ticketDirectory, 'spec.md'),
      '# Spec\n<!-- safeword:inspiration-contract:v1 -->\n',
    );
    writeFileSync(
      nodePath.join(ticketDirectory, 'impl-plan.md'),
      VALID_PLAN.replace(
        '**Status:** planned',
        () => `**Status:** planned\n**Planned on:** ${TODAY}`,
      ),
    );
    const denied = runCursorAdvance(ticketBody('implement', 'feature', true));
    expect(denied.permission).toBe('deny');
    expect(denied.user_message).toContain('Implementation Inspiration');

    writeFileSync(nodePath.join(ticketDirectory, 'impl-plan.md'), ACTIVATED_PLAN);
    expect(runCursorAdvance(ticketBody('implement', 'feature', true))).toEqual({
      permission: 'allow',
    });
  });

  it('retains implementation activation across a removal edit and a later transition', () => {
    const specFile = nodePath.join(ticketDirectory, 'spec.md');
    writeFileSync(ticketFile, ticketBody('plan-implementation', 'feature', true));
    writeFileSync(specFile, '# Spec\n<!-- safeword:inspiration-contract:v1 -->\n');
    writeFileSync(nodePath.join(ticketDirectory, 'impl-plan.md'), VALID_PLAN);
    const ticketWithoutSignals = ticketBody('plan-implementation', 'feature', true)
      .replace('inspiration_contract: v1\n', '')
      .replace('inspiration_contract_scaffold: v1\n', '');

    expect(runCursorWrite(ticketFile, ticketWithoutSignals)).toEqual({ permission: 'allow' });
    writeFileSync(ticketFile, ticketWithoutSignals);

    const lastSignalRemoval = runCursorWrite(specFile, '# Spec\n');
    expect(lastSignalRemoval.permission).toBe('deny');
    expect(lastSignalRemoval.user_message).toContain('last inspiration-contract activation signal');

    const transition = runCursorAdvance(
      ticketWithoutSignals.replace('phase: plan-implementation', 'phase: implement'),
    );
    expect(transition.permission).toBe('deny');
    expect(transition.user_message).toContain('all three');
  });

  it('accepts a completed canonical implementation-plan template through the real gate', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation', 'feature', true));
    writeFileSync(
      nodePath.join(ticketDirectory, 'spec.md'),
      '# Spec\n<!-- safeword:inspiration-contract:v1 -->\n',
    );
    const template = readFileSync(
      nodePath.resolve(__dirname, '../../templates/doc-templates/impl-plan-template.md'),
      'utf8',
    );
    const completed = template
      .replace('{title}', 'canonical scaffold')
      .replace('<YYYY-MM-DD>', () => TODAY)
      .replace('## Approach\n', '## Approach\n\nProve the canonical scaffold through this gate.\n')
      .replace('## Design alignment\n', '## Design alignment\n\nskip: fixture has no principles\n')
      .replace('## Known deviations\n', '## Known deviations\n\nskip: no deviations\n')
      .replace('## Doc impact\n', '## Doc impact\n\nskip: fixture only\n')
      .replace('## Assessment triggers\n', '## Assessment triggers\n\nRevisit on grammar v2.\n')
      .replace(
        '| --- | --- | --- | --- | --- | --- | --- |\n\n**Decision impact:** <changed: or retained: plus a non-empty rationale>',
        () =>
          `| --- | --- | --- | --- | --- | --- | --- |\n| https://spec.commonmark.org/0.31.2/ | ${TODAY} | 0.31.2 | 0.31.2 | Exact grammar | Keep exact records | V1 subset only |\n\n**Decision impact:** retained: exact records fit`,
      )
      .replace(
        '## Design alignment',
        '| Decision | Choice | Alternatives considered | Rejected because |\n| --- | --- | --- | --- |\n| parser | https://spec.commonmark.org/0.31.2/ | permissive parser | exact contract is safer |\n\n## Design alignment',
      );
    writeFileSync(nodePath.join(ticketDirectory, 'impl-plan.md'), completed);

    expect(evaluateImplementEntry(ticketDirectory, { evaluationDate: TODAY })).toEqual({
      ok: true,
    });
  });

  it('denies implement entry without impl-plan.md, naming the artifact and scaffold', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation'));
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Spec\n');
    const result = runAdvance('plan-implementation', 'implement');
    expectHookDeny(result, 'impl-plan.md');
    expectHookDeny(result, 'impl-plan-template.md');
  });

  it('denies implement entry when the plan is missing a required section, naming it', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation'));
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Spec\n');
    writeFileSync(
      nodePath.join(ticketDirectory, 'impl-plan.md'),
      VALID_PLAN.replace('## Decisions', '## Notes'),
    );
    expectHookDeny(runAdvance('plan-implementation', 'implement'), 'Decisions');
  });

  it('denies implement entry when the plan status is still implemented from a replan loop', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation'));
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Spec\n');
    writeFileSync(
      nodePath.join(ticketDirectory, 'impl-plan.md'),
      VALID_PLAN.replace('**Status:** planned', '**Status:** implemented'),
    );
    expectHookDeny(runAdvance('plan-implementation', 'implement'), 'implemented');
  });

  it('grandfathers a legacy feature without spec.md', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation'));
    expectHookAllow(runAdvance('plan-implementation', 'implement'));
  });

  it('denies a justified provenance skip when the new-flow feature still has no plan', () => {
    const withSkip = [
      '---',
      `id: ${TICKET_ID}`,
      'type: feature',
      'phase: scenario-gate',
      'status: in_progress',
      'phase_skips:',
      '  - plan-implementation: plan captured in PR description',
      'scope:',
      '  - gate the implement entry',
      'out_of_scope:',
      '  - unrelated',
      'done_when:',
      '  - gated',
      '---',
      '',
      '# Ticket',
      '',
    ].join('\n');
    writeFileSync(ticketFile, withSkip);
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Spec\n');
    const result = runAdvance('scenario-gate', 'implement');
    expectHookDeny(result, 'impl-plan.md');
  });

  it('leaves task tickets unpoliced', () => {
    writeFileSync(ticketFile, ticketBody('scenario-gate', 'task'));
    expectHookAllow(runAdvance('scenario-gate', 'implement'));
  });
});
