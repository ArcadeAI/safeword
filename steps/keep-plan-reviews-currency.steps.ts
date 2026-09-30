import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { PLANNING_CONTRACTS } from '../packages/cli/src/planning/contracts.generated.js';
import { parsePlanningContract } from '../packages/cli/src/planning/phase-contract.js';
import { reviewJobStatus } from '../packages/cli/src/review/job.js';
import { createTrustedReviewerDirectory } from '../packages/cli/tests/review-fixtures.js';
import { fixtureProject, reviewerExecutable } from './keep-plan-reviews-installed-context.steps.js';
import type { SafewordWorld } from './world.js';

const cli = path.resolve(import.meta.dirname, '../packages/cli/src/cli.ts');
const contractSource = path.resolve(
  import.meta.dirname,
  '../packages/cli/templates/skills/bdd/PLAN_IMPLEMENTATION.md',
);
const plan = '.project/tickets/CTX123-current-context/impl-plan.md';

interface CurrencyState {
  root: string;
  reviewer: string;
  reviewId: string;
  statuses: string[];
  retainFailure?: string;
  staleFailure?: string;
}
const states = new WeakMap<SafewordWorld, CurrencyState>();

function run(root: string, reviewer: string, args: string[]) {
  const result = spawnSync('bun', [cli, 'review', ...args, '--json', '--no-input'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      PATH: `${reviewer}:${process.env.PATH ?? ''}`,
      CLAUDE_PROJECT_DIR: root,
      SAFEWORD_AGENT_RUNTIME: 'claude',
    },
  });
  const output = JSON.parse(result.stdout) as {
    data: {
      status: string;
      review_id: string;
      review_identity?: { dependencies: { role: string }[] };
    };
    errors: unknown[];
  };
  assert.deepEqual(output.errors, [], `${result.stdout}\n${result.stderr}`);
  return output;
}

function status(state: CurrencyState): string {
  return run(state.root, state.reviewer, ['status', state.reviewId]).data.status;
}

function mutate(state: CurrencyState, file: string, before: string, after: string): string {
  const absolute = path.join(state.root, file);
  const original = readFileSync(absolute, 'utf8');
  assert.ok(original.includes(before), `${file} must contain the expected fixture text`);
  writeFileSync(absolute, original.replace(before, after));
  try {
    return status(state);
  } finally {
    writeFileSync(absolute, original);
  }
}

function appendAndCheck(state: CurrencyState, file: string, addition: string): string {
  const absolute = path.join(state.root, file);
  const original = readFileSync(absolute, 'utf8');
  writeFileSync(absolute, `${original}\n${addition}\n`);
  try {
    return status(state);
  } finally {
    writeFileSync(absolute, original);
  }
}

function statusWithContractSource(state: CurrencyState, before: string, after: string): string {
  const source = readFileSync(contractSource, 'utf8');
  assert.ok(source.includes(before));
  const parsed = parsePlanningContract('plan-implementation', source.replace(before, after));
  const contract = PLANNING_CONTRACTS['plan-implementation'] as Record<string, string>;
  const original = { ...contract };
  try {
    Object.assign(contract, parsed);
    const result = reviewJobStatus(state.root, state.reviewId);
    return (result.data as { status: string }).status;
  } finally {
    Object.assign(contract, original);
  }
}

After(function (this: SafewordWorld) {
  const state = states.get(this);
  if (state) {
    rmSync(state.root, { recursive: true, force: true });
    rmSync(state.reviewer, { recursive: true, force: true });
  }
  states.delete(this);
});

