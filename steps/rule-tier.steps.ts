/**
 * Step definitions for features/rule-tier.feature (ticket V0NHT6).
 *
 * Three proof surfaces, matching the impl plan: the intake-exit gate predicate
 * (imported from the hook lib), the pure lint/lineage parsers (imported from
 * the CLI utils), and `safeword check` run as a process against a configured
 * customer project (reusing the shared `safeword check runs` step from
 * feature-surfaces-bdd.steps.ts, which reads `this.temporaryDirectory`).
 */

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  findFeatureLineageIssues,
  findGherkinLintIssues,
  type GherkinLintIssue,
} from '../packages/cli/src/utils/gherkin-feature.ts';
import { evaluateCriteriaGate } from '../packages/cli/templates/hooks/lib/jtbd.ts';

interface RuleTierWorld {
  temporaryDirectory?: string;
  result?: { stdout: string; stderr: string; exitCode: number };
  specContent?: string;
  featureContent?: string;
  gateVerdict?: { ok: boolean; reason?: string };
  lineageIssues?: string[];
  lintIssues?: GherkinLintIssue[];
  lintExitCode?: number;
  cucumberOutput?: string;
  fixtureDirectory?: string;
}

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI_PATH = nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts');
const TICKET_DIR = '.project/tickets/RUL001-demo';

function specWithJtbdBody(body: string): string {
  return ['# Spec', '', '## Jobs To Be Done', '', body, ''].join('\n');
}

const JTBD_HEAD = '### demo.DEV2 — Retry\n\n**Persona:** TB\n';
const R_ONLY_SPEC = specWithJtbdBody(
  `${JTBD_HEAD}\n#### demo.DEV2.R1 — failed deliveries retry on backoff`,
);
const MIXED_SPEC = specWithJtbdBody(
  '### demo.DEV1 — Trace\n\n**Persona:** TB\n\n#### demo.DEV1.AC1 — capability one\n\n#### demo.DEV1.R1 — an invariant beside the AC',
);
const AC_ONLY_SPEC = specWithJtbdBody(
  '### demo.DEV1 — Trace\n\n**Persona:** TB\n\n#### demo.DEV1.AC1 — capability one\n\n#### demo.DEV1.AC2 — capability two',
);

function featureWithScenarios(
  ruleLine: string,
  scenarios: readonly { tags?: string; title: string }[],
): string {
  return [
    'Feature: Demo',
    '',
    `  ${ruleLine}`,
    '',
    ...scenarios.flatMap(({ tags, title }) => [
      ...(tags === undefined ? [] : [`    ${tags}`]),
      `    Scenario: ${title}`,
      '      Given a',
      '      When b',
      '      Then c',
      '',
    ]),
  ].join('\n');
}

const R1_RULE_LINE = 'Rule: demo.DEV2.R1 — failed deliveries retry on backoff';

function runSafewordSetup(project: string): void {
  const result = spawnSync('bun', [CLI_PATH, 'setup', '--yes'], {
    cwd: project,
    env: {
      ...process.env,
      SAFEWORD_NO_AUTO_UPGRADE: '1',
      SAFEWORD_SKIP_INSTALL: '1',
      SAFEWORD_TEST_DISABLE_AUTO_UPGRADE: '1',
    },
    encoding: 'utf8',
    timeout: 120_000,
  });
  assert.equal(result.status, 0, `setup failed:\n${result.stdout}\n${result.stderr}`);
}

