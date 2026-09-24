import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import * as quality from '../packages/cli/templates/hooks/lib/quality.js';
import { evaluateDecisionBriefCompliance } from '../packages/cli/templates/hooks/lib/quality.js';
import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.js';
import { CURSOR_HOOKS, SETTINGS_HOOKS } from '../packages/cli/src/templates/config.js';
import type { SafewordWorld } from './world.js';

interface HandoffState {
  reply?: string;
  substantiveEvidence?: 'current-turn-tool' | 'none';
  contract?: unknown;
  contractValidation?: { valid: boolean; requirements?: string[] };
  nativeHost?: string;
  nativeProject?: string;
  nativePayload?: unknown;
  nativeOutput?: string;
  nativeOutputs?: string[];
  nativeExpectedRequirements?: string[];
  corpus?: Array<{
    reply: string;
    expected: { compliant: boolean; form: string; requirements?: string[] };
  }>;
  corpusEvaluations?: Array<ReturnType<typeof evaluateDecisionBriefCompliance>>;
  parityRoot?: string;
  parityTarget?: string;
  parityGateChecked?: boolean;
  parityStatus?: number | null;
  parityStderr?: string;
  evaluation?: ReturnType<typeof evaluateDecisionBriefCompliance> & {
    contractVersion?: string;
    form?: string;
    requirements?: string[];
  };
}

const states = new WeakMap<SafewordWorld, HandoffState>();
const stateFor = (world: SafewordWorld): HandoffState => {
  let state = states.get(world);
  if (!state) {
    state = {};
    states.set(world, state);
  }
  return state;
};

const decisionValues = {
  Choice: 'release to beta or stable',
  Recommendation: 'choose beta',
  Reason: 'beta limits exposure while telemetry is verified',
  Impact: 'beta delays stable by one day; stable increases rollback risk',
  Reply: '`beta` or `stable`',
} as const;

const displayToRole = {
  'concrete choice': 'Choice',
  recommendation: 'Recommendation',
  'controlling reason': 'Reason',
  'material tradeoff or consequences': 'Impact',
  'exact reply': 'Reply',
} as const;

function decisionTerminal(
  overrides: Partial<Record<keyof typeof decisionValues, string>> = {},
): string {
  return Object.entries({ ...decisionValues, ...overrides })
    .map(([role, value]) => `${role}: ${value}.`)
    .join(' ');
}

function decisionReply(paragraph: 'Next' | 'Need', terminal: string): string {
  return paragraph === 'Need'
    ? [
        '**BLOCKED** — The release channel requires a human choice.',
        '**Tried:** Verified both channels are available.',
        `**Need:** ${terminal}`,
      ].join('\n\n')
    : [
        '**CONFIDENT** — The release channel requires a human choice.',
        '**Decided:** Keep the release scoped to one channel.',
        '**Open:** human: choose the release channel.',
        `**Next:** ${terminal}`,
      ].join('\n\n');
}

function actionReply(terminal: string, open = 'none'): string {
  return [
    '**CONFIDENT** — The implementation is complete.',
    '**Decided:** Keep the change focused.',
    `**Open:** ${open}.`,
    `**Next:** ${terminal}`,
  ].join('\n\n');
}

function incompleteCorpusReply(corpusCase: string): string {
  if (corpusCase === 'vague blocked Need') {
    return [
      '**BLOCKED** — The release channel requires a human choice.',
      '**Tried:** Verified both release channels are available.',
      '**Need:** Choose the intended target.',
    ].join('\n\n');
  }
  if (corpusCase === 'unexplained marked term') {
    return decisionReply('Next', `${decisionTerminal()} Term: RPO.`);
  }
  return [
    '**CONFIDENT** — The implementation is complete and needs a direction.',
    '**Decided:** Keep the current change intact.',
    '**Open:** human: choose the next target.',
    '**Next:** Choose the intended target.',
  ].join('\n\n');
}

function corpusReply(corpusCase: string): string {
  if (corpusCase === 'self-contained Next rewrite') {
    return decisionReply('Next', decisionTerminal());
  }
  if (corpusCase === 'self-contained Need rewrite') {
    return decisionReply('Need', decisionTerminal());
  }
  if (corpusCase === 'concise no-decision action') {
    return actionReply('Action: Run. Object: the focused terminal-handoff tests.');
  }
  if (corpusCase === 'vague no-decision action') return actionReply('Continue.');
  if (corpusCase === 'short conversational reply') return 'Happy to help.';
  return incompleteCorpusReply(corpusCase);
}

function corpusRequirements(corpusCase: string): string[] {
  if (corpusCase === 'unexplained marked term') return ['plain-language meaning'];
  if (corpusCase === 'vague no-decision action') return ['one concrete action'];
  return [
    'concrete choice',
    'recommendation',
    'controlling reason',
    'material tradeoff or consequences',
    'exact reply',
  ];
}

const requiredDecisionRoles = [
  'concrete choice',
  'recommendation',
  'controlling reason',
  'material tradeoff or consequences',
  'exact reply',
];

function decisionContractFixture() {
  const roles = requiredDecisionRoles.map(name => ({ name }));
  return {
    version: 'terminal-handoff/v1',
    decision: { Next: roles, Need: roles },
    action: { role: 'Action', optionalReasonPrefix: 'Required because' },
  };
}

function fixedCorpus(): NonNullable<HandoffState['corpus']> {
  return [
    {
      reply: incompleteCorpusReply('observed decision omission'),
      expected: { compliant: false, form: 'decision', requirements: requiredDecisionRoles },
    },
    {
      reply: corpusReply('self-contained Next rewrite'),
      expected: { compliant: true, form: 'decision' },
    },
    {
      reply: incompleteCorpusReply('vague blocked Need'),
      expected: { compliant: false, form: 'decision', requirements: requiredDecisionRoles },
    },
    {
      reply: corpusReply('self-contained Need rewrite'),
      expected: { compliant: true, form: 'decision' },
    },
    {
      reply: corpusReply('concise no-decision action'),
      expected: { compliant: true, form: 'action' },
    },
    {
      reply: corpusReply('vague no-decision action'),
      expected: {
        compliant: false,
        form: 'action',
        requirements: ['one concrete action', 'no extra context'],
      },
    },
    {
      reply: incompleteCorpusReply('unexplained marked term'),
      expected: { compliant: false, form: 'decision', requirements: ['plain-language meaning'] },
    },
  ];
}

