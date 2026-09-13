import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import * as quality from '../packages/cli/templates/hooks/lib/quality.js';
import { evaluateDecisionBriefCompliance } from '../packages/cli/templates/hooks/lib/quality.js';
import { runParity, type ParityResult } from '../packages/cli/src/parity.js';
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
  parityResult?: ParityResult;
  parityRoot?: string;
  parityTarget?: string;
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
    return actionReply('Action: Run the focused terminal-handoff tests.');
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
  'Cursor delivery': '.safeword/hooks/lib/quality.ts',
  'customer installed': 'customer/.safeword/hooks/lib/quality.ts',
  'dogfood installed': '.safeword/hooks/lib/quality.ts',
};

function prepareParityFailure(
  world: SafewordWorld,
  label: string,
  kind: 'missing' | 'role' | 'version',
) {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-handoff-parity-'));
  const target = parityCopyPath[label];
  assert.ok(target, `unknown parity copy ${label}`);
  const targetPath = nodePath.join(root, target);
  if (kind !== 'missing') {
    mkdirSync(nodePath.dirname(targetPath), { recursive: true });
    const version = kind === 'version' ? 'terminal-handoff/v0' : 'terminal-handoff/v1';
    const impact = kind === 'role' ? '' : 'material tradeoff or consequences';
    writeFileSync(
      targetPath,
      `${version}\nconcrete choice\nrecommendation\ncontrolling reason\n${impact}\nexact reply\n`,
    );
  }
  const templates = nodePath.join(root, 'templates');
  mkdirSync(templates, { recursive: true });
  const state = stateFor(world);
  state.parityRoot = root;
  state.parityTarget = target;
  state.parityResult = runParity({
    rootDirectory: root,
    templatesDirectory: templates,
    mode: 'all',
    schema: {
      ownedFiles: {},
      contracts: {
        [target]: {
          requires: [
            'terminal-handoff/v1',
            'concrete choice',
            'recommendation',
            'controlling reason',
            'material tradeoff or consequences',
            'exact reply',
          ],
        },
      },
    },
  });
}

function nativeHookPath(host: string, project: string): string {
  const hooks = nodePath.join(project, '.safeword/hooks');
  if (host === 'Claude Code') return nodePath.join(hooks, 'stop-quality.ts');
  if (host === 'OpenAI Codex') return nodePath.join(hooks, 'codex/stop.ts');
  return nodePath.join(hooks, 'cursor/stop.ts');
}

function prepareNativeStop(world: SafewordWorld, host: string, reply: string): void {
  const project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-handoff-'));
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  cpSync(
    nodePath.join(process.cwd(), 'packages/cli/templates/hooks'),
    nodePath.join(project, '.safeword/hooks'),
    {
      recursive: true,
    },
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
  const result = spawnSync('bun', [nativeHookPath(state.nativeHost, state.nativeProject)], {
    cwd: state.nativeProject,
    env: { ...process.env, CLAUDE_PROJECT_DIR: state.nativeProject },
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
      'Action: Run the release verification. Reason: Required because deployment is blocked until it passes.',
    );
  },
);

Given(
  'a substantive no-decision update ending in one concrete next action and no reason',
  function (this: SafewordWorld) {
    stateFor(this).reply = actionReply('Action: Run the release verification.');
  },
);

Given(
  'a substantive no-decision update ending in one concrete action and one Required because reason clause that repeats earlier context inside the clause',
  function (this: SafewordWorld) {
    stateFor(this).reply = actionReply(
      'Action: Run the release verification. Reason: Required because the release verification must pass before deployment.',
    );
  },
);

Given(
  'a substantive no-decision update ending in one concrete action and two Required because reason clauses',
  function (this: SafewordWorld) {
    stateFor(this).reply = actionReply(
      'Action: Run the release verification. Reason: Required because deployment is blocked. Reason: Required because telemetry is waiting.',
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
      'Action: Run the release verification. Action: Deploy the stable build.',
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
      'Action: Deploy the selected release.',
      'human: choose beta or stable',
    );
  },
);

Given(
  'a substantive no-decision update ending in one concrete action and repeated context outside the Required because reason clause',
  function (this: SafewordWorld) {
    stateFor(this).reply = actionReply(
      'Action: Run the release verification. The implementation is already complete.',
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
    stateFor(this).contract = {
      ...quality.TERMINAL_HANDOFF_CONTRACT,
      decision: {
        ...quality.TERMINAL_HANDOFF_CONTRACT.decision,
        Need: quality.TERMINAL_HANDOFF_CONTRACT.decision.Need.slice(1),
      },
    };
  },
);

Given(
  'a versioned symmetric decision contract with no no-decision action form',
  function (this: SafewordWorld) {
    const { action: _action, ...contract } = quality.TERMINAL_HANDOFF_CONTRACT;
    stateFor(this).contract = contract;
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
  /^the installed Safeword configuration for (Claude Code|OpenAI Codex|Cursor) and a short conversational reply in its native Stop payload$/,
  function (this: SafewordWorld, host: string) {
    prepareNativeStop(this, host, corpusReply('short conversational reply'));
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
    const qualityPath = nodePath.join(
      stateFor(this).nativeProject ?? '',
      '.safeword/hooks/lib/quality.ts',
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
    const output = JSON.parse(state.nativeOutput ?? '{}') as {
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
    assert.equal(output.decision, undefined);
    assert.equal(output.followup_message, undefined);
    cleanNativeStop(state);
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