function createCheckProject(world: RuleTierWorld, spec: string, feature?: string): void {
  const project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-rule-tier-'));
  writeFileSync(
    nodePath.join(project, 'package.json'),
    JSON.stringify({ name: 'customer-project', version: '1.0.0' }, undefined, 2),
  );
  runSafewordSetup(project);
  // Mark safeword's dev dependencies installed: `check` reports missing
  // packages as the sole failure section, which would preempt the Issues
  // section this feature's scenarios assert on.
  writeFileSync(
    nodePath.join(project, 'package.json'),
    JSON.stringify(
      {
        name: 'customer-project',
        version: '1.0.0',
        devDependencies: {
          '@cucumber/cucumber': '^12.0.0',
          '@types/node': '^24.0.0',
          eslint: '^10.0.0',
          jiti: '^2.2.0',
          prettier: '^3.0.0',
          safeword: '0.0.0-test',
          tsx: '^4.0.0',
        },
      },
      undefined,
      2,
    ),
  );

  const ticketRoot = nodePath.join(project, TICKET_DIR);
  mkdirSync(ticketRoot, { recursive: true });
  writeFileSync(
    nodePath.join(ticketRoot, 'ticket.md'),
    ['---', 'id: RUL001', 'type: feature', 'status: in_progress', '---', ''].join('\n'),
  );
  writeFileSync(nodePath.join(ticketRoot, 'spec.md'), spec);
  writeFileSync(
    nodePath.join(ticketRoot, 'test-definitions.md'),
    '# Test Definitions\n\n## Rule: r\n\n### Scenario: ledger only\n\n- [ ] RED\n',
  );
  if (feature !== undefined) {
    mkdirSync(nodePath.join(project, 'features'), { recursive: true });
    writeFileSync(nodePath.join(project, 'features/demo.feature'), feature);
  }
  world.temporaryDirectory = project;
}

function combinedOutput(world: RuleTierWorld): string {
  assert.ok(world.result, 'safeword check has not run');
  return `${world.result.stdout}\n${world.result.stderr}`;
}

After(function (this: RuleTierWorld) {
  if (this.fixtureDirectory !== undefined) {
    rmSync(this.fixtureDirectory, { recursive: true, force: true });
    this.fixtureDirectory = undefined;
  }
});

// --- Givens: gate (pure predicate on spec content) ---

Given(
  'a ticket spec whose JTBD declares numbered Rules and no ACs',
  function (this: RuleTierWorld) {
    this.specContent = R_ONLY_SPEC;
  },
);

Given(
  'a ticket spec whose JTBD declares no ACs, no Rules, and no skip line',
  function (this: RuleTierWorld) {
    this.specContent = specWithJtbdBody(JTBD_HEAD);
  },
);

Given(
  'a ticket spec whose JTBD carries a skip line instead of criteria',
  function (this: RuleTierWorld) {
    this.specContent = specWithJtbdBody(
      `${JTBD_HEAD}\nskip: internal plumbing — no user-observable capability`,
    );
  },
);

Given(
  'a ticket spec whose JTBD declares both an AC heading and a numbered Rule heading',
  function (this: RuleTierWorld) {
    // Serves both the gate scenario (pure predicate) and the check scenario
    // (process run) — set up both proof surfaces.
    this.specContent = MIXED_SPEC;
    createCheckProject(this, MIXED_SPEC);
  },
);

// --- Givens: lineage / gherkin lint (pure parsers on feature content) ---

Given(
  'a feature file whose Rule block carries a rule ID tag and untagged scenarios',
  function (this: RuleTierWorld) {
    this.featureContent = featureWithScenarios(`@demo.DEV2.R1\n  ${R1_RULE_LINE}`, [
      { title: 'first example' },
      { title: 'second example' },
    ]);
  },
);

Given(
  'a feature file with a scenario carrying an R lineage tag directly and no ID-tagged Rule block',
  function (this: RuleTierWorld) {
    this.featureContent = featureWithScenarios('Rule: plain grouping', [
      { tags: '@demo.DEV2.R1', title: 'direct rule ref' },
    ]);
  },
);

Given(
  'a feature file whose Rule block carries a rule ID tag and a scenario adds an AC lineage tag',
  function (this: RuleTierWorld) {
    this.featureContent = featureWithScenarios(`@demo.DEV2.R1\n  ${R1_RULE_LINE}`, [
      { tags: '@demo.DEV1.AC1', title: 'adds an AC ref' },
    ]);
  },
);

