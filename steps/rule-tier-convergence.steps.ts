/**
 * Step definitions for features/rule-tier-convergence.feature (ticket 1SVCB9).
 *
 * Deliberately imports no CLI-src module: cucumber's runtime tsx loader does not
 * rewrite transitive `.js` specifiers, so the codemod is exercised by running
 * `safeword migrate-ac` as a process (like the `safeword check` scenarios). The
 * gate and check steps reuse the shared vocabulary defined in rule-tier.steps.ts
 * and feature-surfaces-bdd.steps.ts; only the Rule-convergence-specific Givens
 * and Thens live here. Full in-process coverage is in the vitest suite.
 */

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { Given, setDefaultTimeout, Then, When } from '@cucumber/cucumber';

// `safeword setup` + `check`/`migrate-ac` spawn per scenario; give bounded
// headroom over cucumber's 5s default.
setDefaultTimeout(120_000);

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI_PATH = nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts');
const TEMPLATES = nodePath.join(REPO_ROOT, 'packages/cli/templates');
const TICKET = '.project/tickets/CNV001-demo';

interface World {
  specContent?: string;
  templateText?: string;
  gateVerdict?: { ok: boolean; reason?: string };
  before?: string;
  after?: string;
  artifact?: string;
  temporaryDirectory?: string;
  migrateResult?: { stdout: string; stderr: string; exitCode: number };
  result?: { stdout: string; stderr: string; exitCode: number };
}

function jtbdSpec(body: string): string {
  return ['# Spec', '', '## Jobs To Be Done', '', body, ''].join('\n');
}

const JTBD = '### demo.SM1 — Trace\n\n**Persona:** SM\n';

function feature(tags: readonly string[]): string {
  return [
    'Feature: Demo',
    '',
    '  Rule: r',
    '',
    ...tags.flatMap((tag, index) => [
      `    ${tag}`,
      `    Scenario: s${index + 1}`,
      '      Given a',
      '      When b',
      '      Then c',
      '',
    ]),
  ].join('\n');
}

interface TicketFiles {
  spec?: string;
  feature?: string;
  ledger?: string;
  status?: string;
}