const deliveredQualityCopies = [
  'packages/cli/templates/hooks/lib/quality.ts',
  'plugin/runtime/hooks/lib/quality.ts',
  'packages/cli/codex-plugin/templates/hooks/lib/quality.ts',
  '.safeword/hooks/lib/quality.ts',
] as const;

const parityCopyPath: Record<string, string> = {
  'canonical template': 'packages/cli/templates/hooks/lib/quality.ts',
  'generated Claude plugin': 'plugin/runtime/hooks/lib/quality.ts',
  'generated Codex plugin': 'packages/cli/codex-plugin/templates/hooks/lib/quality.ts',
  // Cursor and customer installs receive this same canonical installed artifact;
  // the repository release gate can inspect the shared source, not external projects.
  'Cursor delivery': '.safeword/hooks/lib/quality.ts',
  'customer installed': '.safeword/hooks/lib/quality.ts',
  'dogfood installed': '.safeword/hooks/lib/quality.ts',
};

const parityContractPath: Record<string, string> = {
  'canonical template': 'packages/cli/templates/hooks/lib/quality.ts',
  'generated Claude plugin': 'plugin/runtime/hooks/lib/quality.ts',
  'generated Codex plugin': 'packages/cli/codex-plugin/templates/hooks/lib/quality.ts',
  'Cursor delivery': '.safeword/hooks/lib/quality.ts',
  'customer installed': '.safeword/hooks/lib/quality.ts',
  'dogfood installed': '.safeword/hooks/lib/quality.ts',
};