Given(
  'a feature file whose Rule block tag and leading name token carry different rule IDs',
  function (this: RuleTierWorld) {
    this.featureContent = featureWithScenarios(
      '@demo.DEV1.R1\n  Rule: demo.DEV1.R2 — renamed without retagging',
      [{ title: 'example' }],
    );
  },
);

Given(
  'a feature file with a scenario tagged {string}',
  function (this: RuleTierWorld, tag: string) {
    const jtbd = tag.replace(/^@/, '').replace(/\.AC\d+$/, '');
    createCheckProject(
      this,
      specWithJtbdBody(
        `### ${jtbd} — Review\n\n**Persona:** TB\n\n#### ${tag.replace(/^@/, '')} — reviewable`,
      ),
      featureWithScenarios('Rule: grouping', [{ tags: tag, title: 'persona code R example' }]),
    );
  },
);

Given('a feature file with two ID-tagged Rule blocks', function (this: RuleTierWorld) {
  this.fixtureDirectory = mkdtempSync(nodePath.join(tmpdir(), 'rule-tag-lane-'));
  writeFileSync(
    nodePath.join(this.fixtureDirectory, 'demo.feature'),
    [
      'Feature: Demo',
      '',
      '  @demo.DEV2.R1',
      `  ${R1_RULE_LINE}`,
      '',
      '    Scenario: first retry after one minute',
      '      Given a failed delivery',
      '',
      '    Scenario: second retry doubles the wait',
      '      Given a failed delivery',
      '',
      '  @demo.DEV2.R2',
      '  Rule: demo.DEV2.R2 — deliveries stop after the retry budget',
      '',
      '    Scenario: delivery abandoned after final retry',
      '      Given an exhausted budget',
      '',
    ].join('\n'),
  );
});

// --- Givens: safeword check fixtures (configured project) ---

Given(
  'a ticket spec declaring a numbered Rule that no feature scenario references',
  function (this: RuleTierWorld) {
    createCheckProject(
      this,
      R_ONLY_SPEC,
      featureWithScenarios('Rule: grouping', [{ tags: '@other.SM1.AC1', title: 'unrelated' }]),
    );
  },
);

Given(
  'a feature scenario referencing a rule number its spec JTBD never declared',
  function (this: RuleTierWorld) {
    createCheckProject(
      this,
      R_ONLY_SPEC,
      featureWithScenarios('Rule: grouping', [{ tags: '@demo.DEV2.R5', title: 'stale ref' }]),
    );
  },
);

Given(
  'a feature scenario referencing a rule under a JTBD absent from the spec',
  function (this: RuleTierWorld) {
    createCheckProject(
      this,
      R_ONLY_SPEC,
      featureWithScenarios('Rule: grouping', [{ tags: '@ghost.SM1.R1', title: 'orphan ref' }]),
    );
  },
);

Given(
  'a spec-declared numbered Rule whose feature scenarios carry no rejection tag',
  function (this: RuleTierWorld) {
    createCheckProject(
      this,
      R_ONLY_SPEC,
      featureWithScenarios(`@demo.DEV2.R1\n  ${R1_RULE_LINE}`, [{ title: 'happy path only' }]),
    );
  },
);

Given(
  'a spec-declared numbered Rule with at least one rejection-tagged feature scenario',
  function (this: RuleTierWorld) {
    createCheckProject(
      this,
      R_ONLY_SPEC,
      featureWithScenarios(`@demo.DEV2.R1\n  ${R1_RULE_LINE}`, [
        { title: 'happy path' },
        { tags: '@rejection', title: 'refused when budget exhausted' },
      ]),
    );
  },
);

