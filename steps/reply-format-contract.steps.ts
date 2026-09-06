import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  DECISION_BRIEF_CONTRACT,
  DECISION_BRIEF_MAX_WORK_FACTOR,
  evaluateDecisionBriefCompliance,
} from '../packages/cli/templates/hooks/lib/quality.js';
import {
  buildReplyFormatProject,
  ensureReplyFormatState,
  getReplyFormatState,
  runReplyFormatStop,
  setReplyFormatState,
} from './generate-compliant-replies-without-rewrites.steps.js';
import type { SafewordWorld } from './world.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const PROMPT_QUESTIONS = nodePath.join(REPO_ROOT, '.safeword/hooks/prompt-questions.ts');
const SAFEWORD_CLI = nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts');
const QUALITY_TEMPLATE = nodePath.join(REPO_ROOT, 'packages/cli/templates/hooks/lib/quality.ts');
const QUALITY_DOGFOOD = nodePath.join(REPO_ROOT, '.safeword/hooks/lib/quality.ts');
const PROJECT_HANDBOOK_BOOTSTRAP = [
  'Safeword session bootstrap:',
  'Before non-trivial work, read `.safeword/SAFEWORD.md` and the applicable guide in `.safeword/guides/`.',
  'Current tickets, learnings, and project context are under `.project/` (or the configured namespace root).',
  'Follow the active Safeword workflow and its gates.',
].join('\n');
const PACKAGED_HANDBOOK_BOOTSTRAP = PROJECT_HANDBOOK_BOOTSTRAP.replace(
  'read `.safeword/SAFEWORD.md` and the applicable guide in `.safeword/guides/`',
  'read the packaged Safeword handbook and the applicable guide in the packaged Safeword guides',
);
const CONFIDENT = [
  '**CONFIDENT** — The change is complete.',
  '**Decided:** Keep the implementation focused.',
  '**Open:** none.',
  '**Next:** Review the result.',
];
const BLOCKED = [
  '**BLOCKED** — A release target is required.',
  '**Tried:** Checked the ticket and release configuration.',
  '**Need:** Choose the intended release target.',
];
const brief = (paragraphs: string[], separator = '\n\n') => paragraphs.join(separator);
const nestedBulletBrief = brief(CONFIDENT.map(paragraph => '  ' + paragraph));
const orderedListBrief = brief(CONFIDENT.map(paragraph => '   ' + paragraph));
const ignoredBriefs: Record<string, string> = {
  'a blockquote': brief(CONFIDENT.map(paragraph => `> ${paragraph}`)),
  'a list item': brief(CONFIDENT.map(paragraph => `- ${paragraph}`)),
  'fenced code': ['```md', ...CONFIDENT, '```'].join('\n\n'),
  'indented code': brief(CONFIDENT.map(paragraph => `    ${paragraph}`)),
  'an HTML comment': `<!--\n${brief(CONFIDENT)}\n-->`,
  'an HTML block': `<div>\n${brief(CONFIDENT, '\n')}\n</div>`,
  'a nested bullet continuation': `- example\n\n${nestedBulletBrief}`,
  'an ordered-list continuation': `1. example\n\n${orderedListBrief}`,
  'an HTML declaration': `<!DOCTYPE html\n${brief(CONFIDENT)}\n>`,
  'an HTML processing instruction': `<?example\n${brief(CONFIDENT)}\n?>`,
  'an HTML CDATA block': `<![CDATA[\n${brief(CONFIDENT)}\n]]>`,
  'a multiline script block': `<script\n${brief(CONFIDENT)}\n</script>`,
  'a multiline generic HTML block': `<div\n${brief(CONFIDENT, '\n')}\n</div>`,
  'a lowercase HTML declaration': `<!doctype\n${brief(CONFIDENT)}\n>`,
  'an unrelated bold label': '**Tests:** 89 passed.',
  'ordinary prose': 'An earlier paragraph says CONFIDENT and **Next:** informally.',
};

interface ContractState {
  projectDirectory?: string;
  boundary?: string;
  context?: string;
  sessionContexts?: string[];
  contractOutputs?: string[];
  reply?: string;
  evaluations?: ReturnType<typeof evaluateDecisionBriefCompliance>[];
  replies?: string[];
  formerReply?: string;
  formerStopOutput?: string;
  currentStopOutput?: string;
  validatorExit?: number;
  originalSource?: string;
  originalDogfood?: string;
}

