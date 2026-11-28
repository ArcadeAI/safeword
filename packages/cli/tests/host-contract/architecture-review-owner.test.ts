import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, expect, it } from 'vitest';

import { architectureReviewReason } from '../../templates/hooks/lib/architecture-review-gate.js';
import { cursorEditedMarkerPath } from '../../templates/hooks/lib/cursor-state.js';
import { getStateFilePath } from '../../templates/hooks/lib/quality-state.js';
import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import architecture from '../fixtures/host-contract/propagation-architecture-case.json';
import { createTypeScriptPackageJson, setupOrThrow } from '../helpers.js';

const fixture = { project: '', plugin: '' };

beforeAll(async () => {
  fixture.project = mkdtempSync('/tmp/safeword-architecture-owner-');
  createTypeScriptPackageJson(fixture.project);
  await setupOrThrow(fixture.project);
  fixture.plugin = nodePath.join(fixture.project, 'installed-codex');
  cpSync(nodePath.resolve(import.meta.dirname, '../../codex-plugin'), fixture.plugin, {
    recursive: true,
  });
  for (const file of ['codex/stop.ts', 'lib/architecture-review-gate.ts']) {
    expect(readFileSync(nodePath.join(fixture.plugin, 'templates/hooks', file), 'utf8')).toBe(
      readFileSync(nodePath.resolve(import.meta.dirname, '../../templates/hooks', file), 'utf8'),
    );
  }
});

afterAll(() => {
  if (fixture.project) rmSync(fixture.project, { recursive: true, force: true });
});