Given(
  'a feature file with an unnumbered Rule grouping block and no rejection-tagged scenarios',
  function (this: RuleTierWorld) {
    createCheckProject(
      this,
      AC_ONLY_SPEC,
      featureWithScenarios('Rule: plain grouping header', [
        { tags: '@demo.DEV1.AC1', title: 'flat lineage' },
        { tags: '@demo.DEV1.AC2', title: 'more flat lineage' },
      ]),
    );
  },
);

Given(
  'a project whose specs and feature files use only AC lineage, including unnumbered Rule grouping blocks without rejection tags',
  function (this: RuleTierWorld) {
    createCheckProject(
      this,
      AC_ONLY_SPEC,
      featureWithScenarios('Rule: plain grouping header', [
        { tags: '@demo.DEV1.AC1', title: 'covers only capability one' },
      ]),
    );
  },
);

Given(
  'a feature file shaped like an existing rule-numbered corpus with a matching spec catalog',
  function (this: RuleTierWorld) {
    const corpusSpec = specWithJtbdBody(
      `${JTBD_HEAD}\n#### demo.DEV2.R1 — failed deliveries retry on backoff\n\n#### demo.DEV2.R2 — deliveries stop after the retry budget`,
    );
    const corpusFeature = [
      'Feature: Webhook retries',
      '',
      '  @demo.DEV2.R1',
      `  ${R1_RULE_LINE}`,
      '',
      '    Scenario: first retry after one minute',
      '      Given a failed delivery',
      '      When the retry fires',
      '      Then the delivery is retried',
      '',
      '    @rejection',
      '    Scenario: malformed payload is not retried',
      '      Given a malformed delivery',
      '      When the retry evaluates it',
      '      Then the delivery is rejected',
      '',
      '  @demo.DEV2.R2',
      '  Rule: demo.DEV2.R2 — deliveries stop after the retry budget',
      '',
      '    @rejection',
      '    Scenario: delivery abandoned after final retry',
      '      Given an exhausted budget',
      '      When the retry evaluates it',
      '      Then the delivery is abandoned',
      '',
    ].join('\n');
    this.featureContent = corpusFeature;
    createCheckProject(this, corpusSpec, corpusFeature);
  },
);

Given(/^a project exhibiting (.+)$/, function (this: RuleTierWorld, condition: string) {
  switch (condition) {
    case 'a numbered rule with no rejection-tagged scenario': {
      createCheckProject(
        this,
        R_ONLY_SPEC,
        featureWithScenarios(`@demo.DEV2.R1\n  ${R1_RULE_LINE}`, [{ title: 'happy path only' }]),
      );
      return;
    }
    case 'a JTBD mixing AC and Rule headings': {
      createCheckProject(this, MIXED_SPEC);
      return;
    }
    case 'a spec rule no scenario references': {
      createCheckProject(
        this,
        R_ONLY_SPEC,
        featureWithScenarios('Rule: grouping', [{ tags: '@other.SM1.AC1', title: 'unrelated' }]),
      );
      return;
    }
    case 'a rule reference with a missing rule number': {
      createCheckProject(
        this,
        R_ONLY_SPEC,
        featureWithScenarios('Rule: grouping', [{ tags: '@demo.DEV2.R5', title: 'stale ref' }]),
      );
      return;
    }
    case 'a rule reference whose JTBD is absent': {
      createCheckProject(
        this,
        R_ONLY_SPEC,
        featureWithScenarios('Rule: grouping', [{ tags: '@ghost.SM1.R1', title: 'orphan ref' }]),
      );
      return;
    }
    case 'a JTBD with neither criteria kind and no skip line': {
      this.specContent = specWithJtbdBody(JTBD_HEAD);
      return;
    }
    case 'a Rule block whose name token disagrees with its tag': {
      this.featureContent = featureWithScenarios(
        '@demo.DEV1.R1\n  Rule: demo.DEV1.R2 — renamed without retagging',
        [{ title: 'example' }],
      );
      return;
    }
    case 'a scenario with two lineage references': {
      this.featureContent = featureWithScenarios(`@demo.DEV2.R1\n  ${R1_RULE_LINE}`, [
        { tags: '@demo.DEV1.AC1', title: 'adds an AC ref' },
      ]);
      return;
    }
    default: {
      throw new Error(`Unknown rule-tier condition: ${condition}`);
    }
  }
});