function prepareParityFailure(
  world: SafewordWorld,
  label: string,
  kind: 'missing' | 'role' | 'version',
) {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-handoff-parity-'));
  const target = parityCopyPath[label];
  const contractPath = parityContractPath[label];
  assert.ok(target, `unknown parity copy ${label}`);
  assert.ok(contractPath, `unknown parity contract ${label}`);
  const contract = SAFEWORD_SCHEMA.contracts[contractPath];
  assert.ok(contract, `production schema omitted ${contractPath}`);
  mkdirSync(nodePath.join(root, 'scripts'), { recursive: true });
  cpSync(
    nodePath.join(process.cwd(), 'scripts/parity-check.ts'),
    nodePath.join(root, 'scripts/parity-check.ts'),
  );
  cpSync(
    nodePath.join(process.cwd(), 'packages/cli/templates'),
    nodePath.join(root, 'packages/cli/templates'),
    { recursive: true },
  );
  symlinkSync(
    nodePath.join(process.cwd(), 'packages/cli/src'),
    nodePath.join(root, 'packages/cli/src'),
    'dir',
  );
  for (const [destination, definition] of Object.entries({
    ...SAFEWORD_SCHEMA.ownedFiles,
    ...Object.fromEntries(
      Object.entries(SAFEWORD_SCHEMA.managedFiles).filter(([, entry]) => entry.dogfoodParity),
    ),
  })) {
    if (!definition.template) continue;
    if (destination.startsWith('packages/cli/src/')) continue;
    const source = nodePath.join(process.cwd(), destination);
    const canonicalSource = nodePath.join(
      process.cwd(),
      'packages/cli/templates',
      definition.template,
    );
    const fixtureSource = existsSync(source) ? source : canonicalSource;
    assert.ok(existsSync(fixtureSource), `parity fixture source missing: ${destination}`);
    cpSync(fixtureSource, nodePath.join(root, destination), { recursive: true });
  }
  for (const path of Object.keys(SAFEWORD_SCHEMA.contracts)) {
    if (path.startsWith('packages/cli/src/')) continue;
    const source = nodePath.join(process.cwd(), path);
    if (!existsSync(source)) continue;
    cpSync(source, nodePath.join(root, path), { recursive: true });
  }
  const baseline = spawnSync('bun', ['scripts/parity-check.ts', '--mode=all'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(
    baseline.status,
    0,
    `parity fixture was not clean before mutation: ${baseline.stderr}`,
  );
  const targetPath = nodePath.join(root, target);
  if (kind === 'missing') {
    rmSync(targetPath, { force: true });
  } else {
    const original = readFileSync(targetPath, 'utf8');
    const requirement = contract.requires.find(candidate =>
      candidate.includes(
        kind === 'version' ? 'terminal-handoff/v1' : 'material tradeoff or consequences',
      ),
    );
    assert.ok(requirement, `production contract has no ${kind} requirement`);
    const content =
      kind === 'version'
        ? original
            .split(requirement)
            .join(requirement.replace('terminal-handoff/v1', 'terminal-handoff/v0'))
        : original.split(requirement).join('');
    assert.notEqual(content, original, `${kind} mutation left ${target} unchanged`);
    writeFileSync(targetPath, content);
  }
  const state = stateFor(world);
  state.parityRoot = root;
  state.parityTarget = target;
}

After(function (this: SafewordWorld) {
  const state = stateFor(this);
  if (state.parityRoot) rmSync(state.parityRoot, { recursive: true, force: true });
});

function registeredStopCommand(host: string, project: string): string {
  if (host === 'Claude Code') {
    const settings = JSON.parse(
      readFileSync(nodePath.join(project, '.claude/settings.json'), 'utf8'),
    );
    const commands = settings.hooks.Stop.flatMap((entry: { hooks: Array<{ command: string }> }) =>
      entry.hooks.map(hook => hook.command),
    );
    const command = commands.find((candidate: string) => candidate.includes('/stop-quality.ts'));
    assert.ok(command, 'installed Claude Code Stop registration is missing stop-quality.ts');
    return command;
  }
  if (host === 'Cursor') {
    const settings = JSON.parse(readFileSync(nodePath.join(project, '.cursor/hooks.json'), 'utf8'));
    const command = settings.hooks.stop.find((entry: { command: string }) =>
      entry.command.includes('/cursor/stop.ts'),
    )?.command;
    assert.ok(command, 'installed Cursor Stop registration is missing cursor/stop.ts');
    return command;
  }
  const manifest = JSON.parse(
    readFileSync(nodePath.join(project, '.safeword/codex-plugin/hooks.json'), 'utf8'),
  );
  const commands = manifest.hooks.Stop.flatMap((entry: { hooks: Array<{ command: string }> }) =>
    entry.hooks.map(hook => hook.command),
  );
  const command = commands.find((candidate: string) => candidate.includes('hook codex stop'));
  assert.ok(command, 'installed Codex Stop registration is missing the packaged stop adapter');
  return command;
}

function prepareNativeStop(world: SafewordWorld, host: string, reply: string): void {
  const project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-handoff-'));
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(project, '.safeword/config.json'), '{}\n');
  cpSync(
    nodePath.join(process.cwd(), 'packages/cli/templates/SAFEWORD.md'),
    nodePath.join(project, '.safeword/SAFEWORD.md'),
  );
  if (host === 'OpenAI Codex') {
    cpSync(
      nodePath.join(process.cwd(), 'packages/cli/codex-plugin'),
      nodePath.join(project, '.safeword/codex-plugin'),
      { recursive: true },
    );
  }
  cpSync(
    nodePath.join(process.cwd(), 'packages/cli/templates/hooks'),
    nodePath.join(project, '.safeword/hooks'),
    {
      recursive: true,
    },
  );
  mkdirSync(nodePath.join(project, '.claude'), { recursive: true });
  writeFileSync(
    nodePath.join(project, '.claude/settings.json'),
    JSON.stringify({ hooks: SETTINGS_HOOKS }),
  );
  mkdirSync(nodePath.join(project, '.cursor'), { recursive: true });
  writeFileSync(
    nodePath.join(project, '.cursor/hooks.json'),
    JSON.stringify({ version: 1, hooks: CURSOR_HOOKS }),
  );
  const transcriptPath = nodePath.join(project, 'transcript.jsonl');
  writeFileSync(
    transcriptPath,
    `${JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: reply }] } })}\n`,
  );
  const state = stateFor(world);
  state.nativeHost = host;
  state.nativeProject = project;
  state.reply = reply;
  state.nativeOutputs = [];
  state.nativePayload =
    host === 'Cursor'
      ? {
          workspace_roots: [project],
          conversation_id: 'handoff-session',
          generation_id: 'generation-1',
          status: 'completed',
          transcript_path: transcriptPath,
          loop_count: 0,
        }
      : {
          cwd: project,
          session_id: 'handoff-session',
          transcript_path: transcriptPath,
          last_assistant_message: reply,
        };
}

function setNativeReply(state: HandoffState, reply: string): void {
  assert.ok(state.nativePayload && typeof state.nativePayload === 'object');
  const payload = state.nativePayload as Record<string, unknown>;
  const transcriptPath = String(payload.transcript_path);
  writeFileSync(
    transcriptPath,
    `${JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: reply }] } })}\n`,
  );
  state.reply = reply;
  if (state.nativeHost !== 'Cursor') payload.last_assistant_message = reply;
}

function invokeNativeStop(state: HandoffState, payload = state.nativePayload): string {
  assert.ok(state.nativeHost && state.nativeProject && payload !== undefined);
  const command = registeredStopCommand(state.nativeHost, state.nativeProject);
  const result = spawnSync('/bin/sh', ['-c', command], {
    cwd: state.nativeProject,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: state.nativeProject,
      PLUGIN_ROOT: nodePath.join(state.nativeProject, '.safeword/codex-plugin'),
    },
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 20_000,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function cleanNativeStop(state: HandoffState): void {
  if (state.nativeProject) rmSync(state.nativeProject, { recursive: true, force: true });
  state.nativeProject = undefined;
}

Given(
  'a long work update ending in a Next decision that requires a human choice, with every decision role in plain language',
  function (this: SafewordWorld) {
    stateFor(this).reply = [
      'The implementation and focused tests are complete. Production rollout remains intentionally separate.',
      '**CONFIDENT** — The implementation is ready, but the release target needs a human choice.',
      '**Decided:** Keep the release scoped to one channel.',
      '**Open:** human: choose the release channel.',
      '**Next:** Choice: release to the beta channel or the stable channel. Recommendation: choose beta. Reason: beta limits exposure while we verify production telemetry. Impact: beta delays the stable release by one day; stable reaches everyone immediately with more rollback risk. Reply: `beta` or `stable`.',
    ].join('\n\n');
  },
);

Given(
  'the observed pre-contract long reply that mixes a verify-or-scaffold choice, a legacy Open value, and an incomplete Next paragraph',
  function (this: SafewordWorld) {
    stateFor(this).reply = [
      'Verification is available now. I can run it, or I can scaffold the next feature first.',
      '**CONFIDENT** — The implementation is complete and needs a direction for the next step.',
      '**Decided:** Keep the current change intact.',
      '**Open:** Choose whether to verify or scaffold next.',
      '**Next:** Choose the intended target.',
    ].join('\n\n');
  },
);

Given(
  'a blocked work update ending in a Need decision that requires a human choice, with every decision role in plain language',
  function (this: SafewordWorld) {
    stateFor(this).reply = [
      '**BLOCKED** — The release channel requires a human choice.',
      '**Tried:** Verified both release channels are available.',
      '**Need:** Choice: release to beta or stable. Recommendation: choose beta. Reason: beta limits exposure while telemetry is verified. Impact: beta delays the stable release by one day; stable reaches everyone immediately with greater rollback risk. Reply: `beta` or `stable`.',
    ].join('\n\n');
  },
);

Given(
  'a blocked reply whose earlier prose states a complete recommendation and whose Need paragraph says only to confirm the target',
  function (this: SafewordWorld) {
    stateFor(this).reply = [
      `Earlier recommendation: ${decisionTerminal()}`,
      '**BLOCKED** — The release channel requires a human choice.',
      '**Tried:** Verified both channels are available.',
      '**Need:** Confirm the target.',
    ].join('\n\n');
  },
);

Given(
  'a decision paragraph with a necessary unfamiliar term explicitly marked but no plain-language meaning',
  function (this: SafewordWorld) {
    stateFor(this).reply = decisionReply('Next', `${decisionTerminal()} Term: canary = TBD.`);
  },
);

Given(
  'a decision paragraph with a necessary unfamiliar term explicitly marked and explained inline in familiar language',
  function (this: SafewordWorld) {
    stateFor(this).reply = decisionReply(
      'Next',
      `${decisionTerminal()} Term: canary = a release shown to a small group first.`,
    );
  },
);

Given(
  /^a (Next|Need) decision paragraph complete except for (.+)$/u,
  function (this: SafewordWorld, paragraph: 'Next' | 'Need', role: keyof typeof displayToRole) {
    const omitted = displayToRole[role];
    const terminal = Object.entries(decisionValues)
      .filter(([name]) => name !== omitted)
      .map(([name, value]) => `${name}: ${value}.`)
      .join(' ');
    stateFor(this).reply = decisionReply(paragraph, terminal);
  },
);

Given(
  /^a (Next|Need) decision paragraph with every role label present but (.+) contains only a back-reference or placeholder$/u,
  function (this: SafewordWorld, paragraph: 'Next' | 'Need', role: keyof typeof displayToRole) {
    stateFor(this).reply = decisionReply(
      paragraph,
      decisionTerminal({ [displayToRole[role]]: 'as above' }),
    );
  },
);

Given(
  'a Next decision paragraph with every decision role but two unrelated human choices',
  function (this: SafewordWorld) {
    stateFor(this).reply = decisionReply(
      'Next',
      `${decisionTerminal()} Choice: also choose whether to replace the database.`,
    );
  },
);

Given(
  'a substantive no-decision update ending in one concrete next action and one essential reason',
  function (this: SafewordWorld) {
    stateFor(this).reply = actionReply(
      'Action: Run. Object: the release verification. Reason: Required because deployment is blocked until it passes.',
    );
  },
);

Given(
  'a substantive no-decision update ending in one concrete next action and no reason',
  function (this: SafewordWorld) {
    stateFor(this).reply = actionReply('Action: Run. Object: the release verification.');
  },
);

Given(
  'a substantive no-decision update ending in one concrete action and one Required because reason clause that repeats earlier context inside the clause',
  function (this: SafewordWorld) {
    stateFor(this).reply = actionReply(
      'Action: Run. Object: the release verification. Reason: Required because the release verification must pass before deployment.',
    );
  },
);

Given(
  'a substantive no-decision update ending in one concrete action and two Required because reason clauses',
  function (this: SafewordWorld) {
    stateFor(this).reply = actionReply(
      'Action: Run. Object: the release verification. Reason: Required because deployment is blocked. Reason: Required because telemetry is waiting.',
    );
  },
);

Given(
  'a substantive update ending in an action form with an imperative but no specific object',
  function (this: SafewordWorld) {
    stateFor(this).reply = actionReply('Action: Continue.');
  },
);

Given(
  'a substantive no-decision update ending in a list of several concrete next actions',
  function (this: SafewordWorld) {
    stateFor(this).reply = actionReply(
      'Action: Run. Object: the release verification. Action: Deploy. Object: the stable build.',
    );
  },
);

Given(
  'a substantive update declaring Open none whose Next paragraph carries recommendation and tradeoff clauses',
  function (this: SafewordWorld) {
    stateFor(this).reply = actionReply(decisionTerminal());
  },
);

Given(
  'a substantive update declaring a human-owned release-target choice whose Next paragraph uses the action form',
  function (this: SafewordWorld) {
    stateFor(this).reply = actionReply(
      'Action: Deploy. Object: the selected release.',
      'human: choose beta or stable',
    );
  },
);

Given(
  'a substantive no-decision update ending in one concrete action and repeated context outside the Required because reason clause',
  function (this: SafewordWorld) {
    stateFor(this).reply = actionReply(
      'Action: Run. Object: the release verification. The implementation is already complete.',
    );
  },
);

Given(
  'an answer with no structured verdict and no observable current-turn work',
  function (this: SafewordWorld) {
    stateFor(this).reply = 'Yes — that setting is already enabled.';
    stateFor(this).substantiveEvidence = 'none';
  },
);

Given(
  'a reply carrying a structured verdict, no described current-turn work, and no terminal paragraph',
  function (this: SafewordWorld) {
    stateFor(this).reply = '**CONFIDENT** — The change is complete.';
  },
);

Given(
  'a brief reply that reports completed work and ends with no Next or Need paragraph',
  function (this: SafewordWorld) {
    stateFor(this).reply = 'Updated the release configuration.';
    stateFor(this).substantiveEvidence = 'current-turn-tool';
  },
);

Given('a work result ending in an empty Next paragraph', function (this: SafewordWorld) {
  stateFor(this).reply = [
    '**CONFIDENT** — The change is complete.',
    '**Decided:** Keep the focused implementation.',
    '**Open:** none.',
    '**Next:**',
  ].join('\n\n');
});

Given('the canonical terminal-handoff contract', function (this: SafewordWorld) {
  stateFor(this).contract = (
    quality as typeof quality & { TERMINAL_HANDOFF_CONTRACT?: unknown }
  ).TERMINAL_HANDOFF_CONTRACT;
});

Given('a terminal-handoff contract with no version', function (this: SafewordWorld) {
  const { version: _version, ...contract } = quality.TERMINAL_HANDOFF_CONTRACT;
  stateFor(this).contract = contract;
});

Given(
  'a terminal-handoff contract whose Need form requires fewer decision roles than Next',
  function (this: SafewordWorld) {
    const contract = decisionContractFixture();
    stateFor(this).contract = {
      ...contract,
      decision: {
        ...contract.decision,
        Need: contract.decision.Need.slice(1),
      },
    };
  },
);

Given(
  'a versioned symmetric decision contract with no no-decision action form',
  function (this: SafewordWorld) {
    const { action: _action, ...contract } = decisionContractFixture();
    stateFor(this).contract = contract;
  },
);

Given(
  'the shared rule-based terminal-handoff evaluator and the fixed corpus with contract-derived recorded verdicts and missing-role sets',
  function (this: SafewordWorld) {
    stateFor(this).corpus = fixedCorpus();
  },
);

Given(
  'the shared terminal-handoff evaluator and the observed Claude Code transcript whose Next omits decision roles',
  function (this: SafewordWorld) {
    stateFor(this).reply = incompleteCorpusReply('observed decision omission');
  },
);

Given(
  'the shared terminal-handoff evaluator and the long decision transcript with the self-contained rewrite',
  function (this: SafewordWorld) {
    stateFor(this).reply = corpusReply('self-contained Next rewrite');
  },
);

Given(
  'the shared terminal-handoff evaluator and the observed OpenAI Codex transcript with a vague Need and complete earlier prose',
  function (this: SafewordWorld) {
    stateFor(this).reply = incompleteCorpusReply('vague blocked Need');
  },
);

Given(
  'the shared terminal-handoff evaluator and the long blocked transcript with the self-contained Need rewrite',
  function (this: SafewordWorld) {
    stateFor(this).reply = corpusReply('self-contained Need rewrite');
  },
);

Given(
  'the shared terminal-handoff evaluator and the long no-decision transcript',
  function (this: SafewordWorld) {
    stateFor(this).reply = corpusReply('concise no-decision action');
  },
);

Given(
  'the shared terminal-handoff evaluator and the long no-decision transcript ending only with an instruction to continue',
  function (this: SafewordWorld) {
    stateFor(this).reply = corpusReply('vague no-decision action');
  },
);

Given(
  /^a fixed held-out reply not present in the transcript corpus with (.+)$/u,
  function (this: SafewordWorld, fixture: string) {
    const replies: Record<string, string> = {
      'one human-owned choice declared in the decision form': decisionReply(
        'Next',
        decisionTerminal({ Choice: 'ship the patch now or wait for the maintenance window' }),
      ),
      'the same choice disguised as an action': actionReply(
        'Action: Ship. Object: the selected patch.',
        'human: choose now or the maintenance window',
      ),
      'one marked unfamiliar necessary term explained inline': decisionReply(
        'Next',
        `${decisionTerminal()} Term: soak = observe the release without changing it for one hour.`,
      ),
      'the same marked necessary term left without a meaning': decisionReply(
        'Next',
        `${decisionTerminal()} Term: soak = TBD.`,
      ),
      'one concrete action with a Required because reason': actionReply(
        'Action: Run. Object: the release smoke tests. Reason: Required because deployment waits for them.',
      ),
      'one concrete action with explanation outside the Required because clause': actionReply(
        'Action: Run. Object: the release smoke tests. Deployment waits for them.',
      ),
      'one imperative action with a specific object': actionReply(
        'Action: Publish. Object: the release candidate.',
      ),
      'an imperative action with no specific object': actionReply('Action: Continue.'),
    };
    assert.ok(replies[fixture], `unknown held-out fixture ${fixture}`);
    stateFor(this).reply = replies[fixture];
  },
);

Given(
  'the canonical template, generated Claude plugin, generated Codex plugin, Cursor delivery, customer installed, and dogfood installed terminal-handoff contract copies',
  function (this: SafewordWorld) {
    stateFor(this).corpus = fixedCorpus();
  },
);

Given(
  /^the declared contract version is fixed and the (.+) terminal-handoff copy has version drift$/u,
  function (this: SafewordWorld, copy: string) {
    prepareParityFailure(this, copy, 'version');
  },
);

Given(
  'the required terminal-handoff copy set omits the generated Codex plugin copy',
  function (this: SafewordWorld) {
    prepareParityFailure(this, 'generated Codex plugin', 'missing');
  },
);

Given(
  /^the (.+) terminal-handoff copy carries the canonical version but omits the material tradeoff or consequences role$/u,
  function (this: SafewordWorld, copy: string) {
    prepareParityFailure(this, copy, 'role');
  },
);

Given(
  /^the installed Safeword configuration for (Claude Code|OpenAI Codex|Cursor) and the (.+) from the long-form corpus in its native Stop payload$/,
  function (this: SafewordWorld, host: string, corpusCase: string) {
    prepareNativeStop(this, host, corpusReply(corpusCase));
    stateFor(this).nativeExpectedRequirements = corpusRequirements(corpusCase);
  },
);

Given(
  /^the installed Safeword configuration for (Claude Code|OpenAI Codex|Cursor) and a still-incomplete handoff in its native Stop payload$/,
  function (this: SafewordWorld, host: string) {
    prepareNativeStop(this, host, incompleteCorpusReply('observed decision omission'));
  },
);

Given(
  /^the installed Safeword configuration for (Claude Code|OpenAI Codex|Cursor) and an unreadable native Stop payload$/,
  function (this: SafewordWorld, host: string) {
    prepareNativeStop(this, host, '');
    stateFor(this).nativePayload = '{not-json';
  },
);

Given(
  /^the installed Safeword configuration for (Claude Code|OpenAI Codex|Cursor) and the short conversational reply "(.+)" in its native Stop payload$/,
  function (this: SafewordWorld, host: string, reply: string) {
    prepareNativeStop(this, host, reply);
  },
);

Given(
  /^the installed Safeword configuration for (Claude Code|OpenAI Codex|Cursor) and an incomplete handoff in a fresh session after an earlier session emitted a correction$/,
  function (this: SafewordWorld, host: string) {
    prepareNativeStop(this, host, incompleteCorpusReply('observed decision omission'));
    const state = stateFor(this);
    const earlier = invokeNativeStop(state);
    assert.match(earlier, /terminal-handoff\/v1/u);
    const payload = state.nativePayload as Record<string, unknown>;
    if (host === 'Cursor') payload.conversation_id = 'fresh-session';
    else payload.session_id = 'fresh-session';
  },
);

Given(
  /^the installed Safeword configuration for (Claude Code|OpenAI Codex|Cursor), an earlier corrected handoff, and an intervening compliant Stop in the same session$/,
  function (this: SafewordWorld, host: string) {
    prepareNativeStop(this, host, incompleteCorpusReply('observed decision omission'));
    const state = stateFor(this);
    assert.match(invokeNativeStop(state), /terminal-handoff\/v1/u);
    setNativeReply(state, corpusReply('concise no-decision action'));
    assert.doesNotMatch(invokeNativeStop(state), /terminal-handoff\/v1/u);
    setNativeReply(state, incompleteCorpusReply('observed decision omission'));
  },
);

Given(
  /^the installed Safeword configuration for (Claude Code|OpenAI Codex|Cursor) and a terminal-handoff evaluation that fails to complete$/,
  function (this: SafewordWorld, host: string) {
    prepareNativeStop(this, host, incompleteCorpusReply('observed decision omission'));
    const state = stateFor(this);
    const qualityPath = nodePath.join(
      state.nativeProject ?? '',
      host === 'OpenAI Codex'
        ? '.safeword/codex-plugin/templates/hooks/lib/quality.ts'
        : '.safeword/hooks/lib/quality.ts',
    );
    const source = readFileSync(qualityPath, 'utf8');
    const needle = `): DecisionBriefCompliance {\n  const scan = scanTopLevelParagraphs(reply);`;
    assert.ok(source.includes(needle), 'evaluation seam fixture no longer matches quality.ts');
    writeFileSync(
      qualityPath,
      source.replace(
        needle,
        `): DecisionBriefCompliance {\n  throw new Error('simulated terminal-handoff evaluation failure');\n  const scan = scanTopLevelParagraphs(reply);`,
      ),
    );
  },
);

When(
  'the shared deterministic terminal-handoff evaluator checks the reply',
  function (this: SafewordWorld) {
    const state = stateFor(this);
    assert.ok(state.reply, 'reply fixture was not initialized');
    state.evaluation = evaluateDecisionBriefCompliance(state.reply, undefined, {
      substantiveEvidence: state.substantiveEvidence,
    });
  },
);

When(
  'the shared terminal-handoff contract validator checks the contract',
  function (this: SafewordWorld) {
    const validator = (
      quality as typeof quality & {
        validateTerminalHandoffContract?: (contract: unknown) => {
          valid: boolean;
          requirements?: string[];
        };
      }
    ).validateTerminalHandoffContract;
    assert.equal(typeof validator, 'function', 'terminal-handoff contract validator is available');
    stateFor(this).contractValidation = validator(stateFor(this).contract);
  },
);

When('the evaluator checks every corpus reply', function (this: SafewordWorld) {
  const state = stateFor(this);
  state.corpusEvaluations = (state.corpus ?? []).map(({ reply }) =>
    evaluateDecisionBriefCompliance(reply),
  );
});

When(
  /^the evaluator checks the terminal (handoff|action)$/u,
  function (this: SafewordWorld, _form: string) {
    const state = stateFor(this);
    assert.ok(state.reply);
    state.evaluation = evaluateDecisionBriefCompliance(state.reply);
  },
);

When(
  /^the release gate runs "bun scripts\/parity-check\.ts --mode=all"(?: against the fixed transcript corpus)?$/u,
  function (this: SafewordWorld) {
    const state = stateFor(this);
    const result = spawnSync('bun', ['scripts/parity-check.ts', '--mode=all'], {
      cwd: state.parityRoot ?? process.cwd(),
      encoding: 'utf8',
    });
    state.parityStatus = result.status;
    state.parityStderr = result.stderr;
    state.nativeOutput = result.stdout;
    state.parityGateChecked = true;
  },
);

When(
  /^the registered Stop hook command is invoked(?: for the first time)?$/,
  function (this: SafewordWorld) {
    const state = stateFor(this);
    state.nativeOutput = invokeNativeStop(state);
    state.nativeOutputs?.push(state.nativeOutput);
  },
);

When(
  'the registered Stop hook command is invoked twice in succession for the same session',
  function (this: SafewordWorld) {
    const state = stateFor(this);
    const first = invokeNativeStop(state);
    const payload = state.nativePayload as Record<string, unknown>;
    const second = invokeNativeStop(state, {
      ...payload,
      ...(state.nativeHost === 'Cursor' ? { loop_count: 1 } : { stop_hook_active: true }),
    });
    state.nativeOutputs = [first, second];
  },
);

When(
  'a later incomplete handoff reaches the registered Stop hook command',
  function (this: SafewordWorld) {
    const state = stateFor(this);
    state.nativeOutput = invokeNativeStop(state);
  },
);

Then('the decision handoff is accepted as self-contained', function (this: SafewordWorld) {
  assert.deepEqual(stateFor(this).evaluation, {
    compliant: true,
    contractVersion: 'terminal-handoff/v1',
    form: 'decision',
    examinedCharacters: stateFor(this).evaluation?.examinedCharacters,
  });
});

Then(
  'the decision handoff is rejected with the missing decision roles named',
  function (this: SafewordWorld) {
    const evaluation = stateFor(this).evaluation;
    assert.equal(evaluation?.compliant, false);
    assert.equal(evaluation?.form, 'decision');
    assert.deepEqual(evaluation?.requirements, [
      'concrete choice',
      'recommendation',
      'controlling reason',
      'material tradeoff or consequences',
      'exact reply',
    ]);
  },
);

Then('the blocked handoff is accepted as self-contained', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, true);
  assert.equal(stateFor(this).evaluation?.form, 'decision');
});

Then('the blocked handoff is rejected as incomplete', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, false);
  assert.deepEqual(stateFor(this).evaluation?.requirements, [
    'concrete choice',
    'recommendation',
    'controlling reason',
    'material tradeoff or consequences',
    'exact reply',
  ]);
});