// No vendor process or review receipt is simulated: ordinary project inputs go
// through the public install and its actual Stop hook. No edit tool is needed.
function observe(
  id: string,
  options: { enabled?: boolean; type?: string; phase?: string; spec?: boolean; plan?: string },
) {
  const { project } = fixture;
  const ticket = nodePath.join(project, '.project/tickets', id);
  mkdirSync(ticket, { recursive: true });
  writeFileSync(
    nodePath.join(ticket, 'ticket.md'),
    `---\nid: ${id}\ntype: ${options.type ?? 'feature'}\nphase: ${options.phase ?? 'verify'}\nstatus: in_progress\n---\n`,
  );
  writeFileSync(nodePath.join(ticket, 'test-definitions.md'), '- [ ] Ordinary architecture case\n');
  if (options.spec !== false) writeFileSync(nodePath.join(ticket, 'spec.md'), architecture.spec);
  if (options.plan !== undefined)
    writeFileSync(nodePath.join(ticket, 'impl-plan.md'), options.plan);
  writeFileSync(
    nodePath.join(project, '.safeword/config.json'),
    JSON.stringify({
      architectureReviewGate: options.enabled ?? true,
      terminalHandoffCorrection: false,
    }),
  );
  writeFileSync(
    nodePath.join(project, '.project', `quality-state-${id}.json`),
    JSON.stringify({ activeTicket: id }),
  );
  const excluded = new Set([
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'SAFEWORD_PLUGIN_CLI',
    'SAFEWORD_CLI',
  ]);
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !excluded.has(name))),
    CLAUDE_PROJECT_DIR: project,
  };
  const result = spawnSync('bun', ['.safeword/hooks/stop-quality.ts'], {
    cwd: project,
    env,
    encoding: 'utf8',
    input: JSON.stringify({ session_id: id, stop_hook_active: true }),
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

it('blocks uncited feature verify before edit and active-hook early exits', () => {
  const decision = observe('ARC001', { plan: architecture.plan });
  expect(decision.decision).toBe('block');
  expect(decision.reason).toContain('Decisions section needs cited evidence');
});

it.each([
  ['ARC002', { enabled: false, plan: architecture.plan }],
  ['ARC003', { type: 'task' }],
  ['ARC004', { spec: false }],
  ['ARC005', { phase: 'define-behavior' }],
  ['ARC006', { phase: 'implement', plan: architecture.plan.replace('implemented', 'planned') }],
] as const)('preserves the default or exempt Stop outcome for %s', (id, options) => {
  expect(observe(id, options)).toEqual({});
});

it.each([
  ['ARC007', {}, 'requires impl-plan.md'],
  ['ARC008', { plan: '# Malformed plan\n' }, 'impl-plan.md validation failed'],
  [
    'ARC009',
    { plan: architecture.plan.replace('implemented', 'planned') },
    'reconciliation incomplete',
  ],
  ['ARC010', { enabled: false }, 'requires impl-plan.md'],
] as const)('preserves prerequisite precedence for %s', (id, options, reason) => {
  const decision = observe(id, options);
  expect(decision.decision).toBe('block');
  expect(decision.reason).toContain(reason);
  expect(decision.reason).not.toContain('Decisions section needs cited evidence');
});

it('a reasoned Decisions skip reaches the independent review check', () => {
  const decision = observe('ARC011', {
    plan: architecture.plan.replace('Use the existing local store.', 'skip: one local extraction'),
  });
  expect(decision.decision).toBe('block');
  expect(decision.reason).toContain('no independent design review');
  expect(decision.reason).not.toContain('Decisions section needs cited evidence');
});

it.each([
  [undefined, 'requires impl-plan.md'],
  ['# malformed\n', 'impl-plan.md validation failed'],
  [architecture.plan.replace('implemented', 'planned'), 'reconciliation incomplete'],
] as const)('shared entrypoint preserves enabled prerequisite: %s', (plan, reason) => {
  const id = `DIRECT${reason.length}`;
  observe(id, { plan });
  expect(
    architectureReviewReason(fixture.project, { type: 'feature', phase: 'verify', folder: id }),
  ).toContain(reason);
});

it('disabled shared entrypoint adds no plan prerequisite', () => {
  observe('DIRECTOFF', { enabled: false });
  expect(
    architectureReviewReason(fixture.project, {
      type: 'feature',
      phase: 'verify',
      folder: 'DIRECTOFF',
    }),
  ).toBeUndefined();
});

// This is a packaged callback process boundary, NOT a native Codex/trust run.
function codexStop(session: string, active = false) {
  const hooks = JSON.parse(readFileSync(nodePath.join(fixture.plugin, 'hooks.json'), 'utf8'));
  const command = hooks.hooks.Stop[0].hooks[0].command;
  const excluded = new Set([
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'SAFEWORD_PLUGIN_CLI',
    'SAFEWORD_CLI',
  ]);
  const result = spawnSync('sh', ['-c', command], {
    cwd: fixture.project,
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !excluded.has(name))),
      HOME: fixture.project,
      CODEX_HOME: nodePath.join(fixture.project, 'owned-codex-home'),
      PLUGIN_ROOT: fixture.plugin,
      CLAUDE_PROJECT_DIR: fixture.project,
    },
    encoding: 'utf8',
    input: JSON.stringify({
      cwd: fixture.project,
      session_id: session,
      turn_id: 'architecture-turn',
      stop_hook_active: active,
    }),
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  return JSON.parse(result.stdout);
}

function bindCodex(session: string, ticket: string) {
  const identity = resolveRunIdentity({ session_id: session }, { runtime: 'codex' });
  writeFileSync(
    getStateFilePath(fixture.project, identity),
    JSON.stringify({ activeTicket: ticket }),
  );
}

it('Codex packaged Stop enforces cited evidence for the explicitly bound verify ticket', () => {
  observe('CDXARC', { plan: architecture.plan });
  writeFileSync(
    nodePath.join(fixture.project, '.safeword/config.json'),
    JSON.stringify({
      architectureReviewGate: true,
      terminalHandoffCorrection: false,
      selfReport: { capture: false, surface: false, file: false },
    }),
  );
  bindCodex('codex-architecture', 'CDXARC');
  const decision = codexStop('codex-architecture');
  expect(decision.decision, 'CODEX_ARCHITECTURE_CITATION_REQUIRED').toBe('block');
  expect(decision.reason).toContain('Decisions section needs cited evidence');
});

it('Codex keeps the same session binding and suppresses only the active correction', () => {
  observe('CDXSESSION', { plan: architecture.plan });
  writeFileSync(
    nodePath.join(fixture.project, '.safeword/config.json'),
    JSON.stringify({
      architectureReviewGate: true,
      terminalHandoffCorrection: false,
      selfReport: { capture: false, surface: false, file: false },
    }),
  );
  bindCodex('codex-session', 'CDXSESSION');
  expect(codexStop('codex-session', true)).toEqual({});
  expect(codexStop('codex-unbound').reason ?? '').not.toContain('Architecture review gate');
  observe('CDXOTHER', { type: 'task' });
  bindCodex('codex-other', 'CDXOTHER');
  expect(codexStop('codex-other')).toEqual({});
  const again = codexStop('codex-session');
  expect(again.decision, 'CODEX_ARCHITECTURE_SESSION_BINDING_REQUIRED').toBe('block');
  expect(again.reason).toContain('Decisions section needs cited evidence');
});

it('Codex architecture verdict precedes otherwise valid done mutation', () => {
  observe('CDXDONE', { plan: architecture.plan });
  const ticket = nodePath.join(fixture.project, '.project/tickets/CDXDONE');
  const file = nodePath.join(ticket, 'ticket.md');
  const before = readFileSync(file, 'utf8').replace('phase: verify', 'phase: done');
  writeFileSync(file, before);
  writeFileSync(
    nodePath.join(fixture.project, 'package.json'),
    JSON.stringify({ scripts: { test: 'node architecture-fixture.cjs' } }),
  );
  writeFileSync(
    nodePath.join(fixture.project, 'architecture-fixture.cjs'),
    "require('node:assert/strict').equal(2 * 2, 4);\n",
  );
  writeFileSync(nodePath.join(ticket, 'verify.md'), '**PR Scope:** ✅ Diff matches the fixture\n');
  writeFileSync(
    nodePath.join(ticket, 'test-definitions.md'),
    '- [x] Local Node fixture doubles two to four\n',
  );
  const config = nodePath.join(fixture.project, '.safeword/config.json');
  const options = {
    terminalHandoffCorrection: false,
    selfReport: { capture: false, surface: false, file: false },
  };
  writeFileSync(config, JSON.stringify({ ...options, architectureReviewGate: false }));
  bindCodex('codex-done', 'CDXDONE');
  codexStop('codex-done');
  expect(readFileSync(file, 'utf8'), 'DONE_GIVEN_MUST_COMPLETE_WITH_GATE_OFF').toMatch(
    /^status: done$/m,
  );
  writeFileSync(file, before);
  writeFileSync(config, JSON.stringify({ ...options, architectureReviewGate: true }));
  const decision = codexStop('codex-done');
  expect(decision.reason ?? '', 'CODEX_ARCHITECTURE_DONE_BEFORE_MUTATION_REQUIRED').toContain(
    'Decisions section needs cited evidence',
  );
  expect(readFileSync(file, 'utf8')).toBe(before);
});

it.each([false, true])(
  'Codex gate %s handles a bound missing plan without a default-on prerequisite',
  enabled => {
    const id = enabled ? 'CDXPLANON' : 'CDXPLANOFF';
    observe(id, { enabled });
    writeFileSync(
      nodePath.join(fixture.project, '.safeword/config.json'),
      JSON.stringify({
        architectureReviewGate: enabled,
        terminalHandoffCorrection: false,
        selfReport: { capture: false, surface: false, file: false },
      }),
    );
    bindCodex(id, id);
    const decision = codexStop(id);
    if (enabled) {
      expect(decision.reason ?? '', 'CODEX_ARCHITECTURE_PREREQUISITE_REQUIRED').toContain(
        'requires impl-plan.md',
      );
    } else {
      expect(decision).toEqual({});
    }
  },
);

// Both real delivery commands consume substituted event input, not a native UI run.
const cursor = { plugin: '' };
beforeAll(() => {
  cursor.plugin = nodePath.join(fixture.project, 'installed-cursor');
  const generated = spawnSync(
    'bun',
    [
      nodePath.resolve(import.meta.dirname, '../../scripts/generate-cursor-plugin.ts'),
      '--output',
      cursor.plugin,
    ],
    { encoding: 'utf8' },
  );
  expect(generated.status, generated.stderr).toBe(0);
});

function cursorGiven(id: string, enabled = true, plan: string | undefined = architecture.plan) {
  observe(id, { enabled, plan });
  writeFileSync(
    nodePath.join(fixture.project, '.safeword/config.json'),
    JSON.stringify({
      architectureReviewGate: enabled,
      terminalHandoffCorrection: false,
      selfReport: { capture: false, surface: false, file: false },
    }),
  );
  const identity = resolveRunIdentity({ conversation_id: id }, { runtime: 'cursor' });
  writeFileSync(getStateFilePath(fixture.project, identity), JSON.stringify({ activeTicket: id }));
}

function cursorStop(mode: 'project' | 'native', id: string, extra: Record<string, unknown> = {}) {
  const root = mode === 'project' ? fixture.project : cursor.plugin;
  const manifest = mode === 'project' ? '.cursor/hooks.json' : 'hooks/hooks.json';
  const hooks = JSON.parse(readFileSync(nodePath.join(root, manifest), 'utf8'));
  expect(hooks.hooks.stop).toHaveLength(1);
  expect(hooks.hooks.stop[0].loop_limit).toBe(1);
  const excluded = new Set([
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'CLAUDE_PROJECT_DIR',
    'SAFEWORD_CLI',
    'SAFEWORD_PLUGIN_CLI',
  ]);
  const result = spawnSync('sh', ['-c', hooks.hooks.stop[0].command], {
    cwd: fixture.project,
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !excluded.has(name))),
      HOME: fixture.project,
      CURSOR_PLUGIN_ROOT: cursor.plugin,
      ...(mode === 'project' && {
        SAFEWORD_CLI: nodePath.resolve(import.meta.dirname, '../../dist/cli.js'),
      }),
    },
    encoding: 'utf8',
    input: JSON.stringify({
      workspace_roots: [fixture.project],
      conversation_id: id,
      generation_id: 'architecture-turn',
      status: 'completed',
      loop_count: 0,
      ...extra,
    }),
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  return JSON.parse(result.stdout);
}