// --- Whens ---
// (`safeword check runs` is shared — defined in feature-surfaces-bdd.steps.ts.)

When('the intake-exit gate evaluates test-definitions creation', function (this: RuleTierWorld) {
  assert.ok(this.specContent, 'no spec content staged');
  this.gateVerdict = evaluateCriteriaGate(this.specContent);
});

When('the intake-exit gate runs', function (this: RuleTierWorld) {
  assert.ok(this.specContent, 'no spec content staged');
  this.gateVerdict = evaluateCriteriaGate(this.specContent);
});

When('lineage lint runs', function (this: RuleTierWorld) {
  assert.ok(this.featureContent, 'no feature content staged');
  this.lineageIssues = findFeatureLineageIssues(this.featureContent);
});

When('gherkin lint runs', function (this: RuleTierWorld) {
  assert.ok(this.featureContent, 'no feature content staged');
  this.lintIssues = findGherkinLintIssues(this.featureContent, {
    filePath: 'features/demo.feature',
  });
});

When('safeword check and gherkin lint run', function (this: RuleTierWorld) {
  assert.ok(this.temporaryDirectory, 'customer project was not created');
  const check = spawnSync('bun', [CLI_PATH, 'check', '--offline'], {
    cwd: this.temporaryDirectory,
    env: { ...process.env, SAFEWORD_NO_AUTO_UPGRADE: '1' },
    encoding: 'utf8',
    timeout: 120_000,
  });
  this.result = {
    stdout: check.stdout ?? '',
    stderr: check.stderr ?? '',
    exitCode: check.status ?? 1,
  };
  const lint = spawnSync(
    'bun',
    [CLI_PATH, 'lint-gherkin', nodePath.join(this.temporaryDirectory, 'features/demo.feature')],
    { cwd: this.temporaryDirectory, encoding: 'utf8', timeout: 60_000 },
  );
  this.lintExitCode = lint.status ?? 1;
});

