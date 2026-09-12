import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import { evaluateDecisionBriefCompliance } from '../packages/cli/templates/hooks/lib/quality.js';
import type { SafewordWorld } from './world.js';

interface HandoffState {
  reply?: string;
  substantiveEvidence?: 'current-turn-tool' | 'none';
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