Then(
  'the decision handoff is rejected with the unexplained term named',
  function (this: SafewordWorld) {
    assert.equal(stateFor(this).evaluation?.compliant, false);
    assert.ok(stateFor(this).evaluation?.requirements?.includes('plain-language meaning'));
  },
);

Then(
  /^the decision handoff is rejected with (concrete choice|recommendation|controlling reason|material tradeoff or consequences|exact reply) named$/u,
  function (this: SafewordWorld, role: string) {
    assert.equal(stateFor(this).evaluation?.compliant, false);
    assert.ok(stateFor(this).evaluation?.requirements?.includes(role));
  },
);

Then(
  /^the decision handoff is rejected with (concrete choice|recommendation|controlling reason|material tradeoff or consequences|exact reply) named as content-free$/u,
  function (this: SafewordWorld, role: string) {
    assert.equal(stateFor(this).evaluation?.compliant, false);
    assert.ok(stateFor(this).evaluation?.requirements?.includes(role));
  },
);

Then('the decision handoff is rejected as not one concrete choice', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, false);
  assert.ok(stateFor(this).evaluation?.requirements?.includes('concrete choice'));
});

Then('the no-decision handoff is accepted as concrete and concise', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, true);
  assert.equal(stateFor(this).evaluation?.form, 'action');
});