const states = new WeakMap<SafewordWorld, ContractState>();
const stateFor = (world: SafewordWorld): ContractState => {
  let state = states.get(world);
  if (!state) {
    state = {};
    states.set(world, state);
  }
  return state;
};

function buildPromptProject(step?: string): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-prompt-format-'));
  const ticketDirectory = nodePath.join(directory, '.project/tickets/099-format');
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(nodePath.join(directory, '.safeword/SAFEWORD.md'), '# Standing instructions');
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    [
      '---',
      'id: 099',
      'status: in_progress',
      'type: feature',
      `phase: ${step ? 'implement' : 'intake'}`,
      '---',
    ].join('\n'),
  );
  const checked = step === 'red' ? 1 : step === 'green' ? 2 : step === 'refactor' ? 3 : 0;
  writeFileSync(
    nodePath.join(ticketDirectory, 'test-definitions.md'),
    ['### Scenario: prompt contract', '- [ ] RED', '- [ ] GREEN', '- [ ] REFACTOR']
      .map((line, index) => (index > 0 && index <= checked ? line.replace('[ ]', '[x]') : line))
      .join('\n'),
  );
  writeFileSync(
    nodePath.join(directory, '.project/quality-state-prompt-format.json'),
    JSON.stringify({ activeTicket: '099', recentFailures: [], incrementedPatterns: [] }),
  );
  return directory;
}

function buildGateProject(gate: string): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), `safeword-${gate.replaceAll(' ', '-')}-`));
  const ticketDirectory = nodePath.join(directory, '.project/tickets/099-gate');
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(nodePath.join(directory, '.safeword/.gitkeep'), '');
  writeFileSync(
    nodePath.join(directory, 'transcript.jsonl'),
    JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Edit' }] },
    }),
  );

  const type = gate === 'phase artifact' || gate === 'architecture review' ? 'feature' : 'task';
  const phase =
    gate === 'phase artifact'
      ? 'scenario-gate'
      : gate === 'architecture review'
        ? 'verify'
        : 'done';
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    ['---', 'id: 099', 'status: in_progress', `type: ${type}`, `phase: ${phase}`, '---'].join('\n'),
  );

  if (gate === 'architecture review') {
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Specification\n');
    writeFileSync(
      nodePath.join(ticketDirectory, 'test-definitions.md'),
      [
        '### Scenario: gate',
        '- [x] RED skip: fixture',
        '- [x] GREEN abc1234',
        '- [x] REFACTOR skip: fixture',
      ].join('\n'),
    );
    writeFileSync(
      nodePath.join(ticketDirectory, 'impl-plan.md'),
      [
        '# Plan',
        '',
        '**Status:** implemented',
        '',
        '## Approach',
        '',
        'Exercise the gate.',
        '',
        '## Decisions',
        '',
        'Use one local fixture.',
        '',
        '## Design alignment',
        '',
        'skip: no applicable principles',
        '',
        '## Known deviations',
        '',
        'skip: no deviations',
        '',
        '## Doc impact',
        '',
        'skip: internal fixture',
        '',
        '## Assessment triggers',
        '',
        'Revisit if the gate changes.',
      ].join('\n'),
    );
    writeFileSync(
      nodePath.join(directory, '.safeword/config.json'),
      JSON.stringify({ architectureReviewGate: true }),
    );
  }

  if (gate === 'dependency' || gate === 'test') {
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({ scripts: gate === 'test' ? { test: 'node -e "process.exit(1)"' } : {} }),
    );
    writeFileSync(nodePath.join(directory, 'bun.lock'), '');
    if (gate === 'test') mkdirSync(nodePath.join(directory, 'node_modules'));
  }
  return directory;
}

function buildTypecheckProject(): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-typecheck-format-'));
  const ticketDirectory = nodePath.join(directory, '.project/tickets/099-typecheck');
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(nodePath.join(directory, '.safeword/.gitkeep'), '');
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    ['---', 'id: 099', 'status: in_progress', 'type: task', 'phase: implement', '---'].join('\n'),
  );
  writeFileSync(nodePath.join(directory, 'tsconfig.json'), JSON.stringify({ include: ['*.ts'] }));
  writeFileSync(nodePath.join(directory, 'baseline.ts'), 'export const baseline = 1;\n');
  writeFileSync(
    nodePath.join(directory, 'transcript.jsonl'),
    JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Edit' }] },
    }),
  );
  symlinkSync(
    nodePath.join(REPO_ROOT, 'packages/cli/node_modules'),
    nodePath.join(directory, 'node_modules'),
  );
  for (const args of [
    ['init', '-q'],
    ['config', 'user.email', 'test@example.com'],
    ['config', 'user.name', 'Safeword Test'],
    ['add', '.'],
    ['commit', '-qm', 'fixture'],
  ]) {
    const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  writeFileSync(nodePath.join(directory, 'broken.ts'), 'export const broken: string = 1;\n');
  return directory;
}