When(
  'the cucumber lane runs with a tag expression selecting one rule ID',
  function (this: RuleTierWorld) {
    assert.ok(this.fixtureDirectory, 'no cucumber fixture staged');
    const result = spawnSync(
      'bunx',
      [
        'cucumber-js',
        '--dry-run',
        '--format',
        'summary',
        '--tags',
        '@demo.DEV2.R1',
        nodePath.join(this.fixtureDirectory, 'demo.feature'),
      ],
      { cwd: nodePath.join(REPO_ROOT, 'packages/cli'), encoding: 'utf8', timeout: 120_000 },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    this.cucumberOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  },
);

// --- Thens: gate ---

Then('the gate allows the creation', function (this: RuleTierWorld) {
  assert.ok(this.gateVerdict, 'gate has not run');
  assert.equal(this.gateVerdict.ok, true, this.gateVerdict.reason);
});

Then('the gate denies the creation', function (this: RuleTierWorld) {
  assert.ok(this.gateVerdict, 'gate has not run');
  assert.equal(this.gateVerdict.ok, false);
});

Then(
  'the denial message names both Acceptance Criteria and numbered Rules as options',
  function (this: RuleTierWorld) {
    assert.ok(this.gateVerdict?.reason, 'no denial reason recorded');
    assert.match(this.gateVerdict.reason, /#### <id>\.AC<n>/);
    assert.match(this.gateVerdict.reason, /#### <id>\.R<n>/);
    assert.match(this.gateVerdict.reason, /numbered rules/);
  },
);

// --- Thens: check output ---

Then('a check issue names that JTBD as mixing criteria kinds', function (this: RuleTierWorld) {
  assert.match(
    combinedOutput(this),
    /JTBD demo\.DEV1 declares both Acceptance Criteria and numbered Rules; keep one criteria kind per job/,
  );
  assert.equal(this.result?.exitCode, 1, 'mixed criteria should be a hard check issue');
});

Then('an uncovered advisory names that rule ID', function (this: RuleTierWorld) {
  assert.match(
    combinedOutput(this),
    /numbered rule demo\.DEV2\.R1 has no scenario illustrating it \(uncovered\)/,
  );
});

Then('a stale advisory names that rule reference', function (this: RuleTierWorld) {
  assert.match(
    combinedOutput(this),
    /scenario ref demo\.DEV2\.R5 matches no numbered rule under its JTBD \(stale ref\)/,
  );
});

Then('an orphan advisory names that rule reference', function (this: RuleTierWorld) {
  assert.match(
    combinedOutput(this),
    /scenario ref ghost\.SM1\.R1 names no JTBD in spec\.md \(orphan\)/,
  );
});

Then('a zero-rejection-path advisory names that rule ID', function (this: RuleTierWorld) {
  assert.match(
    combinedOutput(this),
    /numbered rule demo\.DEV2\.R1 has no example of the rule being broken/,
  );
});

Then('no zero-rejection-path advisory is reported', function (this: RuleTierWorld) {
  assert.doesNotMatch(combinedOutput(this), /has no example of the rule being broken/);
});

Then(
  'the coverage report attributes the scenario to AC {string}',
  function (this: RuleTierWorld, acId: string) {
    const output = combinedOutput(this);
    assert.ok(
      !output.includes(`acceptance criterion ${acId} has no scenario`),
      `AC ${acId} should be covered by the tagged scenario:\n${output}`,
    );
  },
);

Then(
  'no stale or orphan rule advisory is reported for {string}',
  function (this: RuleTierWorld, jtbd: string) {
    const output = combinedOutput(this);
    assert.doesNotMatch(output, new RegExp(`${jtbd.replaceAll('.', String.raw`\.`)}.*stale ref`));
    assert.doesNotMatch(output, new RegExp(`${jtbd.replaceAll('.', String.raw`\.`)}.*orphan`));
  },
);

Then('the coverage report resolves every rule reference', function (this: RuleTierWorld) {
  const output = combinedOutput(this);
  assert.doesNotMatch(output, /uncovered/);
  assert.doesNotMatch(output, /stale ref/);
  assert.doesNotMatch(output, /orphan/);
});

// Equivalence check, not a stored golden: the flat AC fixture must produce
// exactly the one advisory it would have produced before this feature (the
// uncovered demo.DEV1.AC2 line, path-normalized to the ticket label), and no
// rule-tier vocabulary may leak into an AC-only project's output.
Then(
  'the output is byte-identical to the recorded flat-lineage snapshot after path normalization',
  function (this: RuleTierWorld) {
    const output = combinedOutput(this);
    const ticketLines = output
      .split('\n')
      .filter(line => line.includes('RUL001'))
      .map(line => line.replace(/^.*?(demo \(RUL001\))/, '$1').trimEnd());
    assert.deepEqual(ticketLines, [
      'demo (RUL001): acceptance criterion demo.DEV1.AC2 has no scenario (uncovered)',
    ]);
    assert.doesNotMatch(output, /numbered rule|rejection|mixing criteria|rule-name-tag/i);
    assert.equal(this.lintExitCode, 0, 'gherkin lint should stay clean for the AC-only project');
  },
);

// --- Thens: pure lint ---

Then('no lineage issue is reported', function (this: RuleTierWorld) {
  assert.ok(this.lineageIssues, 'lineage lint has not run');
  assert.deepEqual(this.lineageIssues, []);
});

Then('a multiple-lineage issue names that scenario', function (this: RuleTierWorld) {
  assert.ok(this.lineageIssues, 'lineage lint has not run');
  assert.equal(this.lineageIssues.length, 1);
  assert.match(
    this.lineageIssues[0] ?? '',
    /Scenario "adds an AC ref" has multiple lineage tags after inheritance/,
  );
});

Then('a name-tag mismatch issue names that Rule block', function (this: RuleTierWorld) {
  assert.ok(this.lintIssues, 'gherkin lint has not run');
  const mismatch = this.lintIssues.find(issue => issue.rule === 'rule-name-tag-mismatch');
  assert.ok(mismatch, JSON.stringify(this.lintIssues));
  assert.match(mismatch.message, /demo\.DEV1\.R2 — renamed without retagging/);
});

// --- Thens: cucumber selection ---

Then('only the scenarios under that Rule block execute', function (this: RuleTierWorld) {
  assert.ok(this.cucumberOutput, 'cucumber lane has not run');
  assert.match(this.cucumberOutput, /\b2 scenarios?\b/);
  assert.doesNotMatch(this.cucumberOutput, /\b3 scenarios?\b/);
  assert.doesNotMatch(this.cucumberOutput, /delivery abandoned after final retry/);
});

// --- Then: NTB message contract (Scenario Outline) ---

const MESSAGE_CONTRACT: Record<
  string,
  { surface: 'check' | 'gate' | 'gherkin' | 'lineage'; id: RegExp; nextAction: RegExp }
> = {
  'zero-rejection advisory': {
    surface: 'check',
    id: /numbered rule demo\.DEV2\.R1/,
    nextAction: /add a @rejection-tagged scenario under it/,
  },
  'mixed-criteria issue': {
    surface: 'check',
    id: /JTBD demo\.DEV1/,
    nextAction: /convert one set or split the job/,
  },
  'uncovered advisory': {
    surface: 'check',
    id: /numbered rule demo\.DEV2\.R1/,
    nextAction: /add a scenario tagged @demo\.DEV2\.R1/,
  },
  'stale advisory': {
    surface: 'check',
    id: /scenario ref demo\.DEV2\.R5/,
    nextAction: /retag to a declared rule or declare it in spec\.md/,
  },
  'orphan advisory': {
    surface: 'check',
    id: /scenario ref ghost\.SM1\.R1/,
    nextAction: /fix the tag's JTBD id or add that JTBD to spec\.md/,
  },
  'denial message': {
    surface: 'gate',
    id: /JTBD "demo\.DEV2/,
    nextAction: /add ≥1 `#### <id>\.R<n>`, ≥1 `#### <id>\.AC<n>`, or `skip: <reason>`/,
  },
  'name-tag mismatch issue': {
    surface: 'gherkin',
    id: /Rule "demo\.DEV1\.R2/,
    nextAction: /make the name's first token match the tag/,
  },
  'multiple-lineage issue': {
    surface: 'lineage',
    id: /Scenario "adds an AC ref"/,
    nextAction: /keep exactly one @<jtbd>\.AC# or @<jtbd>\.R# tag/,
  },
};

Then(
  /^the (.+) names (?:.+), states the problem in plain language, and carries a concrete next action$/,
  function (this: RuleTierWorld, messageKind: string) {
    const contract = MESSAGE_CONTRACT[messageKind];
    assert.ok(contract, `Unknown rule-tier message kind: ${messageKind}`);
    let text: string;
    switch (contract.surface) {
      case 'check': {
        text = combinedOutput(this);
        break;
      }
      case 'gate': {
        assert.ok(this.gateVerdict?.reason, 'no denial reason recorded');
        text = this.gateVerdict.reason;
        break;
      }
      case 'gherkin': {
        assert.ok(this.lintIssues, 'gherkin lint has not run');
        text = this.lintIssues.map(issue => issue.message).join('\n');
        break;
      }
      case 'lineage': {
        assert.ok(this.lineageIssues, 'lineage lint has not run');
        text = this.lineageIssues.join('\n');
        break;
      }
    }
    assert.match(text, contract.id);
    assert.match(text, contract.nextAction);
  },
);
