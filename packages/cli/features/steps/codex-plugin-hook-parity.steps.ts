import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const TICKET_ID = 'ABC123';
const GO_SKILL_DESCRIPTION = 'Idiomatic Go: goroutines, channels, generics, error handling.';
const PARITY_MAP_PATH = nodePath.resolve(
  import.meta.dirname,
  '../../../../.project/tickets/39KJX7-codex-plugin-hook-parity/parity-map.md',
);
const PLUGIN_HOOKS_PATH = nodePath.resolve(import.meta.dirname, '../../codex-plugin/hooks.json');
const TEST_DEFINITIONS_PATCH = `*** Begin Patch
*** Add File: .project/tickets/${TICKET_ID}/test-definitions.md
+# Test Definitions
*** End Patch
`;

interface CodexPluginHookParityWorld extends SafewordWorld {
  codexHookInput?: object;
  codexHookRawInput?: string;
  retroRecordPath?: string;
  aliasResult?: { stdout: string; stderr: string; exitCode: number };
  hookManifestCommands?: string[];
  parityMap?: string;
}

function createProject(prefix: string): string {
  const projectRoot = mkdtempSync(nodePath.join(tmpdir(), prefix));
  writeFileSync(
    nodePath.join(projectRoot, 'package.json'),
    `${JSON.stringify({ name: 'codex-plugin-hook-parity-fixture', version: '1.0.0' }, undefined, 2)}\n`,
  );
  return projectRoot;
}

function installGoSkill(projectRoot: string): void {
  mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
  const skillDirectory = nodePath.join(projectRoot, '.agents', 'skills', 'golang-pro');
  mkdirSync(skillDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(skillDirectory, 'SKILL.md'),
    `---\nname: golang-pro\ndescription: "${GO_SKILL_DESCRIPTION}"\n---\n# Go\n`,
  );
}

function createIncompleteFeatureTicket(projectRoot: string): void {
  const ticketDirectory = nodePath.join(projectRoot, '.project', 'tickets', TICKET_ID);
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    [
      '---',
      `id: ${TICKET_ID}`,
      'type: feature',
      'phase: define-behavior',
      'status: in_progress',
      '---',
      '',
    ].join('\n'),
  );
}

function runGit(projectRoot: string, args: string[]): void {
  const result = spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function createActiveImplementationTicket(projectRoot: string): void {
  runGit(projectRoot, ['init', '--quiet']);
  runGit(projectRoot, ['config', 'user.email', 'test@example.com']);
  runGit(projectRoot, ['config', 'user.name', 'Test User']);

  const ticketDirectory = nodePath.join(projectRoot, '.project', 'tickets', TICKET_ID);
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    [
      '---',
      `id: ${TICKET_ID}`,
      'type: feature',
      'phase: implement',
      'status: in_progress',
      'scope:',
      '  - prove packaged Codex hook parity',
      'out_of_scope:',
      '  - unrelated agents',
      'done_when:',
      '  - quality state records Codex edits',
      '---',
      '',
    ].join('\n'),
  );
  writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Spec\n');
  writeFileSync(nodePath.join(ticketDirectory, 'dimensions.md'), 'skip: fixture\n');
  runGit(projectRoot, ['add', '.']);
  runGit(projectRoot, ['commit', '--quiet', '-m', 'fixture']);
}