Then(
  'the action handoff is rejected as carrying more than one reason clause',
  function (this: SafewordWorld) {
    assert.equal(stateFor(this).evaluation?.compliant, false);
    assert.ok(stateFor(this).evaluation?.requirements?.includes('one essential reason'));
  },
);

Then('the action handoff is rejected as not concrete', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, false);
  assert.ok(stateFor(this).evaluation?.requirements?.includes('one concrete action'));
});

Then('the action handoff is rejected as not one concrete action', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, false);
  assert.ok(stateFor(this).evaluation?.requirements?.includes('one concrete action'));
});

Then('the action handoff is rejected as unnecessarily ceremonial', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, false);
  assert.ok(stateFor(this).evaluation?.requirements?.includes('one concrete action'));
});

Then('the action handoff is rejected as missing the decision form', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, false);
  assert.equal(stateFor(this).evaluation?.form, 'decision');
});

Then('the action handoff is rejected as unnecessarily verbose', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, false);
  assert.ok(stateFor(this).evaluation?.requirements?.includes('no extra context'));
});

Then(
  'the answer passes unchanged as outside the terminal-handoff contract',
  function (this: SafewordWorld) {
    const evaluation = stateFor(this).evaluation;
    assert.equal(evaluation?.compliant, true);
    assert.equal(evaluation?.form, 'outside');
    assert.equal(evaluation?.violation, undefined);
  },
);

