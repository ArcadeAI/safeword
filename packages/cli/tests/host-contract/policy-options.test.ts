import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { initGitRepo, setupReconcileTest, writeGateConfig } from '../helpers.js';
import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

const combinations = JSON.parse(
  readFileSync(
    nodePath.resolve(
      import.meta.dirname,
      '../fixtures/host-contract/documented-option-composition.json',
    ),
    'utf8',
  ),
) as Record<string, boolean>[];
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
async function installed() {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-policy-options-'));
  roots.push(root);
  initGitRepo(root);
  const committed = spawnSync(
    'git',
    [
      '-c',
      'commit.gpgsign=false',
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '--allow-empty',
      '-qm',
      'owned options fixture',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(committed.status, 0, committed.stderr);
  const setup = await setupReconcileTest(root);
  expect(setup.result.applied).toBe(true);
  const env = {
    PATH: process.env.PATH,
    HOME: nodePath.join(root, 'private-home'),
    XDG_CONFIG_HOME: nodePath.join(root, 'private-config'),
    CLAUDE_PROJECT_DIR: root,
    SAFEWORD_NO_AUTO_UPGRADE: '1',
    SAFEWORD_SKIP_INSTALL: '1',
    SAFEWORD_PLUGIN_CLI: nodePath.resolve(import.meta.dirname, '../../dist/cli.js'),
  };
  const configure = (options: Record<string, boolean>) => {
    writeGateConfig(root, {
      ...options,
      selfReport: { capture: false, file: false, surface: false },
    });
  };
  const invoke = (event: 'PreToolUse' | 'Stop', owner: string, input: Record<string, unknown>) => {
    const manifest = JSON.parse(readFileSync(nodePath.join(root, '.claude/settings.json'), 'utf8'));
    const hook = manifest.hooks[event]
      .flatMap((row: { hooks: { command: string }[] }) => row.hooks)
      .find((row: { command: string }) => row.command.includes(`/${owner}`));
    assert.ok(hook, `Installed ${event}/${owner} binding missing`);
    const result = spawnSync('sh', ['-c', hook.command], {
      cwd: root,
      env,
      encoding: 'utf8',
      timeout: 30_000,
      input: JSON.stringify({
        cwd: root,
        hook_event_name: event,
        session_id: 'options-session',
        ...input,
      }),
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal ?? undefined, undefined);
    expect([0, 2], result.stderr).toContain(result.status);
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  };
  return { root, env, configure, invoke };
}
const plan =
  '# Impl Plan\n\n**Status:** planned\n\n## Approach\n\nOne synthetic slice.\n\n## Decisions\n\nUse the existing local store.\n\n## Design alignment\n\nskip: no configured principles\n\n## Known deviations\n\nskip: none\n\n## Assessment triggers\n\nRevisit if the data changes.\n';
function ticket(root: string, phase: string) {
  const directory = nodePath.join(root, '.project/tickets/OPT123-options');
  mkdirSync(directory, { recursive: true });
  const content = `---\nid: OPT123\ntype: feature\nstatus: in_progress\nphase: ${phase}\n---\n# Synthetic options\n`;
  writeFileSync(nodePath.join(directory, 'ticket.md'), content);
  writeFileSync(nodePath.join(directory, 'spec.md'), '# Synthetic spec\n');
  writeFileSync(
    nodePath.join(directory, 'impl-plan.md'),
    phase === 'verify' ? plan.replace('**Status:** planned', '**Status:** implemented') : plan,
  );
  writeFileSync(
    nodePath.join(root, '.project/quality-state-options-session.json'),
    JSON.stringify({ activeTicket: 'OPT123' }),
  );
  return { directory, content };
}

it('characterizes real installed Stop option composition without manufacturing review approvals', async () => {
  const fixture = await installed();
  ticket(fixture.root, 'verify');
  for (const options of combinations) {
    fixture.configure(options);
    const result = fixture.invoke('Stop', 'stop-quality.ts', {
      last_assistant_message: 'What is two plus two?',
    });
    if (options.architectureReviewGate) {
      expect(JSON.parse(result.stdout)).toMatchObject({
        decision: 'block',
        reason: expect.stringContaining('cited evidence'),
      });
    } else {
      expect(result.stdout).toBe('');
    }
  }
}, 120_000);

it('characterizes the installed handoff switch and the one-followup Cursor bound across combined settings', async () => {
  const fixture = await installed();
  const manifest = JSON.parse(
    readFileSync(nodePath.join(fixture.root, '.cursor/hooks.json'), 'utf8'),
  );
  const command = manifest.hooks.stop[0].command;
  const conversation_id = nodePath.basename(fixture.root);
  const transcript = nodePath.join(fixture.root, 'owned-transcript.jsonl');
  writeFileSync(
    transcript,
    `${JSON.stringify({ role: 'assistant', content: '**CONFIDENT** — Finished.\n\n**Next:** Continue.' })}\n`,
  );
  const invoke = (loop_count: number) => {
    const result = spawnSync('sh', ['-c', command], {
      cwd: fixture.root,
      env: fixture.env,
      encoding: 'utf8',
      timeout: 30_000,
      input: JSON.stringify({
        workspace_roots: [fixture.root],
        conversation_id,
        transcript_path: transcript,
        status: 'completed',
        loop_count,
      }),
    });
    assert.equal(result.error, undefined);
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout);
  };
  for (const options of combinations) {
    fixture.configure(options);
    if (options.terminalHandoffCorrection)
      expect(invoke(0).followup_message).toContain('terminal-handoff/v1 correction');
    else expect(invoke(0)).toEqual({});
    expect(invoke(1)).toEqual({});
  }
}, 120_000);

it('requires enabled design approval at the installed pre-action planning boundary', async () => {
  const fixture = await installed();
  const state = ticket(fixture.root, 'plan-implementation');
  const input = {
    tool_name: 'Write',
    tool_input: {
      file_path: nodePath.join(state.directory, 'ticket.md'),
      content: state.content.replace('phase: plan-implementation', 'phase: plan-execution'),
    },
  };
  fixture.configure({
    terminalHandoffCorrection: false,
    architectureReviewGate: false,
    crossModelReview: false,
    designApprovalGate: false,
    reviewGate: false,
  });
  expect(fixture.invoke('PreToolUse', 'pre-tool-quality.ts', input).status).toBe(0);
  fixture.configure({
    terminalHandoffCorrection: false,
    architectureReviewGate: false,
    crossModelReview: false,
    designApprovalGate: true,
    reviewGate: false,
  });
  const result = fixture.invoke('PreToolUse', 'pre-tool-quality.ts', input);
  expect(result.status, result.stderr).toBe(0);
  const output = JSON.parse(result.stdout || '{}');
  expect(output, `DESIGN_APPROVAL_OPTION_BYPASSED: ${result.stdout}${result.stderr}`).toMatchObject(
    {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: expect.stringMatching(/design approval.*approve-plan/isu),
      },
    },
  );
}, 120_000);

it.each([
  [
    'adapter-local predicate',
    '  const hookPath = resolvePackagedHook(relativePath);',
    "  if (relativePath === 'codex/stop.ts' && JSON.parse(readFileSync(nodePath.join(projectDirectory, '.safeword/config.json'), 'utf8')).terminalHandoffCorrection === false) return {status:0,stdout:'{}',stderr:''};\n  const hookPath = resolvePackagedHook(relativePath);",
    'terminalHandoffCorrection',
  ],
  [
    'option-dropping route',
    'CLAUDE_PROJECT_DIR: projectDirectory,',
    "CLAUDE_PROJECT_DIR: '',",
    'projectDirectory',
  ],
] as const)(
  'rejects %s at the public repository boundary and repairs',
  (_name, from, to, option) => {
    const root = createContractRepoFixture();
    roots.push(nodePath.dirname(root));
    expect(runContractRepoCheck(root).status).toBe(0);
    const path = nodePath.join(root, 'packages/cli/src/commands/codex-hook.ts');
    const original = readFileSync(path, 'utf8');
    expect(original).toContain('  readFileSync,');
    expect(original).toContain("import nodePath from 'node:path'");
    expect(original).toContain(from);
    writeFileSync(
      path,
      original.replace(from, () => to),
    );
    const refresh = () => {
      for (const script of ['generate-claude-plugin.ts', 'generate-codex-plugin.ts']) {
        const generated = spawnSync('bun', [`scripts/${script}`], {
          cwd: nodePath.join(root, 'packages/cli'),
          encoding: 'utf8',
          timeout: 60_000,
        });
        assert.equal(generated.status, 0, `${generated.stdout}${generated.stderr}`);
      }
    };
    refresh();
    const broken = runContractRepoCheck(root);
    const errors = JSON.parse(broken.output).findings.filter(
      (row: { severity: string }) => row.severity === 'error',
    );
    expect(
      errors.filter((row: { code: string }) => row.code !== 'HOST_CONTRACT_OPTION_BYPASS'),
    ).toEqual([]);
    expect(broken.status, 'OPTION_ROUTE_BYPASS_UNDETECTED').toBe(2);
    expect(JSON.parse(broken.output).findings, 'OPTION_ROUTE_BYPASS_UNDETECTED').toContainEqual(
      expect.objectContaining({
        code: 'HOST_CONTRACT_OPTION_BYPASS',
        message: expect.stringContaining('packages/cli/src/commands/codex-hook.ts'),
        metadata: expect.objectContaining({ option }),
      }),
    );
    writeFileSync(path, original);
    refresh();
    expect(runContractRepoCheck(root).status).toBe(0);
  },
  120_000,
);