function createDonePhaseArchitectureProject(projectRoot: string): void {
  runGit(projectRoot, ['init', '--quiet', '-b', 'main']);
  runGit(projectRoot, ['config', 'user.email', 'test@example.com']);
  runGit(projectRoot, ['config', 'user.name', 'Test User']);

  mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
  mkdirSync(nodePath.join(projectRoot, '.project', 'tickets', TICKET_ID), { recursive: true });
  writeFileSync(nodePath.join(projectRoot, 'ARCHITECTURE.md'), '# Architecture\n');
  writeFileSync(
    nodePath.join(projectRoot, '.project', 'architecture.generated.md'),
    '---\nfingerprint: base-shape\n---\n',
  );
  writeFileSync(
    nodePath.join(projectRoot, '.project', 'tickets', TICKET_ID, 'ticket.md'),
    [
      '---',
      `id: ${TICKET_ID}`,
      'type: feature',
      'phase: done',
      'status: in_progress',
      '---',
      '',
    ].join('\n'),
  );
  runGit(projectRoot, ['add', '.']);
  runGit(projectRoot, ['commit', '--quiet', '-m', 'baseline']);
  runGit(projectRoot, ['checkout', '--quiet', '-b', 'feature']);
  runGit(projectRoot, ['branch', '--set-upstream-to=main', 'feature']);
  writeFileSync(
    nodePath.join(projectRoot, '.project', 'architecture.generated.md'),
    '---\nfingerprint: changed-shape\n---\n',
  );

  const spoolDirectory = nodePath.join(projectRoot, '.safeword', 'retro-drafts');
  mkdirSync(spoolDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(spoolDirectory, 'codex-stop-session.jsonl'),
    `${JSON.stringify({
      signature: 'retro:architecture-precedence',
      title: 'Architecture precedence fixture',
      body: 'A sanitized finding.',
      labels: ['self-report'],
    })}\n`,
  );
}

function createRetroExtractionProject(projectRoot: string): { input: object; recordPath: string } {
  const recordPath = nodePath.join(projectRoot, 'retro-child-record.json');
  const sessionId = `codex-retro-${nodePath.basename(projectRoot)}`;
  mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(projectRoot, '.safeword', 'config.json'),
    JSON.stringify({ selfReport: { surface: true } }),
  );

  const localCliPath = nodePath.join(projectRoot, 'packages', 'cli', 'src', 'cli.ts');
  mkdirSync(nodePath.dirname(localCliPath), { recursive: true });
  writeFileSync(
    localCliPath,
    `import { writeFileSync } from 'node:fs';
writeFileSync(process.env.RECORD_PATH!, JSON.stringify({
  argv: Bun.argv.slice(2),
  cwd: process.cwd(),
  agent: process.env.SAFEWORD_RETRO_AGENT,
  child: process.env.SAFEWORD_RETRO_CHILD,
}));
`,
  );

  const transcriptPath = nodePath.join(projectRoot, 'substantial.jsonl');
  writeFileSync(
    transcriptPath,
    Array.from({ length: 3 }, () => JSON.stringify({ type: 'function_call', payload: {} })).join(
      '\n',
    ),
  );
  return {
    recordPath,
    input: {
      hook_event_name: 'Stop',
      session_id: sessionId,
      transcript_path: transcriptPath,
      cwd: projectRoot,
    },
  };
}