Then('the handoff is rejected as missing', function (this: SafewordWorld) {
  const evaluation = stateFor(this).evaluation;
  assert.equal(evaluation?.compliant, false);
  assert.ok(evaluation?.requirements?.includes('terminal paragraph'));
});

Then('the handoff is rejected as empty', function (this: SafewordWorld) {
  const evaluation = stateFor(this).evaluation;
  assert.equal(evaluation?.compliant, false);
  assert.ok(evaluation?.requirements?.includes('terminal paragraph'));
});

Then(
  'the contract is accepted at the canonical version with exactly these five roles in any order for each of Next and Need: concrete choice, recommendation, controlling reason, material tradeoff or consequences, and exact reply, plus a separate concise no-decision action form',
  function (this: SafewordWorld) {
    const state = stateFor(this);
    assert.deepEqual(state.contractValidation, { valid: true });
    assert.ok(state.contract && typeof state.contract === 'object');

    const contract = state.contract as {
      version?: unknown;
      decision?: { Next?: unknown; Need?: unknown };
      action?: { role?: unknown; optionalReasonPrefix?: unknown };
    };
    const expectedRoles = [
      'concrete choice',
      'recommendation',
      'controlling reason',
      'material tradeoff or consequences',
      'exact reply',
    ];
    const roleNames = (value: unknown): string[] =>
      Array.isArray(value)
        ? value
            .map(entry =>
              entry && typeof entry === 'object' && 'name' in entry
                ? String((entry as { name: unknown }).name)
                : '',
            )
            .sort()
        : [];

    assert.equal(contract.version, 'terminal-handoff/v1');
    assert.deepEqual(roleNames(contract.decision?.Next), [...expectedRoles].sort());
    assert.deepEqual(roleNames(contract.decision?.Need), [...expectedRoles].sort());
    assert.deepEqual(contract.action, {
      role: 'Action',
      optionalReasonPrefix: 'Required because',
    });
  },
);