for (const mode of ['project', 'native'] as const) {
  it(`Cursor ${mode} Stop requests cited evidence only for its bound conversation at loop zero`, () => {
    const id = `CURSOR${mode}`;
    cursorGiven(id);
    expect(cursorStop(mode, `${id}-foreign`)).toEqual({});
    expect(cursorStop(mode, id, { status: 'aborted' })).toEqual({});
    expect(cursorStop(mode, id, { loop_count: 1 })).toEqual({});
    expect(
      cursorStop(mode, id).followup_message ?? '',
      'CURSOR_ARCHITECTURE_CITATION_REQUIRED',
    ).toContain('Decisions section needs cited evidence');
  });

  it(`Cursor ${mode} gate off adds no prerequisite; gate on reports the shared prerequisite`, () => {
    const id = `CURSORPLAN${mode}`;
    cursorGiven(id, false, '# malformed plan\n');
    expect(cursorStop(mode, id)).toEqual({});
    cursorGiven(id, true, '# malformed plan\n');
    expect(
      cursorStop(mode, id).followup_message ?? '',
      'CURSOR_ARCHITECTURE_PREREQUISITE_REQUIRED',
    ).toContain('impl-plan.md validation failed');
  });

  it(`Cursor ${mode} done evidence precedes architecture`, () => {
    const id = `CURSORDONE${mode}`;
    cursorGiven(id);
    const ticket = nodePath.join(fixture.project, '.project/tickets', id, 'ticket.md');
    writeFileSync(ticket, readFileSync(ticket, 'utf8').replace('phase: verify', 'phase: done'));
    writeFileSync(
      nodePath.join(fixture.project, 'package.json'),
      JSON.stringify({ scripts: { test: 'node architecture-fixture.cjs' } }),
    );
    writeFileSync(
      nodePath.join(fixture.project, 'architecture-fixture.cjs'),
      "require('node:assert/strict').equal(2 * 2, 4);\n",
    );
    const decision = cursorStop(mode, id);
    expect(decision.followup_message).toContain('No valid verify.md');
    expect(decision.followup_message).not.toContain('Decisions section needs cited evidence');
  });

  it(`Cursor ${mode} architecture precedes terminal repair without spending a second correction`, () => {
    const id = `CURSORHANDOFF${mode}`;
    cursorGiven(id);
    const config = nodePath.join(fixture.project, '.safeword/config.json');
    const options = JSON.parse(readFileSync(config, 'utf8'));
    writeFileSync(config, JSON.stringify({ ...options, terminalHandoffCorrection: true }));
    const transcript = nodePath.join(fixture.project, `${id}.jsonl`);
    writeFileSync(transcript, `${JSON.stringify({ role: 'assistant', content: 'READY' })}\n`);
    const marker = cursorEditedMarkerPath({ conversation_id: id });
    try {
      writeFileSync(marker, JSON.stringify({ generation_id: 'architecture-turn' }));
      const decision = cursorStop(mode, id, { transcript_path: transcript });
      expect(
        decision.followup_message ?? '',
        'CURSOR_ARCHITECTURE_BEFORE_HANDOFF_REQUIRED',
      ).toContain('Decisions section needs cited evidence');
      expect(cursorStop(mode, id, { transcript_path: transcript, loop_count: 1 })).toEqual({});
      writeFileSync(
        config,
        JSON.stringify({
          ...options,
          architectureReviewGate: false,
          terminalHandoffCorrection: true,
        }),
      );
      writeFileSync(marker, JSON.stringify({ generation_id: 'architecture-turn' }));
      expect(cursorStop(mode, id, { transcript_path: transcript }).followup_message).toContain(
        'terminal-handoff/v1 correction',
      );
    } finally {
      rmSync(marker, { force: true });
    }
  });
}