function runPackagedCodexHook(projectRoot: string, event: string, input: object | string) {
  const result = spawnSync(process.execPath, [CLI_PATH, 'hook', 'codex', event], {
    cwd: projectRoot,
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    // SessionStart upgrade notices are intentionally suppressed in CI. These
    // fixtures exercise the interactive hook path, including visible notices.
    env: { ...process.env, CI: '', CLAUDE_PROJECT_DIR: projectRoot },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

Given('a Codex project with an incomplete feature ticket', function (this: SafewordWorld) {
  this.temporaryDirectory = createProject('safeword-codex-plugin-hook-parity-');
  createIncompleteFeatureTicket(this.temporaryDirectory);
});

When(
  "the packaged Codex PreToolUse command receives an apply_patch that creates that ticket's test definitions",
  function (this: SafewordWorld) {
    this.result = runPackagedCodexHook(this.temporaryDirectory, 'pre-tool-use', {
      hook_event_name: 'PreToolUse',
      tool_name: 'apply_patch',
      tool_input: { command: TEST_DEFINITIONS_PATCH },
    });
  },
);

Given('a Codex session id and project namespace root', function (this: SafewordWorld) {
  this.temporaryDirectory = createProject('safeword-codex-plugin-hook-parity-');
  mkdirSync(nodePath.join(this.temporaryDirectory, '.project'), { recursive: true });
});

Given(
  'a Codex project with a dangerous broad process-kill command',
  function (this: CodexPluginHookParityWorld) {
    this.temporaryDirectory = createProject('safeword-codex-plugin-hook-parity-');
    this.codexHookInput = {
      hook_event_name: 'PreToolUse',
      session_id: 'codex-shell-safety-session',
      tool_name: 'Bash',
      tool_input: { command: 'killall bun' },
    };
  },
);

When(
  'the packaged Codex PreToolUse command sees Safe Word proof commands',
  function (this: SafewordWorld) {
    const command = [
      'bun "$CLAUDE_PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$CLAUDE_PROJECT_DIR" bdd',
      'bun .safeword/hooks/write-review-stamp.ts --phase define-behavior',
    ].join(' && ');

    this.result = runPackagedCodexHook(this.temporaryDirectory, 'pre-tool-use', {
      hook_event_name: 'PreToolUse',
      session_id: 'codex-session-1',
      tool_name: 'Bash',
      tool_input: { command },
    });
  },
);

When(
  'the packaged Codex PreToolUse command receives that shell command',
  function (this: CodexPluginHookParityWorld) {
    assert.ok(this.codexHookInput, 'Codex shell command input was not prepared');
    this.result = runPackagedCodexHook(
      this.temporaryDirectory,
      'pre-tool-use',
      this.codexHookInput,
    );
  },
);

Given('a Codex project with an active implementation ticket', function (this: SafewordWorld) {
  this.temporaryDirectory = createProject('safeword-codex-plugin-hook-parity-');
  createActiveImplementationTicket(this.temporaryDirectory);
});

Given(
  'a Codex done-phase session with an architecture documentation nudge',
  function (this: CodexPluginHookParityWorld) {
    this.temporaryDirectory = createProject('safeword-codex-plugin-hook-parity-');
    createDonePhaseArchitectureProject(this.temporaryDirectory);
    this.codexHookInput = {
      hook_event_name: 'Stop',
      session_id: 'codex-stop-session',
      cwd: this.temporaryDirectory,
    };
  },
);

Given('retro drafts are also waiting to be filed', function (this: SafewordWorld) {
  assert.equal(
    existsSync(
      nodePath.join(
        this.temporaryDirectory,
        '.safeword',
        'retro-drafts',
        'codex-stop-session.jsonl',
      ),
    ),
    true,
    'expected a spooled retro draft',
  );
});

Given('malformed Codex Stop input', function (this: CodexPluginHookParityWorld) {
  this.temporaryDirectory = createProject('safeword-codex-plugin-hook-parity-');
  this.codexHookRawInput = '{ not valid JSON';
});

Given(
  'a substantial Codex Stop payload with a readable transcript',
  function (this: CodexPluginHookParityWorld) {
    this.temporaryDirectory = createProject('safeword-codex-plugin-hook-parity-');
    const retro = createRetroExtractionProject(this.temporaryDirectory);
    this.codexHookInput = retro.input;
    this.retroRecordPath = retro.recordPath;
  },
);

Given(
  'a Codex project with no applicable Safe Word upgrade',
  function (this: CodexPluginHookParityWorld) {
    this.temporaryDirectory = createProject('safeword-codex-plugin-hook-parity-');
    const safewordDirectory = nodePath.join(this.temporaryDirectory, '.safeword');
    mkdirSync(safewordDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(safewordDirectory, 'config.json'),
      JSON.stringify({ autoUpgrade: false }),
    );
    writeFileSync(
      nodePath.join(safewordDirectory, 'SAFEWORD.md'),
      '# Project SAFEWORD context after upgrade check\n',
    );
    this.codexHookInput = { hook_event_name: 'SessionStart', cwd: this.temporaryDirectory };
  },
);

Given(
  'the shared auto-upgrade core reports a visible notice',
  function (this: CodexPluginHookParityWorld) {
    this.temporaryDirectory = createProject('safeword-codex-plugin-hook-parity-');
    const safewordDirectory = nodePath.join(this.temporaryDirectory, '.safeword');
    mkdirSync(safewordDirectory, { recursive: true });
    writeFileSync(nodePath.join(safewordDirectory, 'version'), '1.0.0\n');
    writeFileSync(
      nodePath.join(safewordDirectory, '.update-cache.json'),
      JSON.stringify({
        latestVersion: '2.0.0',
        publishedAt: Date.now(),
        checkedAt: Date.now(),
      }),
    );
    writeFileSync(nodePath.join(safewordDirectory, 'SAFEWORD.md'), '# Project context\n');
    this.codexHookInput = { hook_event_name: 'SessionStart', cwd: this.temporaryDirectory };
  },
);

Given(
  'queued Safe Word prompt context for a Codex project',
  function (this: CodexPluginHookParityWorld) {
    this.temporaryDirectory = createProject('safeword-codex-plugin-hook-parity-');
    mkdirSync(nodePath.join(this.temporaryDirectory, '.project'), { recursive: true });
    writeFileSync(
      nodePath.join(this.temporaryDirectory, '.project', 'codex-prompt-context.txt'),
      'Continue with the queued Safe Word proof work.',
    );
    this.codexHookInput = { hook_event_name: 'UserPromptSubmit', cwd: this.temporaryDirectory };
  },
);

Given(
  'no queued Safe Word prompt context for a Codex project',
  function (this: CodexPluginHookParityWorld) {
    this.temporaryDirectory = createProject('safeword-codex-plugin-hook-parity-');
    this.codexHookInput = { hook_event_name: 'UserPromptSubmit', cwd: this.temporaryDirectory };
  },
);

Given(
  'a Codex edit that creates source code needing a language skill nudge',
  function (this: CodexPluginHookParityWorld) {
    this.temporaryDirectory = createProject('safeword-codex-plugin-hook-parity-');
    installGoSkill(this.temporaryDirectory);
    this.codexHookInput = {
      hook_event_name: 'PostToolUse',
      session_id: 'codex-session-3',
      tool_name: 'Write',
      tool_input: { file_path: nodePath.join(this.temporaryDirectory, 'main.go') },
    };
  },
);

Given('a Codex edit that changes only markdown', function (this: CodexPluginHookParityWorld) {
  this.temporaryDirectory = createProject('safeword-codex-plugin-hook-parity-');
  installGoSkill(this.temporaryDirectory);
  this.codexHookInput = {
    hook_event_name: 'PostToolUse',
    session_id: 'codex-session-4',
    tool_name: 'Write',
    tool_input: { file_path: nodePath.join(this.temporaryDirectory, 'notes.md') },
  };
});

When(
  'the packaged Codex PostToolUse command receives an apply_patch edit',
  function (this: SafewordWorld) {
    const patch = [
      '*** Begin Patch',
      `*** Update File: ${nodePath.join(this.temporaryDirectory, '.project/tickets', TICKET_ID, 'spec.md')}`,
      '@@',
      '-# Spec',
      '+# Spec updated',
      '*** End Patch',
    ].join('\n');

    this.result = runPackagedCodexHook(this.temporaryDirectory, 'post-tool-use', {
      hook_event_name: 'PostToolUse',
      session_id: 'codex-session-2',
      tool_name: 'apply_patch',
      tool_input: { command: patch },
    });
  },
);

When('the packaged Codex PostToolUse command runs', function (this: CodexPluginHookParityWorld) {
  assert.ok(this.codexHookInput, 'Codex hook input was not prepared');
  this.result = runPackagedCodexHook(this.temporaryDirectory, 'post-tool-use', this.codexHookInput);
});

When('the packaged Codex Stop command runs', function (this: CodexPluginHookParityWorld) {
  const input = this.codexHookRawInput ?? this.codexHookInput;
  assert.ok(input !== undefined, 'Codex Stop input was not prepared');
  const recordPath = this.retroRecordPath;
  if (recordPath) process.env.RECORD_PATH = recordPath;
  try {
    this.result = runPackagedCodexHook(this.temporaryDirectory, 'stop', input);
  } finally {
    if (recordPath) delete process.env.RECORD_PATH;
  }
});

When('the packaged Codex SessionStart command runs', function (this: CodexPluginHookParityWorld) {
  assert.ok(this.codexHookInput, 'Codex SessionStart input was not prepared');
  this.result = runPackagedCodexHook(this.temporaryDirectory, 'session-start', this.codexHookInput);
});

When(
  'the packaged Codex UserPromptSubmit command runs',
  function (this: CodexPluginHookParityWorld) {
    assert.ok(this.codexHookInput, 'Codex UserPromptSubmit input was not prepared');
    this.result = runPackagedCodexHook(
      this.temporaryDirectory,
      'user-prompt-submit',
      this.codexHookInput,
    );
  },
);

Given(
  'the legacy Codex adapters and packaged hook command are inspected',
  function (this: CodexPluginHookParityWorld) {
    this.parityMap = existsSync(PARITY_MAP_PATH) ? readFileSync(PARITY_MAP_PATH, 'utf8') : '';
  },
);

When('the parity audit is generated', function (this: CodexPluginHookParityWorld) {
  assert.notEqual(this.parityMap, '', 'parity map is missing');
});

Given('the Codex plugin hook manifest', function (this: CodexPluginHookParityWorld) {
  const manifest = JSON.parse(readFileSync(PLUGIN_HOOKS_PATH, 'utf8')) as {
    hooks?: Record<string, { hooks?: { command?: string }[] }[]>;
  };
  this.hookManifestCommands = Object.values(manifest.hooks ?? {})
    .flat()
    .flatMap(entry => entry.hooks ?? [])
    .map(hook => hook.command ?? '');
});

When('hook commands are inspected', function (this: SafewordWorld) {
  assert.ok((this as CodexPluginHookParityWorld).hookManifestCommands?.length);
});

Given(
  'a legacy Safe Word Codex hook command invokes `safeword codex-hook pre-tool-use`',
  function (this: CodexPluginHookParityWorld) {
    this.temporaryDirectory = createProject('safeword-codex-plugin-hook-parity-');
    createIncompleteFeatureTicket(this.temporaryDirectory);
    this.codexHookInput = {
      hook_event_name: 'PreToolUse',
      tool_name: 'apply_patch',
      tool_input: { command: TEST_DEFINITIONS_PATCH },
    };
  },
);

When(
  'it receives the same blocked edit payload as `safeword hook codex pre-tool-use`',
  function (this: CodexPluginHookParityWorld) {
    assert.ok(this.codexHookInput, 'Codex hook input was not prepared');
    this.result = runPackagedCodexHook(
      this.temporaryDirectory,
      'pre-tool-use',
      this.codexHookInput,
    );
    const result = spawnSync(process.execPath, [CLI_PATH, 'codex-hook', 'pre-tool-use'], {
      cwd: this.temporaryDirectory,
      input: JSON.stringify(this.codexHookInput),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: this.temporaryDirectory },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.aliasResult = {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exitCode: result.status ?? 1,
    };
  },
);

Then('it denies the edit with the Safe Word intake gate reason', function (this: SafewordWorld) {
  assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  assert.match(this.result.stdout, /"permissionDecision":"deny"/u);
  assert.match(this.result.stdout, /scope/u);
});

Then('the denial explains the Codex `$explain` escape hatch', function (this: SafewordWorld) {
  assert.match(this.result.stdout, /Run `\$explain`/u);
  assert.doesNotMatch(this.result.stdout, /Run `\/explain`/u);
});

Then(
  'it writes the Codex run identity bridge files expected by the proof helpers',
  function (this: SafewordWorld) {
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);

    const runIdentityPath = nodePath.join(
      this.temporaryDirectory,
      '.project',
      'codex-run-identity.json',
    );
    const reviewStampIdentityPath = nodePath.join(
      this.temporaryDirectory,
      '.project',
      'codex-review-stamp-identity.json',
    );

    assert.equal(existsSync(runIdentityPath), true, 'missing codex-run-identity.json');
    assert.equal(
      existsSync(reviewStampIdentityPath),
      true,
      'missing codex-review-stamp-identity.json',
    );

    const runIdentity = JSON.parse(readFileSync(runIdentityPath, 'utf8')) as {
      id?: string;
      skillName?: string;
      recordedAt?: string;
    };
    const reviewStampIdentity = JSON.parse(readFileSync(reviewStampIdentityPath, 'utf8')) as {
      id?: string;
      skillName?: string;
      recordedAt?: string;
    };

    assert.deepEqual(
      { id: runIdentity.id, skillName: runIdentity.skillName },
      { id: 'codex-session-1', skillName: 'bdd' },
    );
    assert.match(runIdentity.recordedAt ?? '', /^\d{4}-\d{2}-\d{2}T/u);

    assert.deepEqual(
      { id: reviewStampIdentity.id, skillName: reviewStampIdentity.skillName },
      { id: 'codex-session-1', skillName: 'review-stamp' },
    );
    assert.match(reviewStampIdentity.recordedAt ?? '', /^\d{4}-\d{2}-\d{2}T/u);
  },
);

Then(
  'it denies the command with the shared process-kill gate reason',
  function (this: SafewordWorld) {
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
    assert.match(this.result.stdout, /killall/u);
    assert.match(this.result.stdout, /permissionDecision":"deny/u);
  },
);

Then(
  'the shared quality state records the Codex edit under that session',
  function (this: SafewordWorld) {
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
    const statePath = nodePath.join(
      this.temporaryDirectory,
      '.project',
      'quality-state-codex-codex-session-2.json',
    );
    assert.equal(existsSync(statePath), true, 'missing codex quality-state file');

    const state = JSON.parse(readFileSync(statePath, 'utf8')) as { activeTicket?: string };
    assert.equal(state.activeTicket, TICKET_ID);
  },
);

Then(
  'it emits Codex PostToolUse additionalContext from the shared skill nudge hook',
  function (this: SafewordWorld) {
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
    const parsed = JSON.parse(this.result.stdout) as {
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
    };
    assert.equal(parsed.hookSpecificOutput?.hookEventName, 'PostToolUse');
    assert.match(parsed.hookSpecificOutput?.additionalContext ?? '', /golang-pro/u);
    assert.match(parsed.hookSpecificOutput?.additionalContext ?? '', /Idiomatic Go/u);
  },
);

Then('it emits no language skill nudge additionalContext', function (this: SafewordWorld) {
  assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  assert.equal(this.result.stdout.trim(), '');
});

Then('it blocks with the architecture continuation', function (this: SafewordWorld) {
  assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  const parsed = JSON.parse(this.result.stdout) as { decision?: string; reason?: string };
  assert.equal(parsed.decision, 'block');
  assert.match(parsed.reason ?? '', /Architecture narrative \(ARCHITECTURE\.md\) may be stale/u);
});

Then('it does not emit a second continuation', function (this: SafewordWorld) {
  const parsed = JSON.parse(this.result.stdout) as { reason?: string };
  assert.doesNotMatch(parsed.reason ?? '', /safeword-retro-filer/u);
});

Then('it exits successfully with the no-continuation JSON object', function (this: SafewordWorld) {
  assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  assert.equal(this.result.stdout.trim(), '{}');
});

Then('it launches the Codex retro extraction path', function (this: CodexPluginHookParityWorld) {
  assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  assert.ok(this.retroRecordPath, 'retro extraction record path was not prepared');
  assert.equal(existsSync(this.retroRecordPath), true, 'retro extraction child did not run');
  const record = JSON.parse(readFileSync(this.retroRecordPath, 'utf8')) as {
    argv?: string[];
    cwd?: string;
    agent?: string;
    child?: string;
  };
  assert.equal(record.cwd, realpathSync(this.temporaryDirectory));
  assert.equal(record.agent, 'codex');
  assert.equal(record.child, '1');
  assert.ok(record.argv?.includes('retro'), 'retro child did not receive the retro command');
  assert.ok(record.argv?.includes('--auto-extract'), 'retro child was not auto-extracting');
});

Then(
  'it returns no conversation-visible output unless filing is required',
  function (this: SafewordWorld) {
    assert.equal(this.result.stdout.trim(), '{}');
  },
);

Then('it invokes the shared auto-upgrade core', function (this: SafewordWorld) {
  assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  const parsed = JSON.parse(this.result.stdout) as {
    hookSpecificOutput?: { additionalContext?: string };
  };
  assert.match(parsed.hookSpecificOutput?.additionalContext ?? '', /SAFEWORD Agent Instructions/u);
});

Then(
  'it emits SessionStart additionalContext containing package-owned SAFEWORD.md',
  function (this: SafewordWorld) {
    const parsed = JSON.parse(this.result.stdout) as {
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
    };
    assert.equal(parsed.hookSpecificOutput?.hookEventName, 'SessionStart');
    assert.match(
      parsed.hookSpecificOutput?.additionalContext ?? '',
      /SAFEWORD Agent Instructions/u,
    );
  },
);

Then('the notice is included in SessionStart additionalContext', function (this: SafewordWorld) {
  assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  const parsed = JSON.parse(this.result.stdout) as {
    systemMessage?: string;
    hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
  };
  assert.match(parsed.systemMessage ?? '', /v2\.0\.0 available \(major\)/u);
  assert.equal(parsed.hookSpecificOutput?.hookEventName, 'SessionStart');
  assert.match(parsed.hookSpecificOutput?.additionalContext ?? '', /SAFEWORD Agent Instructions/u);
});

Then('the command exits successfully', function (this: SafewordWorld) {
  assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
});

Then(
  'it emits Codex UserPromptSubmit additionalContext containing that queued context',
  function (this: SafewordWorld) {
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
    const parsed = JSON.parse(this.result.stdout) as {
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
    };
    assert.equal(parsed.hookSpecificOutput?.hookEventName, 'UserPromptSubmit');
    assert.match(
      parsed.hookSpecificOutput?.additionalContext ?? '',
      /Continue with the queued Safe Word proof work\./u,
    );
  },
);

Then(
  'the queued context remains project-owned data, not plugin implementation',
  function (this: SafewordWorld) {
    assert.equal(
      existsSync(nodePath.join(this.temporaryDirectory, '.project', 'codex-prompt-context.txt')),
      true,
    );
    assert.equal(
      existsSync(
        nodePath.join(this.temporaryDirectory, '.safeword', 'hooks', 'codex', 'prompt.ts'),
      ),
      false,
    );
  },
);

Then('it exits successfully with no additionalContext', function (this: SafewordWorld) {
  assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  assert.equal(this.result.stdout.trim(), '');
});

Then(
  'every behavior is marked preserve redesign or defer with a rationale',
  function (this: CodexPluginHookParityWorld) {
    const map = this.parityMap ?? '';
    for (const behavior of [
      'PreToolUse quality gate and proof identity',
      'PostToolUse quality state and skill nudge',
      'Stop architecture, retro extraction, and filing',
      'SessionStart auto-upgrade and context',
      'UserPromptSubmit queued context',
      'Adapter-local crash capture',
    ]) {
      assert.ok(map.includes(`| ${behavior} |`), `missing parity decision for ${behavior}`);
    }
    assert.match(map, /\| (?:Preserve|Redesign|Defer) \| .+ \|/u);
  },
);

Then(
  'every preserved behavior names a deterministic proof',
  function (this: CodexPluginHookParityWorld) {
    const map = this.parityMap ?? '';
    const preserved = map.split('\n').filter(line => line.includes('| Preserve |'));
    assert.ok(preserved.length >= 5, 'expected all preserved behaviors in the parity map');
    for (const row of preserved) assert.match(row, /cucumber-js|Vitest|BDD/u);
  },
);

Then(
  'every deferred behavior names the follow-up or explicit non-goal',
  function (this: CodexPluginHookParityWorld) {
    const deferred = (this.parityMap ?? '').split('\n').filter(line => line.includes('| Defer |'));
    assert.ok(deferred.length > 0, 'expected at least one explicit defer');
    for (const row of deferred) assert.match(row, /follow-up|non-goal/u);
  },
);

Then(
  'every Safe Word hook command runs `safeword hook codex`',
  function (this: CodexPluginHookParityWorld) {
    const commands = this.hookManifestCommands ?? [];
    assert.equal(commands.length, 5);
    for (const command of commands) {
      assert.match(command, /bunx --bun safeword@[\d.]+ hook codex [a-z-]+/u);
      assert.doesNotMatch(command, /npx/u);
    }
  },
);

Then(/^no command points at repo-local /u, function (this: CodexPluginHookParityWorld) {
  const commands = this.hookManifestCommands ?? [];
  for (const command of commands) {
    assert.doesNotMatch(command, /\.safeword\/hooks\/codex/u);
  }
});

Then(
  'both commands deny with the same Codex hook JSON contract',
  function (this: CodexPluginHookParityWorld) {
    assert.ok(this.aliasResult, 'compatibility alias was not run');
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
    assert.equal(this.aliasResult.exitCode, 0, this.aliasResult.stderr || this.aliasResult.stdout);
    assert.deepEqual(JSON.parse(this.aliasResult.stdout), JSON.parse(this.result.stdout));
  },
);

After(function (this: SafewordWorld) {
  if (this.temporaryDirectory === '') return;
  rmSync(this.temporaryDirectory, { recursive: true, force: true });
  this.temporaryDirectory = '';
});