Then('the contract is rejected with the missing version named', function (this: SafewordWorld) {
  assert.deepEqual(stateFor(this).contractValidation, {
    valid: false,
    requirements: ['version'],
  });
});

Then(
  'the contract is rejected with the asymmetric role requirement named',
  function (this: SafewordWorld) {
    assert.deepEqual(stateFor(this).contractValidation, {
      valid: false,
      requirements: ['symmetric decision roles'],
    });
  },
);

Then(
  'the contract is rejected with the missing no-decision form named',
  function (this: SafewordWorld) {
    assert.deepEqual(stateFor(this).contractValidation, {
      valid: false,
      requirements: ['no-decision action form'],
    });
  },
);

Then(
  'every evaluation of each reply matches its recorded verdict and recorded missing-role set',
  function (this: SafewordWorld) {
    const state = stateFor(this);
    assert.equal(state.corpusEvaluations?.length, state.corpus?.length);
    state.corpus?.forEach(({ expected }, index) => {
      const actual = state.corpusEvaluations?.[index];
      assert.equal(actual?.compliant, expected.compliant);
      assert.equal(actual?.form, expected.form);
      assert.deepEqual(actual?.requirements, expected.requirements);
    });
  },
);

Then(
  'the corpus case is rejected with the decision roles named as missing despite their presence in earlier prose',
  function (this: SafewordWorld) {
    assert.equal(stateFor(this).evaluation?.compliant, false);
    assert.deepEqual(stateFor(this).evaluation?.requirements, requiredDecisionRoles);
  },
);

Then('the corpus case is accepted', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, true);
});

Then('the corpus case is accepted as a concise handoff', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, true);
  assert.equal(stateFor(this).evaluation?.form, 'action');
});

Then('the corpus case is rejected as not concrete', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, false);
  assert.ok(stateFor(this).evaluation?.requirements?.includes('one concrete action'));
});

Then('the held-out reply is accepted', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, true);
});

Then('the held-out reply is rejected as missing the decision form', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, false);
  assert.equal(stateFor(this).evaluation?.form, 'decision');
});

Then(
  'the held-out reply is rejected with the unexplained term named',
  function (this: SafewordWorld) {
    assert.ok(stateFor(this).evaluation?.requirements?.includes('plain-language meaning'));
  },
);

Then('the held-out reply is rejected as unnecessarily verbose', function (this: SafewordWorld) {
  assert.ok(stateFor(this).evaluation?.requirements?.includes('no extra context'));
});