function createProject(files: TicketFiles): string {
  const project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-convergence-'));
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
  const setup = spawnSync('bun', [CLI_PATH, 'setup', '--yes'], {
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
  assert.equal(setup.status, 0, `setup failed:\n${setup.stdout}\n${setup.stderr}`);

  const ticketRoot = nodePath.join(project, TICKET);
  mkdirSync(ticketRoot, { recursive: true });
  writeFileSync(
    nodePath.join(ticketRoot, 'ticket.md'),
    [
      '---',
      'id: CNV001',
      'type: feature',
      `status: ${files.status ?? 'in_progress'}`,
      '---',
      '',
    ].join('\n'),
  );
  writeFileSync(nodePath.join(ticketRoot, 'spec.md'), files.spec ?? jtbdSpec(JTBD));
  writeFileSync(
    nodePath.join(ticketRoot, 'test-definitions.md'),
    files.ledger ?? '# Test Definitions\n\n## Rule: r\n\n### Scenario: ledger only\n\n- [ ] RED\n',
  );
  if (files.feature !== undefined) {
    mkdirSync(nodePath.join(project, 'features'), { recursive: true });
    writeFileSync(nodePath.join(project, 'features/demo.feature'), files.feature);
  }
  return project;
}

function runSafeword(directory: string, arguments_: readonly string[]): World['result'] {
  const run = spawnSync('bun', [CLI_PATH, ...arguments_], {
    cwd: directory,
    env: { ...process.env, SAFEWORD_NO_AUTO_UPGRADE: '1' },
    encoding: 'utf8',
    timeout: 120_000,
  });
  return { stdout: run.stdout ?? '', stderr: run.stderr ?? '', exitCode: run.status ?? 1 };
}

function output(world: World): string {
  assert.ok(world.result, 'safeword check has not run');
  return `${world.result.stdout}\n${world.result.stderr}`;
}

function read(directory: string, relativePath: string): string {
  return readFileSync(nodePath.join(directory, relativePath), 'utf8');
}

// --- SM1.R1: authoring surfaces (files on disk) ---

Given('the shipped spec template', function (this: World) {
  this.templateText = readFileSync(nodePath.join(TEMPLATES, 'spec-template.md'), 'utf8');
});

Given('the shipped spec template and bdd skill guidance', function (this: World) {
  this.templateText = [
    readFileSync(nodePath.join(TEMPLATES, 'spec-template.md'), 'utf8'),
    readFileSync(nodePath.join(TEMPLATES, 'skills/bdd/DISCOVERY.md'), 'utf8'),
    readFileSync(nodePath.join(TEMPLATES, 'skills/bdd/SCENARIOS.md'), 'utf8'),
  ].join('\n');
});

When('an author reads its Jobs To Be Done guidance', function () {});
When('an author reads how to decompose a JTBD', function () {});

Then('it scaffolds a numbered Rule heading as the criteria under a JTBD', function (this: World) {
  assert.match(this.templateText ?? '', /####\s+\S+\.R<n>|####\s+oauth-flow\.PO1\.R1/);
});

Then(
  'no surface presents Acceptance Criteria as a criteria tier to choose',
  function (this: World) {
    assert.doesNotMatch(this.templateText ?? '', /Alternative(?: tier)?:.*Rules/i);
  },
);

Then(
  'no surface states that a JTBD declares one criteria kind, never both',
  function (this: World) {
    assert.doesNotMatch(this.templateText ?? '', /never both/i);
    assert.doesNotMatch(this.templateText ?? '', /one criteria kind/i);
  },
);

// --- Intake-exit gate Givens (the `gate evaluates`/`allows`/`denies` Whens and
// Thens are reused from rule-tier.steps.ts) ---

Given('a ticket spec whose JTBD declares a numbered Rule and no skip line', function (this: World) {
  this.specContent = jtbdSpec(`${JTBD}\n#### demo.SM1.R1 — an invariant`);
});

Given('a ticket spec whose JTBD declares no criteria and no skip line', function (this: World) {
  this.specContent = jtbdSpec(JTBD);
});

Given(
  'a ticket spec whose JTBD carries a skip line with a non-empty reason instead of criteria',
  function (this: World) {
    this.specContent = jtbdSpec(`${JTBD}\nskip: internal plumbing — no user-observable guarantee`);
  },
);

Given(
  'a ticket spec whose JTBD carries a skip line with no reason after the colon',
  function (this: World) {
    this.specContent = jtbdSpec(`${JTBD}\nskip:`);
  },
);

Given(
  'a ticket spec whose JTBD declares only an Acceptance Criterion heading',
  function (this: World) {
    this.specContent = jtbdSpec(`${JTBD}\n#### demo.SM1.AC1 — a legacy capability`);
  },
);

Then(
  'the denial message names a numbered Rule heading as the criterion to add',
  function (this: World) {
    assert.match(this.gateVerdict?.reason ?? '', /#### <id>\.R<n>/);
  },
);

Then(
  'the denial message does not present Acceptance Criteria as a co-equal criterion',
  function (this: World) {
    assert.doesNotMatch(this.gateVerdict?.reason ?? '', /acceptance criteria/i);
  },
);

// --- SM1.R2 + NTB1.R1/R2: advisory text via `safeword check` ---
// (`safeword check runs` is defined in feature-surfaces-bdd.steps.ts and reads
// this.temporaryDirectory → this.result.)

// `a ticket spec whose JTBD declares both an AC heading and a numbered Rule
// heading` is defined in rule-tier.steps.ts (sets specContent + a check project);
// reused here, not redefined.

Given(
  'a ticket spec whose JTBD declares both an AC heading and a numbered Rule heading, neither referenced by any scenario',
  function (this: World) {
    this.temporaryDirectory = createProject({
      spec: jtbdSpec(`${JTBD}\n#### demo.SM1.AC1 — cap\n\n#### demo.SM1.R1 — invariant`),
      feature: feature(['@demo.SM1.R9']),
    });
  },
);

Given(
  'a ticket spec declaring criterion {word} that no feature scenario references',
  function (this: World, reference: string) {
    const spelling = reference.replace(/^.*\./, '');
    this.temporaryDirectory = createProject({
      spec: jtbdSpec(`${JTBD}\n#### demo.SM1.${spelling} — an unreferenced criterion`),
      feature: feature(['@demo.SM1.R7']),
    });
    this.before = reference;
  },
);

Given(
  'a feature scenario whose lineage reference is {word} and drifts as {word}',
  function (this: World, reference: string, _drift: string) {
    this.temporaryDirectory = createProject({
      spec: jtbdSpec(`${JTBD}\n#### demo.SM1.R1 — the declared rule`),
      feature: feature([`@${reference}`]),
    });
    this.before = reference;
  },
);

Given(
  'a ticket spec declaring an AC and a feature scenario referencing it',
  function (this: World) {
    this.temporaryDirectory = createProject({
      spec: jtbdSpec(`${JTBD}\n#### demo.SM1.AC1 — a legacy capability`),
      feature: feature(['@demo.SM1.AC1']),
    });
  },
);

Given(
  'a ticket spec declaring an AC and a feature scenario referencing a different AC number under the same JTBD',
  function (this: World) {
    this.temporaryDirectory = createProject({
      spec: jtbdSpec(`${JTBD}\n#### demo.SM1.AC1 — a legacy capability`),
      feature: feature(['@demo.SM1.AC7']),
    });
  },
);

Given('a feature scenario tagged {string}', function (this: World, tag: string) {
  const reference = tag.replace(/^@/, '');
  const jtbd = reference.replace(/\.(?:AC|R)\d+$/, '');
  this.temporaryDirectory = createProject({
    spec: jtbdSpec(`### ${jtbd} — Review\n\n**Persona:** SM\n\n#### ${reference} — a criterion`),
    feature: feature([tag]),
  });
  this.before = reference;
});

Given('an in-progress ticket whose spec uses an AC heading', function (this: World) {
  this.temporaryDirectory = createProject({ spec: jtbdSpec(`${JTBD}\n#### demo.SM1.AC1 — cap`) });
});

Given(
  'an in-progress ticket whose spec uses an AC heading and is otherwise healthy',
  function (this: World) {
    this.temporaryDirectory = createProject({ spec: jtbdSpec(`${JTBD}\n#### demo.SM1.AC1 — cap`) });
  },
);

Given('an in-progress ticket whose feature file uses an AC lineage tag', function (this: World) {
  this.temporaryDirectory = createProject({
    spec: jtbdSpec(`${JTBD}\n#### demo.SM1.R1 — a rule`),
    feature: feature(['@demo.SM1.AC1']),
  });
});

Given('an in-progress ticket whose spec and feature use only Rule lineage', function (this: World) {
  this.temporaryDirectory = createProject({
    spec: jtbdSpec(`${JTBD}\n#### demo.SM1.R1 — a rule`),
    feature: feature(['@demo.SM1.R1', '@demo.SM1.R1 @rejection']),
  });
});

Given('a completed ticket whose spec uses an AC heading', function (this: World) {
  this.temporaryDirectory = createProject({
    status: 'done',
    spec: jtbdSpec(`${JTBD}\n#### demo.SM1.AC1 — cap`),
  });
});

Then('no mixed-criteria issue is reported', function (this: World) {
  assert.doesNotMatch(output(this), /mixing criteria kinds|declares both Acceptance Criteria/i);
});

Then('safeword check reports no health issue for that JTBD', function (this: World) {
  assert.notEqual(this.result?.exitCode, 1, `expected no hard issue:\n${output(this)}`);
});

Then('both the AC and the Rule are reported uncovered', function (this: World) {
  assert.match(output(this), /demo\.SM1\.AC1.*uncovered/i);
  assert.match(output(this), /demo\.SM1\.R1.*uncovered/i);
});

Then(
  'an uncovered advisory names {word} and refers to it as a Rule, never as an Acceptance Criterion',
  function (this: World, reference: string) {
    const combined = output(this);
    assert.match(combined, new RegExp(`${reference.replaceAll('.', '\\.')}.*uncovered`, 'i'));
    assert.doesNotMatch(combined, /acceptance criterion/i);
  },
);

Then(
  'a {word} advisory names {word} and refers to it as a Rule, never as an Acceptance Criterion',
  function (this: World, drift: string, reference: string) {
    const combined = output(this);
    assert.match(combined, new RegExp(`${reference.replaceAll('.', '\\.')}.*\\(${drift}`, 'i'));
    assert.doesNotMatch(combined, /acceptance criterion|matches no AC/i);
  },
);

Then('the coverage report attributes the scenario to that criterion', function (this: World) {
  assert.doesNotMatch(output(this), /demo\.SM1\.AC1.*(orphan|stale)/i);
});

Then('no uncovered, stale, or orphan advisory is reported for it', function (this: World) {
  assert.doesNotMatch(output(this), /demo\.SM1\.AC1.*(uncovered|stale|orphan)/i);
});

Then(
  'the coverage report attributes the scenario to criterion {string}',
  function (this: World, reference: string) {
    assert.doesNotMatch(
      output(this),
      new RegExp(`${reference.replaceAll('.', '\\.')}.*(stale|orphan)`, 'i'),
    );
  },
);

Then('a stale advisory names the undeclared AC reference', function (this: World) {
  assert.match(output(this), /demo\.SM1\.AC7.*stale/i);
});

Then('a deprecation advisory names safeword migrate-ac as the fix', function (this: World) {
  assert.match(output(this), /safeword migrate-ac/);
});

Then(
  'the advisory states the AC name is retired in favor of the Rule tier',
  function (this: World) {
    assert.match(output(this), /\.AC.*retired.*Rule|deprecated \.AC/i);
  },
);

Then('no deprecation advisory is reported', function (this: World) {
  assert.doesNotMatch(output(this), /migrate-ac/);
});

Then('no deprecation advisory is reported for that ticket', function (this: World) {
  assert.doesNotMatch(output(this), /migrate-ac/);
});

Then(
  'the AC deprecation is reported as an advisory and not as a health issue',
  function (this: World) {
    assert.match(output(this), /migrate-ac/);
    assert.notEqual(this.result?.exitCode, 1);
  },
);

// --- TB1: codemod via `safeword migrate-ac` (process) ---

Given(
  /^a (spec heading|feature tag|test-definitions ref) containing the AC reference "(.+)"$/,
  function (this: World, artifact: string, before: string) {
    this.artifact = artifact;
    this.before = before;
    const files: TicketFiles = {};
    if (artifact === 'spec heading') files.spec = jtbdSpec(`${JTBD}\n${before}`);
    else if (artifact === 'feature tag') files.feature = feature([before]);
    else files.ledger = `# Test Definitions\n\n## Rule: r\n\n${before}\n\n- [ ] RED\n`;
    this.temporaryDirectory = createProject(files);
  },
);

Given('a spec declaring an AC and a feature scenario referencing it', function (this: World) {
  this.temporaryDirectory = createProject({
    spec: jtbdSpec(`${JTBD}\n#### demo.SM1.AC1 — cap`),
    feature: feature(['@demo.SM1.AC1']),
  });
});

Given(
  'a feature file whose Rule block carries the block-level tag {string}',
  function (this: World, tag: string) {
    this.temporaryDirectory = createProject({
      spec: jtbdSpec(`${JTBD}\n#### demo.SM1.R1 — grouped`),
      feature: [
        'Feature: Demo',
        '',
        `  ${tag}`,
        '  Rule: demo.SM1.R1 — grouped',
        '',
        '    Scenario: s',
        '      Given a',
        '      When b',
        '      Then c',
        '',
      ].join('\n'),
    });
    this.before = tag.replace(/^@/, '');
  },
);

Given(
  'a spec JTBD declaring AC1, AC2, and AC3 and feature scenarios referencing each',
  function (this: World) {
    this.temporaryDirectory = createProject({
      spec: jtbdSpec(
        `${JTBD}\n#### demo.SM1.AC1 — one\n\n#### demo.SM1.AC2 — two\n\n#### demo.SM1.AC3 — three`,
      ),
      feature: feature(['@demo.SM1.AC1', '@demo.SM1.AC2', '@demo.SM1.AC3']),
    });
  },
);

Given(
  'a spec whose JTBD id and Rule headings contain the letter R but no AC reference',
  function (this: World) {
    this.temporaryDirectory = createProject({
      spec: jtbdSpec('### feat.R1 — Review\n\n**Persona:** R\n\n#### feat.R1.R2 — an invariant'),
    });
  },
);

Given('a project whose specs and features already use only Rule lineage', function (this: World) {
  this.temporaryDirectory = createProject({
    spec: jtbdSpec(`${JTBD}\n#### demo.SM1.R1 — a rule`),
    feature: feature(['@demo.SM1.R1']),
  });
});

Given('a spec and feature using AC lineage', function (this: World) {
  this.temporaryDirectory = createProject({
    spec: jtbdSpec(`${JTBD}\n#### demo.SM1.AC1 — cap`),
    feature: feature(['@demo.SM1.AC1']),
  });
});

Given(
  'a spec file with a JTBD declaring both AC1 and an existing R1 heading',
  function (this: World) {
    this.temporaryDirectory = createProject({
      spec: jtbdSpec(`${JTBD}\n#### demo.SM1.AC1 — cap\n\n#### demo.SM1.R1 — invariant`),
    });
  },
);

Given(
  'a run over one file with a colliding JTBD and one clean AC-only file',
  function (this: World) {
    this.temporaryDirectory = createProject({
      spec: jtbdSpec(`${JTBD}\n#### demo.SM1.AC1 — cap\n\n#### demo.SM1.R1 — invariant`),
    });
    // A second, clean, in-progress ticket in the same project.
    const clean = nodePath.join(this.temporaryDirectory, '.project/tickets/CNV002-clean');
    mkdirSync(clean, { recursive: true });
    writeFileSync(
      nodePath.join(clean, 'ticket.md'),
      ['---', 'id: CNV002', 'type: feature', 'status: in_progress', '---', ''].join('\n'),
    );
    writeFileSync(
      nodePath.join(clean, 'spec.md'),
      jtbdSpec('### demo.SM2 — Other\n\n**Persona:** SM\n\n#### demo.SM2.AC1 — cap'),
    );
  },
);

When('safeword migrate-ac runs', function (this: World) {
  assert.ok(this.temporaryDirectory, 'no project staged');
  this.migrateResult = runSafeword(this.temporaryDirectory, ['migrate-ac']);
});

When('safeword migrate-ac runs with the dry-run flag', function (this: World) {
  assert.ok(this.temporaryDirectory, 'no project staged');
  this.migrateResult = runSafeword(this.temporaryDirectory, ['migrate-ac', '--dry-run']);
});

function artifactPath(world: World): string {
  if (world.artifact === 'feature tag') return 'features/demo.feature';
  if (world.artifact === 'test-definitions ref') return `${TICKET}/test-definitions.md`;
  return `${TICKET}/spec.md`;
}

Then(
  /^the (?:spec heading|feature tag|test-definitions ref) contains "(.+)" and no longer contains "(.+)"$/,
  function (this: World, after: string, before: string) {
    const content = read(this.temporaryDirectory ?? '', artifactPath(this));
    assert.ok(content.includes(after), `expected "${after}" in ${content}`);
    assert.ok(!content.includes(before), `did not expect "${before}"`);
  },
);

Then(
  'the spec heading and the scenario tag both carry the same rewritten Rule id',
  function (this: World) {
    const dir = this.temporaryDirectory ?? '';
    assert.match(read(dir, `${TICKET}/spec.md`), /#### demo\.SM1\.R1/);
    assert.match(read(dir, 'features/demo.feature'), /@demo\.SM1\.R1/);
  },
);

Then('safeword check reports the criterion as covered', function (this: World) {
  const result = runSafeword(this.temporaryDirectory ?? '', ['check', '--offline']);
  assert.doesNotMatch(
    `${result.stdout}\n${result.stderr}`,
    /demo\.SM1\.R1.*(uncovered|stale|orphan)/i,
  );
});

Then(
  'the Rule block carries {string} and no longer carries {string}',
  function (this: World, after: string, before: string) {
    const content = read(this.temporaryDirectory ?? '', 'features/demo.feature');
    assert.ok(content.includes(after), `expected "${after}"`);
    assert.ok(!content.includes(before), `did not expect "${before}"`);
  },
);

Then(
  'the headings and tags for all three read R1, R2, and R3 with no AC reference remaining',
  function (this: World) {
    const spec = read(this.temporaryDirectory ?? '', `${TICKET}/spec.md`);
    assert.match(spec, /#### demo\.SM1\.R1/);
    assert.match(spec, /#### demo\.SM1\.R2/);
    assert.match(spec, /#### demo\.SM1\.R3/);
    assert.doesNotMatch(spec, /\.AC\d/);
  },
);

Then('no heading or tag is modified', function (this: World) {
  const spec = read(this.temporaryDirectory ?? '', `${TICKET}/spec.md`);
  assert.match(spec, /#### feat\.R1\.R2/);
  assert.doesNotMatch(this.migrateResult?.stdout ?? '', /migrated:/);
});

Then('no file is modified', function (this: World) {
  assert.match(this.migrateResult?.stdout ?? '', /No \.AC references found/i);
});

Then('it reports the rewrites it would make', function (this: World) {
  assert.match(this.migrateResult?.stdout ?? '', /would migrate/i);
});

Then('no file on disk is modified', function (this: World) {
  assert.match(read(this.temporaryDirectory ?? '', `${TICKET}/spec.md`), /#### demo\.SM1\.AC1/);
});

Then('it refuses to migrate that JTBD and reports the collision', function (this: World) {
  assert.match(this.migrateResult?.stdout ?? '', /refused/i);
});

Then("the JTBD's headings are left unchanged", function (this: World) {
  const spec = read(this.temporaryDirectory ?? '', `${TICKET}/spec.md`);
  assert.match(spec, /#### demo\.SM1\.AC1/);
});

Then('it reports the collision and leaves that file unchanged', function (this: World) {
  assert.match(this.migrateResult?.stdout ?? '', /refused/i);
  assert.match(read(this.temporaryDirectory ?? '', `${TICKET}/spec.md`), /#### demo\.SM1\.AC1/);
});

Then('the colliding file is reported and left unchanged', function (this: World) {
  assert.match(this.migrateResult?.stdout ?? '', /refused/i);
  assert.match(read(this.temporaryDirectory ?? '', `${TICKET}/spec.md`), /#### demo\.SM1\.AC1/);
});

Then('the clean file is migrated to Rule lineage', function (this: World) {
  assert.match(
    read(this.temporaryDirectory ?? '', '.project/tickets/CNV002-clean/spec.md'),
    /#### demo\.SM2\.R1/,
  );
});