Given(
  "a plan has a current review recorded against its canonical phase contract, accepted scope, Rules, scenarios, plan decisions, applicable principles, applicable dimensions and data guidance, configured architecture records, and the project's surfaces and personas inventories",
  function (this: SafewordWorld) {
    const root = fixtureProject();
    const reviewer = createTrustedReviewerDirectory('safeword-r4-currency-');
    states.set(this, { root, reviewer, reviewId: '', statuses: [] });
    writeFileSync(path.join(root, 'package.json'), '{"name":"r4-currency","private":true}\n');
    const installed = spawnSync(
      'bun',
      [cli, 'install', '--agents=claude', '--no-input', '--no-modify', '--json', '--cwd', root],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 60_000,
        env: { ...process.env, SAFEWORD_SKIP_INSTALL: '1', SAFEWORD_SKIP_SKILLS: '1' },
      },
    );
    const installation = JSON.parse(installed.stdout) as { errors: unknown[] };
    assert.deepEqual(installation.errors, [], `${installed.stdout}\n${installed.stderr}`);
    const configPath = path.join(root, '.safeword/config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    const architecture = '.project/architecture.md';
    writeFileSync(
      path.join(root, architecture),
      '# Approval architecture\n\nKeep review receipts authenticated.\n',
    );
    writeFileSync(
      path.join(root, '.project/tickets/CTX123-current-context/dimensions.md'),
      '# Dimensions\n\n## Approval source\n\nCurrent and authenticated.\n',
    );
    const dataGuide = path.join(root, '.safeword/guides/data-architecture-guide.md');
    mkdirSync(path.dirname(dataGuide), { recursive: true });
    writeFileSync(
      dataGuide,
      readFileSync(
        path.resolve(
          import.meta.dirname,
          '../packages/cli/templates/guides/data-architecture-guide.md',
        ),
        'utf8',
      ),
    );
    const planPath = path.join(root, plan);
    writeFileSync(
      planPath,
      readFileSync(planPath, 'utf8').replace(
        'skip: No product data is stored.',
        'Review receipt data follows the data architecture guide.',
      ),
    );
    writeFileSync(
      configPath,
      JSON.stringify({
        ...config,
        paths: { ...(config.paths as Record<string, unknown>), architecture },
        crossAgentReview: 'prefer',
        crossAgentReviewRoutes: { claude: [{ reviewer: 'opencode' }] },
      }),
    );
    reviewerExecutable(reviewer);
    const approved = run(root, reviewer, ['run', 'plan-implementation', plan]);
    assert.equal(approved.data.status, 'approved');
    const boundRoles = new Set(
      approved.data.review_identity?.dependencies.map(entry => entry.role),
    );
    for (const role of [
      'ticket',
      'project',
      'rules',
      'scenarios',
      'principles',
      'personas',
      'surfaces',
      'dimensions',
      'architecture',
      'data',
    ])
      assert.ok(boundRoles.has(role), `The approving receipt must bind ${role}.`);
    const state = states.get(this);
    assert.ok(state);
    state.reviewId = approved.data.review_id;
    assert.equal(status(state), 'approved');
  },
);

When(
  'a bound context artifact changes only in whitespace or comments occurs',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    state.retainFailure = 'bound context cosmetic change made review stale';
    state.statuses = [
      mutate(
        state,
        '.project/tickets/CTX123-current-context/ticket.md',
        '# Ticket',
        '# Ticket\n\n<!-- editorial -->',
      ),
      mutate(
        state,
        '.project/tickets/CTX123-current-context/spec.md',
        '## Product Bet\n\n',
        '## Product Bet\n\n<!-- editorial -->\n\n',
      ),
      mutate(
        state,
        '.project/tickets/CTX123-current-context/spec.md',
        '#### approval.BU1.R1 — Preserve approval\n\n',
        '#### approval.BU1.R1 — Preserve approval\n\n<!-- editorial -->\n\n',
      ),
      mutate(
        state,
        'features/current-context.feature',
        'Feature: Trust current approval',
        '# editorial\nFeature: Trust current approval',
      ),
      mutate(
        state,
        '.project/tickets/CTX123-current-context/dimensions.md',
        '# Dimensions\n\n',
        '# Dimensions\n\n<!-- editorial -->\n\n',
      ),
      mutate(state, '.project/principles.md', '# Principles', '<!-- editorial -->\n\n# Principles'),
      mutate(
        state,
        '.project/personas.md',
        '## Builder (BU)\n\n',
        '## Builder (BU)\n\n<!-- editorial -->\n\n',
      ),
      mutate(
        state,
        '.project/surfaces.md',
        '## Safeword CLI\n\n',
        '## Safeword CLI\n\n<!-- editorial -->\n\n',
      ),
      mutate(
        state,
        '.project/architecture.md',
        '# Approval architecture\n\n',
        '# Approval architecture\n\n<!-- editorial -->\n\n',
      ),
      appendAndCheck(state, '.safeword/guides/data-architecture-guide.md', '<!-- editorial -->'),
    ];
  },
);

When('an unrelated persona or surface entry is added occurs', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state);
  state.statuses = [
    mutate(
      state,
      '.project/personas.md',
      '# Personas',
      '# Personas\n\n## Reader (RD)\n\n**Role:** Reads unrelated guidance.\n',
    ),
    mutate(
      state,
      '.project/surfaces.md',
      '# Surfaces',
      '# Surfaces\n\n## Documentation site\n\n**Kind:** Website\n',
    ),
  ];
});