After(function (this: SafewordWorld) {
  const state = states.get(this);
  const directory = state?.projectDirectory;
  if (directory) rmSync(directory, { recursive: true, force: true });
  if (state?.originalSource !== undefined) {
    writeFileSync(QUALITY_TEMPLATE, state.originalSource);
    spawnSync('bun', ['run', '--cwd', 'packages/cli', 'generate:claude-plugin'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  }
  if (state?.originalDogfood !== undefined) writeFileSync(QUALITY_DOGFOOD, state.originalDogfood);
  states.delete(this);
});

Given(
  /^a configured Safeword-managed Claude session reaches the (startup|resume|clear|compaction|fork) boundary$/u,
  function (this: SafewordWorld, boundary: string) {
    stateFor(this).boundary = boundary;
  },
);

Given('a Safeword-managed Claude session is starting', function (this: SafewordWorld) {
  stateFor(this).boundary = 'startup';
});

function extractAdditionalContext(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    return parsed.hookSpecificOutput?.additionalContext ?? trimmed;
  } catch {
    return trimmed;
  }
}

interface SessionGroupResult {
  combined: string;
  emitted: string[];
}

function runLegacySessionGroup(boundary: string): SessionGroupResult {
  const settings = JSON.parse(
    readFileSync(nodePath.join(REPO_ROOT, '.claude/settings.json'), 'utf8'),
  ) as {
    hooks: {
      SessionStart: Array<{
        matcher?: string;
        hooks: Array<{ command: string }>;
      }>;
    };
  };
  const source = boundary === 'compaction' ? 'compact' : boundary;
  const input = JSON.stringify({ hook_event_name: 'SessionStart', source, cwd: REPO_ROOT });
  const contexts: string[] = [];
  for (const entry of settings.hooks.SessionStart) {
    if (entry.matcher && entry.matcher !== source) continue;
    for (const hook of entry.hooks) {
      const result = spawnSync('bash', ['-lc', hook.command], {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: REPO_ROOT,
          SAFEWORD_NO_AUTO_UPGRADE: '1',
        },
        input,
        encoding: 'utf8',
        timeout: 60_000,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const context = extractAdditionalContext(result.stdout);
      if (context) contexts.push(context);
    }
  }
  return { combined: contexts.join('\n\n'), emitted: contexts };
}

function runPluginSessionGroup(boundary: string): SessionGroupResult & { directory: string } {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-plugin-session-'));
  const dataDirectory = nodePath.join(directory, 'plugin-data');
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword/SAFEWORD.md'),
    readFileSync(nodePath.join(REPO_ROOT, '.safeword/SAFEWORD.md')),
  );
  const source = boundary === 'compaction' ? 'compact' : boundary;
  const manifest = JSON.parse(
    readFileSync(nodePath.join(REPO_ROOT, 'plugin/hooks/hooks.json'), 'utf8'),
  ) as {
    hooks: {
      SessionStart: Array<{
        matcher?: string;
        hooks: Array<{ command: string }>;
      }>;
    };
  };
  const input = JSON.stringify({ hook_event_name: 'SessionStart', source, cwd: directory });
  const contexts: string[] = [];
  for (const entry of manifest.hooks.SessionStart) {
    if (entry.matcher && entry.matcher !== source) continue;
    for (const hook of entry.hooks) {
      const result = spawnSync('bash', ['-lc', hook.command], {
        cwd: directory,
        env: {
          ...process.env,
          CLAUDE_PLUGIN_DATA: dataDirectory,
          CLAUDE_PLUGIN_ROOT: nodePath.join(REPO_ROOT, 'plugin'),
          CLAUDE_PROJECT_DIR: directory,
          SAFEWORD_NO_AUTO_UPGRADE: '1',
        },
        input,
        encoding: 'utf8',
        timeout: 60_000,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const context = extractAdditionalContext(result.stdout);
      if (context) contexts.push(context);
    }
  }
  return { combined: contexts.join('\n\n'), emitted: contexts, directory };
}

function runSessionContext(world: SafewordWorld): void {
  const state = stateFor(world);
  const boundary = state.boundary ?? 'startup';
  const plugin = runPluginSessionGroup(boundary);
  const legacy = runLegacySessionGroup(boundary);
  state.projectDirectory = plugin.directory;
  state.sessionContexts = [legacy.combined, plugin.combined];
  state.contractOutputs = [...legacy.emitted, ...plugin.emitted].filter(context =>
    context.includes(DECISION_BRIEF_CONTRACT),
  );
  state.context = state.sessionContexts.join('\n\n');
}

When('the configured SessionStart hook group runs', function (this: SafewordWorld) {
  runSessionContext(this);
});

When('the session context hook runs', function (this: SafewordWorld) {
  runSessionContext(this);
});

Then(
  'the context contains the exact phase-neutral decision-brief contract',
  function (this: SafewordWorld) {
    assert.ok(stateFor(this).context?.includes(DECISION_BRIEF_CONTRACT));
    assert.ok(
      stateFor(this).sessionContexts?.every(context => context.includes(DECISION_BRIEF_CONTRACT)),
    );
  },
);

Then('the contract appears exactly once', function (this: SafewordWorld) {
  assert.ok(
    stateFor(this).sessionContexts?.every(
      context => context.split(DECISION_BRIEF_CONTRACT).length === 2,
    ),
  );
  assert.ok(
    stateFor(this).contractOutputs?.every(
      output => output.length < 10_000 && output.split(DECISION_BRIEF_CONTRACT).length === 2,
    ),
  );
});

Then('the exact compact authority bootstrap appears once', function (this: SafewordWorld) {
  const contexts = stateFor(this).sessionContexts ?? [];
  assert.equal(contexts.length, 2);
  for (const context of contexts) {
    assert.ok(
      [PROJECT_HANDBOOK_BOOTSTRAP, PACKAGED_HANDBOOK_BOOTSTRAP].some(bootstrap =>
        context.includes(bootstrap),
      ),
      `missing exact authority bootstrap in:\n${context}`,
    );
    assert.equal(context.split('Safeword session bootstrap:').length, 2, context);
  }
});

Then(
  'the context contains no implement-phase evidence requirement',
  function (this: SafewordWorld) {
    assert.doesNotMatch(stateFor(this).context ?? '', /Phase: implement\. CONFIDENT cites/u);
  },
);

Given(
  /^a feature is in the active (RED|GREEN|REFACTOR) step$/u,
  function (this: SafewordWorld, step: string) {
    stateFor(this).projectDirectory = buildPromptProject(step.toLowerCase());
  },
);

Given('no active TDD step requires quiet mode', function (this: SafewordWorld) {
  stateFor(this).projectDirectory = buildPromptProject();
});

function runPrompt(world: SafewordWorld): void {
  const state = stateFor(world);
  assert.ok(state.projectDirectory);
  const result = spawnSync('bun', [PROMPT_QUESTIONS], {
    cwd: state.projectDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: state.projectDirectory },
    input: JSON.stringify({ session_id: 'prompt-format', prompt: 'Continue the work.' }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  state.context = result.stdout;
}

When('the user submits the next prompt', function (this: SafewordWorld) {
  runPrompt(this);
});

When('the user submits a substantive work prompt', function (this: SafewordWorld) {
  runPrompt(this);
});

Then('the prompt context contains the lead-first cue', function (this: SafewordWorld) {
  assert.match(stateFor(this).context ?? '', /Reply format: lead with the answer\./u);
});

Then('it contains no full decision-brief demand', function (this: SafewordWorld) {
  assert.doesNotMatch(stateFor(this).context ?? '', /For substantive work updates/u);
});

Then(
  'the prompt context contains the compact CONFIDENT or BLOCKED reminder',
  function (this: SafewordWorld) {
    assert.match(stateFor(this).context ?? '', /\*\*CONFIDENT\*\*[\s\S]*\*\*BLOCKED\*\*/u);
  },
);

Then(
  'it names Next for CONFIDENT and Need for BLOCKED without requiring both',
  function (this: SafewordWorld) {
    const context = stateFor(this).context ?? '';
    assert.match(context, /CONFIDENT[^\n]+Next/u);
    assert.match(context, /BLOCKED[^\n]+Need/u);
    assert.doesNotMatch(context, /BLOCKED[^\n]+Next/u);
  },
);

Given("Claude's final reply is structurally compliant", function (this: SafewordWorld) {
  setReplyFormatState(this, {
    projectDirectory: buildReplyFormatProject(),
    reply: brief(CONFIDENT),
    stopHookActive: false,
  });
});

Given(/^every hard gate other than (.+) allows Stop$/u, function (_gate: string) {
  // The focused fixture below activates only the named gate.
});

Given(
  /^the (dependency|test|phase artifact|architecture review|done) gate has a failing verdict$/u,
  function (this: SafewordWorld, gate: string) {
    getReplyFormatState(this).projectDirectory = buildGateProject(gate);
  },
);

Given(
  /^the reply is on the (first|correction) Stop iteration$/u,
  function (this: SafewordWorld, iteration: string) {
    getReplyFormatState(this).stopHookActive = iteration === 'correction';
  },
);

Then(
  /^the failing (dependency|test|phase artifact|architecture review|done) verdict is emitted instead of allowing Stop$/u,
  function (this: SafewordWorld, gate: string) {
    const output = JSON.parse(this.result.stdout) as { decision?: string; reason?: string };
    assert.equal(output.decision, 'block');
    const patterns: Record<string, RegExp> = {
      dependency: /tools aren't installed|bun ci/iu,
      test: /Tests failed/iu,
      'phase artifact': /requires test-definitions\.md/iu,
      'architecture review': /Architecture review gate/iu,
      done: /verify\.md/iu,
    };
    assert.match(output.reason ?? '', patterns[gate]);
  },
);

Given('every hard gate allows Stop', function (this: SafewordWorld) {
  ensureReplyFormatState(this);
});

Given('every hard and advisory gate allows Stop', function () {
  // The compliant first-Stop fixture has no competing gate state.
});

Given('typecheck has actionable advice', function (this: SafewordWorld) {
  const state = ensureReplyFormatState(this);
  rmSync(state.projectDirectory, { recursive: true, force: true });
  state.projectDirectory = buildTypecheckProject();
});

Given('the correction reply is still structurally incomplete', function (this: SafewordWorld) {
  ensureReplyFormatState(this).reply = '**CONFIDENT** — Done.';
});

Then(
  'typecheck advice is emitted before terminal-format validation allows Stop',
  function (this: SafewordWorld) {
    const output = JSON.parse(this.result.stdout) as { decision?: string; reason?: string };
    assert.equal(output.decision, 'block');
    assert.match(output.reason ?? '', /TypeScript errors[\s\S]*broken\.ts/iu);
    assert.doesNotMatch(output.reason ?? '', /Reproduce the shape below exactly/iu);
  },
);

Then(
  'Stop is allowed without typecheck advice or another format correction',
  function (this: SafewordWorld) {
    assert.equal(this.result.exitCode, 0, this.result.stderr);
    assert.equal(this.result.stdout.trim(), '');
  },
);

Given(
  'the canonical contract changes from distinct shape A to distinct shape B before installation',
  function (this: SafewordWorld) {
    const state = stateFor(this);
    const projectDirectory = buildReplyFormatProject();
    const setup = spawnSync(
      'bun',
      [
        SAFEWORD_CLI,
        'setup',
        '--yes',
        '--agents',
        'cursor',
        '--no-modify',
        '--cwd',
        projectDirectory,
      ],
      { cwd: REPO_ROOT, encoding: 'utf8', timeout: 60_000 },
    );
    assert.equal(setup.status, 0, setup.stderr || setup.stdout);
    const installedGrammar = nodePath.join(projectDirectory, '.safeword/hooks/lib/quality.ts');
    const formerSource = readFileSync(installedGrammar, 'utf8');
    const changedSource = formerSource.replace("label: 'Open',", "label: 'Risks',");
    assert.notEqual(changedSource, formerSource, 'grammar fixture did not change');
    writeFileSync(installedGrammar, changedSource);

    state.projectDirectory = projectDirectory;
    state.formerReply = brief(CONFIDENT);
    state.reply = brief([CONFIDENT[0], CONFIDENT[1], '**Risks:** none.', CONFIDENT[3]]);
    setReplyFormatState(this, {
      projectDirectory,
      reply: state.formerReply,
      stopHookActive: false,
    });
  },
);

Given('Safeword is installed from its managed templates', function (this: SafewordWorld) {
  const projectDirectory = stateFor(this).projectDirectory;
  assert.ok(projectDirectory);
  const installed = readFileSync(
    nodePath.join(projectDirectory, '.safeword/hooks/lib/quality.ts'),
    'utf8',
  );
  assert.match(installed, /label: 'Risks'/u);
  assert.ok(existsSync(nodePath.join(projectDirectory, '.safeword/hooks/session-reply-format.ts')));
});

When(
  'the configured SessionStart and Stop commands are executed as subprocesses',
  function (this: SafewordWorld) {
    const contractState = stateFor(this);
    assert.ok(contractState.projectDirectory);
    const session = spawnSync(
      'bun',
      [
        nodePath.join(contractState.projectDirectory, '.safeword/hooks/session-reply-format.ts'),
        '--agent=claude',
      ],
      {
        cwd: contractState.projectDirectory,
        input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup' }),
        encoding: 'utf8',
      },
    );
    assert.equal(session.status, 0, session.stderr || session.stdout);
    contractState.context = extractAdditionalContext(session.stdout);

    const replyState = getReplyFormatState(this);
    const runInstalledStop = () => {
      const result = spawnSync(
        'bun',
        [nodePath.join(replyState.projectDirectory, '.safeword/hooks/stop-quality.ts')],
        {
          cwd: replyState.projectDirectory,
          env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: replyState.projectDirectory,
            SAFEWORD_CLI,
          },
          input: JSON.stringify({
            session_id: 'reply-format',
            transcript_path: nodePath.join(replyState.projectDirectory, 'transcript.jsonl'),
            last_assistant_message: replyState.reply,
            stop_hook_active: false,
          }),
          encoding: 'utf8',
          timeout: 60_000,
        },
      );
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return result.stdout;
    };
    contractState.formerStopOutput = runInstalledStop();
    rmSync(nodePath.join(replyState.projectDirectory, '.project/quality-state-reply-format.json'), {
      force: true,
    });
    replyState.reply = contractState.reply ?? '';
    contractState.currentStopOutput = runInstalledStop();
  },
);

Then('SessionStart emits shape B', function (this: SafewordWorld) {
  const context = stateFor(this).context ?? '';
  assert.match(context, /\*\*Risks:\*\*/u);
  assert.doesNotMatch(context, /\*\*Open:\*\*/u);
});

Then('Stop accepts shape B and rejects the former shape A', function (this: SafewordWorld) {
  const state = stateFor(this);
  assert.equal(state.currentStopOutput?.trim(), '');
  const former = JSON.parse(state.formerStopOutput ?? '{}') as { decision?: string };
  assert.equal(former.decision, 'block');
});

Given('an installed hook differs from its canonical template', function (this: SafewordWorld) {
  const state = stateFor(this);
  state.projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-setup-drift-'));
  writeFileSync(
    nodePath.join(state.projectDirectory, 'package.json'),
    JSON.stringify({ private: true }),
  );
  const setup = spawnSync(
    'bun',
    [
      SAFEWORD_CLI,
      'setup',
      '--yes',
      '--agents',
      'cursor',
      '--no-modify',
      '--cwd',
      state.projectDirectory,
    ],
    { cwd: REPO_ROOT, encoding: 'utf8', timeout: 60_000 },
  );
  assert.equal(setup.status, 0, setup.stderr || setup.stdout);
  const installed = nodePath.join(state.projectDirectory, '.safeword/hooks/lib/quality.ts');
  writeFileSync(installed, `${readFileSync(installed, 'utf8')}\n// drift fixture\n`);
});

When('the setup reconciliation runs', function (this: SafewordWorld) {
  const state = stateFor(this);
  assert.ok(state.projectDirectory);
  const result = spawnSync(
    'bun',
    [
      SAFEWORD_CLI,
      'setup',
      '--yes',
      '--agents',
      'cursor',
      '--no-modify',
      '--cwd',
      state.projectDirectory,
    ],
    { cwd: REPO_ROOT, encoding: 'utf8', timeout: 60_000 },
  );
  state.validatorExit = result.status ?? 1;
});

Then('the installed hook is restored from the canonical template', function (this: SafewordWorld) {
  const state = stateFor(this);
  assert.equal(state.validatorExit, 0);
  assert.equal(
    readFileSync(
      nodePath.join(state.projectDirectory ?? '', '.safeword/hooks/lib/quality.ts'),
      'utf8',
    ),
    readFileSync(QUALITY_TEMPLATE, 'utf8'),
  );
});

Given(
  'the canonical source changed while the committed plugin remains stale',
  function (this: SafewordWorld) {
    const state = stateFor(this);
    state.originalSource = readFileSync(QUALITY_TEMPLATE, 'utf8');
    writeFileSync(QUALITY_TEMPLATE, `${state.originalSource}\n// plugin drift fixture\n`);
  },
);

When('the Claude plugin generation and worktree diff gate runs', function (this: SafewordWorld) {
  const state = stateFor(this);
  const generated = spawnSync('bun', ['run', '--cwd', 'packages/cli', 'generate:claude-plugin'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  });
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  state.validatorExit =
    spawnSync('git', ['diff', '--quiet', '--', 'plugin'], {
      cwd: REPO_ROOT,
    }).status ?? 0;
  writeFileSync(QUALITY_TEMPLATE, state.originalSource ?? '');
  state.originalSource = undefined;
  const restored = spawnSync('bun', ['run', '--cwd', 'packages/cli', 'generate:claude-plugin'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  });
  assert.equal(restored.status, 0, restored.stderr || restored.stdout);
});

Then('the committed plugin is rejected as drifted from its source', function (this: SafewordWorld) {
  assert.equal(stateFor(this).validatorExit, 1);
});

Given('a dogfood copy differs from its canonical template', function (this: SafewordWorld) {
  const state = stateFor(this);
  state.originalDogfood = readFileSync(QUALITY_DOGFOOD, 'utf8');
  writeFileSync(QUALITY_DOGFOOD, `${state.originalDogfood}\n// parity drift fixture\n`);
});

When('the template parity check runs', function (this: SafewordWorld) {
  const state = stateFor(this);
  state.validatorExit =
    spawnSync('bun', ['scripts/parity-check.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 60_000,
    }).status ?? 0;
  writeFileSync(QUALITY_DOGFOOD, state.originalDogfood ?? '');
  state.originalDogfood = undefined;
});

Then('the dogfood copy fails with a pair-drift finding', function (this: SafewordWorld) {
  assert.equal(stateFor(this).validatorExit, 1);
});

Given(/^the final reply uses the (.+) shape$/u, function (this: SafewordWorld, shape: string) {
  const shapes: Record<string, string> = {
    'CONFIDENT ordered Decided, Rejected, Open, then Next': brief([
      CONFIDENT[0],
      CONFIDENT[1],
      '**Rejected:** A broader rewrite.',
      ...CONFIDENT.slice(2),
    ]),
    'CONFIDENT without the optional Rejected paragraph': brief(CONFIDENT),
    'CONFIDENT with CRLF line endings': brief(CONFIDENT, '\r\n\r\n'),
    'BLOCKED ordered Tried then terminal Need': brief(BLOCKED),
    'BLOCKED with CRLF line endings': brief(BLOCKED, '\r\n\r\n'),
  };
  assert.ok(shapes[shape], `unknown accepted shape: ${shape}`);
  stateFor(this).reply = shapes[shape];
});

Given(/^the final reply has (.+)$/u, function (this: SafewordWorld, defect: string) {
  const defects: Record<string, string> = {
    'no terminal verdict': 'Implemented and tested.',
    'both CONFIDENT and BLOCKED verdicts': `${brief(CONFIDENT)}\n\n${brief(BLOCKED)}`,
    'two unquoted verdicts of the same kind': `${brief(CONFIDENT)}\n\n${brief(CONFIDENT)}`,
    'a complete template only inside a blockquote': ignoredBriefs['a blockquote'],
    'a complete template only inside a list item': ignoredBriefs['a list item'],
    'a complete template only inside a fenced block': ignoredBriefs['fenced code'],
    'a complete template only inside indented code': ignoredBriefs['indented code'],
    'a complete template only inside an HTML comment': ignoredBriefs['an HTML comment'],
    'a complete template only inside an HTML block': ignoredBriefs['an HTML block'],
    'a complete template only inside a nested bullet continuation':
      ignoredBriefs['a nested bullet continuation'],
    'a complete template only inside an ordered-list continuation':
      ignoredBriefs['an ordered-list continuation'],
    'a complete template only inside an HTML declaration': ignoredBriefs['an HTML declaration'],
    'a complete template only inside an HTML processing instruction':
      ignoredBriefs['an HTML processing instruction'],
    'a complete template only inside an HTML CDATA block': ignoredBriefs['an HTML CDATA block'],
    'a complete template only inside a multiline script block':
      ignoredBriefs['a multiline script block'],
    'a complete template only inside a multiline generic HTML block':
      ignoredBriefs['a multiline generic HTML block'],
    'a complete template only inside a lowercase HTML declaration':
      ignoredBriefs['a lowercase HTML declaration'],
    'a verdict label mentioned only in prose': `The result is **CONFIDENT** in prose.\n\n${brief(CONFIDENT.slice(1))}`,
    'required labels outside the terminal block': `**Open:** none.\n\n${brief(CONFIDENT)}`,
    'required paragraphs in the wrong order': brief([
      CONFIDENT[0],
      CONFIDENT[2],
      CONFIDENT[1],
      CONFIDENT[3],
    ]),
    'a duplicated Decided paragraph': brief([
      CONFIDENT[0],
      CONFIDENT[1],
      CONFIDENT[1],
      ...CONFIDENT.slice(2),
    ]),
    'a duplicated Rejected paragraph': brief([
      CONFIDENT[0],
      CONFIDENT[1],
      '**Rejected:** A.',
      '**Rejected:** B.',
      ...CONFIDENT.slice(2),
    ]),
    'a duplicated Open paragraph': brief([
      CONFIDENT[0],
      CONFIDENT[1],
      CONFIDENT[2],
      CONFIDENT[2],
      CONFIDENT[3],
    ]),
    'a duplicated Next paragraph': brief([...CONFIDENT, CONFIDENT[3]]),
    'a duplicated Tried paragraph': brief([BLOCKED[0], BLOCKED[1], BLOCKED[1], BLOCKED[2]]),
    'a duplicated Need paragraph': brief([...BLOCKED, BLOCKED[2]]),
    'Rejected after Open or Next': brief([
      CONFIDENT[0],
      CONFIDENT[1],
      CONFIDENT[2],
      '**Rejected:** Too late.',
      CONFIDENT[3],
    ]),
    'BLOCKED without a Tried paragraph': brief([BLOCKED[0], BLOCKED[2]]),
    'BLOCKED without a Need paragraph': brief(BLOCKED.slice(0, 2)),
    'BLOCKED with Need before Tried': brief([BLOCKED[0], BLOCKED[2], BLOCKED[1]]),
    'BLOCKED with a separate Next after Need': brief([...BLOCKED, CONFIDENT[3]]),
    'trailing prose after the terminal action': `${brief(CONFIDENT)}\n\nOne more thing.`,
    'an empty required paragraph body': brief([
      CONFIDENT[0],
      CONFIDENT[1],
      '**Open:**   ',
      CONFIDENT[3],
    ]),
  };
  assert.ok(defects[defect], `unknown defect: ${defect}`);
  stateFor(this).reply = defects[defect];
});

Given(
  /^verdict-like content appears inside (.+)$/u,
  function (this: SafewordWorld, context: string) {
    assert.ok(ignoredBriefs[context], `unknown ignored context: ${context}`);
    stateFor(this).reply = ignoredBriefs[context];
  },
);

Given(
  'a valid top-level decision brief follows as the contiguous terminal block',
  function (this: SafewordWorld) {
    const state = stateFor(this);
    state.reply = `${state.reply}\n\n${brief(CONFIDENT)}`;
  },
);

When('terminal-format compliance is evaluated repeatedly', function (this: SafewordWorld) {
  const state = stateFor(this);
  assert.ok(state.reply);
  state.evaluations = Array.from({ length: 3 }, () =>
    evaluateDecisionBriefCompliance(state.reply ?? ''),
  );
});

Then('every evaluation accepts the reply', function (this: SafewordWorld) {
  assert.ok(stateFor(this).evaluations?.every(result => result.compliant));
});

Then('every evaluation rejects the reply', function (this: SafewordWorld) {
  assert.ok(stateFor(this).evaluations?.every(result => !result.compliant));
});

Given(
  'equivalent adversarial replies of one, two, and four megabytes',
  function (this: SafewordWorld) {
    stateFor(this).replies = [1, 2, 4].map(
      megabytes => `${'x'.repeat(megabytes * 1024 * 1024)}\n\n${ignoredBriefs['fenced code']}`,
    );
  },
);

Given('parser instrumentation counts examined input characters', function (this: SafewordWorld) {
  assert.equal(typeof evaluateDecisionBriefCompliance('x').examinedCharacters, 'number');
});

When('each reply is evaluated in-process', function (this: SafewordWorld) {
  const state = stateFor(this);
  assert.ok(state.replies);
  state.evaluations = state.replies.map(evaluateDecisionBriefCompliance);
});

Then('every reply is rejected', function (this: SafewordWorld) {
  assert.ok(stateFor(this).evaluations?.every(result => !result.compliant));
});

Then(
  'examined-character counts grow no faster than the fixed linear bound',
  function (this: SafewordWorld) {
    const state = stateFor(this);
    assert.ok(state.replies && state.evaluations);
    state.evaluations.forEach((result, index) => {
      assert.ok(
        result.examinedCharacters <=
          (state.replies?.[index].length ?? 0) * DECISION_BRIEF_MAX_WORK_FACTOR,
      );
    });
  },
);