Then('the held-out reply is rejected as not concrete', function (this: SafewordWorld) {
  assert.ok(stateFor(this).evaluation?.requirements?.includes('one concrete action'));
});

Then(
  'every copy exposes the canonical version and exactly the canonical five-role set in any order for each of Next and Need',
  function (this: SafewordWorld) {
    const state = stateFor(this);
    assert.equal(state.parityStatus, 0, state.parityStderr);
    assert.match(state.nativeOutput ?? '', /contracts in sync/u);
    const canonical = readFileSync(deliveredQualityCopies[0], 'utf8');
    for (const copy of deliveredQualityCopies.slice(1)) {
      assert.equal(
        readFileSync(copy, 'utf8'),
        canonical,
        `${copy} drifted from canonical quality.ts`,
      );
    }
  },
);

Then(
  "every copy produces the corpus's recorded verdict and recorded missing-role set for every reply",
  function (this: SafewordWorld) {
    const state = stateFor(this);
    assert.equal(state.parityStatus, 0, state.parityStderr);
    assert.match(state.nativeOutput ?? '', /contracts in sync/u);
    const canonical = readFileSync(deliveredQualityCopies[0], 'utf8');
    for (const copy of deliveredQualityCopies.slice(1)) {
      assert.equal(
        readFileSync(copy, 'utf8'),
        canonical,
        `${copy} drifted from canonical quality.ts`,
      );
    }
    for (const { reply, expected } of state.corpus ?? []) {
      const actual = evaluateDecisionBriefCompliance(reply);
      assert.equal(actual.compliant, expected.compliant);
      assert.equal(actual.form, expected.form);
      assert.deepEqual(actual.requirements, expected.requirements);
    }
  },
);

Then(
  /^parity fails and names the (.+) copy and its (version drift|missing decision role)$/u,
  function (this: SafewordWorld, _copy: string, failureKind: string) {
    const state = stateFor(this);
    assert.equal(state.parityGateChecked, true);
    const target = state.parityTarget;
    assert.ok(target, 'parity target was not prepared');
    const expectedDetail =
      failureKind === 'version drift' ? 'terminal-handoff/v1' : 'material tradeoff or consequences';
    const contractFailure = (state.parityStderr ?? '')
      .split('\n')
      .find(line => line.includes(`[CONTRACT] Missing in ${target}:`));
    assert.ok(contractFailure, `parity did not name ${target}`);
    assert.ok(
      contractFailure.includes(expectedDetail),
      `parity did not name ${expectedDetail} in ${target}'s contract failure`,
    );
    assert.equal(state.parityStatus, 1, state.parityStderr);
  },
);

Then(
  'parity fails and names the missing generated Codex plugin copy',
  function (this: SafewordWorld) {
    const state = stateFor(this);
    assert.equal(state.parityGateChecked, true);
    const target = state.parityTarget;
    assert.ok(target, 'parity target was not prepared');
    assert.ok(
      (state.parityStderr ?? '').includes(`[CONTRACT] Target file missing: ${target}`),
      `parity did not name ${target} as a missing contract copy`,
    );
    assert.equal(state.parityStatus, 1, state.parityStderr);
  },
);

Then(
  /^the process emits one correction carrying the shared contract version and naming the missing requirements in the (decision block reason|followup message) shape$/,
  function (this: SafewordWorld, continuation: string) {
    const state = stateFor(this);
    assert.ok(state.nativeOutput, 'native Stop hook emitted no correction');
    const output = JSON.parse(state.nativeOutput) as {
      decision?: string;
      reason?: string;
      followup_message?: string;
    };
    const correction =
      continuation === 'followup message'
        ? output.followup_message
        : output.decision === 'block'
          ? output.reason
          : undefined;
    assert.ok(correction, `unexpected native continuation: ${state.nativeOutput}`);
    assert.match(correction, /terminal-handoff\/v1/u);
    for (const requirement of state.nativeExpectedRequirements ?? []) {
      assert.ok(correction.includes(requirement), `correction omitted ${requirement}`);
    }
    cleanNativeStop(state);
  },
);

Then(
  /^the process emits one terminal-handoff correction for the (fresh session|later handoff)$/,
  function (this: SafewordWorld, _scope: string) {
    const state = stateFor(this);
    assert.match(state.nativeOutput ?? '', /terminal-handoff\/v1/u);
    cleanNativeStop(state);
  },
);

Then(
  /^the process emits one correction carrying the shared contract version and naming the concrete-action requirement in the (decision block reason|followup message) shape$/,
  function (this: SafewordWorld, continuation: string) {
    const state = stateFor(this);
    assert.ok(state.nativeOutput, 'native Stop hook emitted no concrete-action correction');
    const output = JSON.parse(state.nativeOutput) as {
      decision?: string;
      reason?: string;
      followup_message?: string;
    };
    const correction =
      continuation === 'followup message' ? output.followup_message : output.reason;
    assert.ok(correction);
    assert.match(correction, /terminal-handoff\/v1/u);
    assert.match(correction, /one concrete action/u);
    cleanNativeStop(state);
  },
);

Then(
  /^the process exits successfully with(?:out| no) (?:a )?terminal-handoff correction$/,
  function (this: SafewordWorld) {
    const state = stateFor(this);
    const output = state.nativeOutput
      ? (JSON.parse(state.nativeOutput) as Record<string, unknown>)
      : {};
    try {
      assert.equal(
        output.decision,
        undefined,
        `unexpected terminal-handoff correction: ${state.nativeOutput ?? '<empty>'}`,
      );
      assert.equal(
        output.followup_message,
        undefined,
        `unexpected terminal-handoff correction: ${state.nativeOutput ?? '<empty>'}`,
      );
    } finally {
      cleanNativeStop(state);
    }
  },
);

Then(
  'exactly one terminal-handoff correction is emitted across both invocations',
  function (this: SafewordWorld) {
    const state = stateFor(this);
    const corrections = (state.nativeOutputs ?? []).filter(output =>
      output.includes('terminal-handoff/v1'),
    );
    assert.equal(corrections.length, 1);
    cleanNativeStop(state);
  },
);