When(
  'the canonical phase contract changes only in whitespace or comments occurs',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    state.retainFailure = 'canonical contract comment changed review currency';
    state.statuses = [
      statusWithContractSource(state, '- **Purpose:**', '- **Purpose:**   '),
      statusWithContractSource(
        state,
        'Decide a coherent implementation approach',
        'Decide a coherent <!-- editorial --> implementation approach',
      ),
    ];
  },
);

When('the canonical phase contract changes semantically occurs', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state);
  state.staleFailure = 'shared planning clause changed review currency';
  state.statuses = [
    statusWithContractSource(
      state,
      'Decide a coherent implementation approach',
      'Decide a permissive implementation approach',
    ),
    statusWithContractSource(
      state,
      'Each planning approval establishes only its own phase decision.',
      'Each planning approval establishes every downstream phase decision.',
    ),
    statusWithContractSource(
      state,
      'Decide a coherent implementation approach within accepted behavior.',
      'Decide a coherent implementation approach within accepted behavior.\n\n  Also permit unreviewed rollout.',
    ),
    ...[
      'Entry criteria',
      'Required content',
      'Prohibited content',
      'Review question',
      'Approval meaning',
      'Invalidation',
      'Return path',
    ].map(field =>
      statusWithContractSource(
        state,
        `- **${field}:** `,
        `- **${field}:** Permit a different decision. `,
      ),
    ),
  ];
});

When(
  'the reviewed plan changes only in whitespace or comments outside normalized Execution Plan checklist progress cells occurs',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    state.statuses = [mutate(state, plan, '## Approach', '<!-- editorial -->\n\n## Approach')];
  },
);

When(
  'any listed bound context artifact changes semantically occurs',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    const changes = [
      [
        '.project/tickets/CTX123-current-context/ticket.md',
        'scope: preserve authenticated approval',
        'scope: allow anonymous approval',
      ],
      [
        '.project/tickets/CTX123-current-context/spec.md',
        'Only current approval advances.',
        'Stale approval may advance.',
      ],
      [
        '.project/tickets/CTX123-current-context/spec.md',
        'Approval authenticates the current source.',
        'Approval accepts any source.',
      ],
      [
        'features/current-context.feature',
        'Then the current context reaches review',
        'Then stale context reaches review',
      ],
      [
        '.project/tickets/CTX123-current-context/dimensions.md',
        'Current and authenticated.',
        'Stale and anonymous.',
      ],
      [
        '.project/principles.md',
        'Current authenticated approval controls advancement.',
        'Anonymous approval controls advancement.',
      ],
      ['.project/personas.md', 'Needs current authenticated approval', 'Needs anonymous approval'],
      [
        '.project/surfaces.md',
        'Requests and presents planning approval',
        'Rejects planning approval',
      ],
      [
        '.project/architecture.md',
        'Keep review receipts authenticated.',
        'Allow unsigned review receipts.',
      ],
    ] as const;
    state.statuses = [
      ...changes.map(([file, before, after]) => mutate(state, file, before, after)),
      appendAndCheck(
        state,
        '.safeword/guides/data-architecture-guide.md',
        '## New approval data constraint\n\nRetain review provenance.',
      ),
    ];
    assert.equal(
      status(state),
      'approved',
      'Restoring each source must restore the same approval.',
    );
  },
);

Then('the review remains current', function (this: SafewordWorld) {
  const state = states.get(this);
  const statuses = state?.statuses;
  assert.ok(statuses?.length);
  assert.deepEqual(
    statuses,
    statuses.map(() => 'approved'),
    state.retainFailure,
  );
});

Then('the review becomes stale', function (this: SafewordWorld) {
  const state = states.get(this);
  const statuses = state?.statuses;
  assert.ok(statuses?.length);
  assert.deepEqual(
    statuses,
    statuses.map(() => 'stale'),
    state.staleFailure,
  );
});

Then(
  "that plan's review becomes stale because its exact bytes changed",
  function (this: SafewordWorld) {
    assert.deepEqual(states.get(this)?.statuses, ['stale']);
  },
);

Then('that dependent review becomes stale for every such artifact', function (this: SafewordWorld) {
  const statuses = states.get(this)?.statuses;
  assert.ok(statuses?.length);
  assert.deepEqual(
    statuses,
    statuses.map(() => 'stale'),
  );
});
