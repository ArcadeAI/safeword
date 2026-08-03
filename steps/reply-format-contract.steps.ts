import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  DECISION_BRIEF_CONTRACT,
  evaluateDecisionBriefCompliance,
} from '../packages/cli/templates/hooks/lib/quality.js';
import type { SafewordWorld } from './world.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const SESSION_CONTEXT = nodePath.join(REPO_ROOT, '.safeword/hooks/session-safeword-context.ts');
const PROMPT_QUESTIONS = nodePath.join(REPO_ROOT, '.safeword/hooks/prompt-questions.ts');
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
const ignoredBriefs: Record<string, string> = {
  'a blockquote': brief(CONFIDENT.map(paragraph => `> ${paragraph}`)),
  'a list item': brief(CONFIDENT.map(paragraph => `- ${paragraph}`)),
  'fenced code': ['```md', ...CONFIDENT, '```'].join('\n\n'),
  'indented code': brief(CONFIDENT.map(paragraph => `    ${paragraph}`)),
  'an HTML comment': `<!--\n${brief(CONFIDENT)}\n-->`,
  'an HTML block': `<div>\n${brief(CONFIDENT)}\n</div>`,
  'ordinary prose': 'An earlier paragraph says CONFIDENT and **Next:** informally.',
};

interface ContractState {
  projectDirectory?: string;
  boundary?: string;
  context?: string;
  reply?: string;
  evaluations?: ReturnType<typeof evaluateDecisionBriefCompliance>[];
  replies?: string[];
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

After(function (this: SafewordWorld) {
  const directory = states.get(this)?.projectDirectory;
  if (directory) rmSync(directory, { recursive: true, force: true });
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

function runSessionContext(world: SafewordWorld): void {
  const state = stateFor(world);
  const result = spawnSync('bun', [SESSION_CONTEXT, '--agent=claude'], {
    cwd: REPO_ROOT,
    env: { ...process.env, CLAUDE_PROJECT_DIR: REPO_ROOT },
    input: JSON.stringify({
      hook_event_name: 'SessionStart',
      source: state.boundary,
      cwd: REPO_ROOT,
    }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  state.context = JSON.parse(result.stdout).hookSpecificOutput.additionalContext as string;
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
  },
);

Then('the contract appears exactly once', function (this: SafewordWorld) {
  assert.equal(stateFor(this).context?.split(DECISION_BRIEF_CONTRACT).length, 2);
});

Then('existing SAFEWORD standing instructions remain intact', function (this: SafewordWorld) {
  assert.match(stateFor(this).context ?? '', /SAFEWORD Agent Instructions/u);
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
      assert.ok(result.examinedCharacters <= (state.replies?.[index].length ?? 0) * 4);
    });
  },
);
