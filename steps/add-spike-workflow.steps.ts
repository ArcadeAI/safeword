import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { writeCodexPluginCatalogue } from '../packages/cli/src/codex-plugin/catalogue.ts';
import { VERSION } from '../packages/cli/src/version.ts';

interface SpikeWorkflowWorld {
  projectDirectory?: string;
  setupResult?: { status: number | null; stdout: string; stderr: string };
  spikeSkill?: string;
  missingCharterField?: string;
  uncertaintyKind?: string;
  spikeShape?: string;
  spikeResult?: string;
  repositoryDirectory?: string;
  productionWorktree?: string;
  spikeWorktree?: string;
  preSpikeBase?: string;
  spikeCommit?: string;
  planCommit?: string;
  planReviewed?: boolean;
  validatedScenarioContent?: string;
  ticketStateContent?: string;
  dirtyValidatedState?: string;
  initialBranches?: string;
  initialWorktrees?: string;
  codexPluginDirectory?: string;
  codexSpikeSkill?: string;
  bddScenariosGuidance?: string;
  bddDiscoveryGuidance?: string;
  bddPhase?: string;
  bddPlanningGuidance?: string;
}

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI_PATH = nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts');
const SPIKE_SKILL_PATH = nodePath.join(REPO_ROOT, 'packages/cli/templates/skills/spike/SKILL.md');

function readSpikeSkill(): string {
  return readFileSync(SPIKE_SKILL_PATH, 'utf8');
}

function runGit(directory: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  return (result.stdout ?? '').trim();
}

function createGitRepositoryFixture(prefix: string): {
  projectDirectory: string;
  repositoryDirectory: string;
} {
  const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), prefix));
  const repositoryDirectory = nodePath.join(projectDirectory, 'repo');
  runGit(projectDirectory, ['init', 'repo']);
  runGit(repositoryDirectory, ['config', 'user.email', 'spike@example.test']);
  runGit(repositoryDirectory, ['config', 'user.name', 'Spike Test']);
  return { projectDirectory, repositoryDirectory };
}

function writeValidatedState(
  repositoryDirectory: string,
  scenarioContent: string,
  ticketContent: string,
): { scenarioPath: string; ticketPath: string } {
  const scenarioPath = nodePath.join(repositoryDirectory, 'features/example.feature');
  const ticketPath = nodePath.join(repositoryDirectory, '.project/tickets/T/ticket.md');
  mkdirSync(nodePath.dirname(scenarioPath), { recursive: true });
  mkdirSync(nodePath.dirname(ticketPath), { recursive: true });
  writeFileSync(scenarioPath, scenarioContent);
  writeFileSync(ticketPath, ticketContent);
  return { scenarioPath, ticketPath };
}

After(function (this: SpikeWorkflowWorld) {
  if (this.projectDirectory !== undefined) {
    rmSync(this.projectDirectory, { recursive: true, force: true });
  }
});

Given('a validated feature with a build-only kill risk', function (this: SpikeWorkflowWorld) {
  this.spikeSkill = readSpikeSkill();
});

When('the maintainer invokes the spike action', function (this: SpikeWorkflowWorld) {
  assert.ok(this.spikeSkill, 'spike skill was not loaded');
});

Then(
  'the experiment requires a question, hypothesis, kill criterion, proof, and budget',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.spikeSkill);
    for (const field of ['Question', 'Hypothesis', 'Kill criterion', 'Proof', 'Budget']) {
      assert.match(this.spikeSkill, new RegExp(`\\*\\*${field}\\*\\*`));
    }
  },
);

Given(/^the uncertainty is (.+)$/, function (this: SpikeWorkflowWorld, kind: string) {
  this.uncertaintyKind = kind;
  this.spikeSkill = readSpikeSkill();
});

When('the maintainer considers a spike', function (this: SpikeWorkflowWorld) {
  assert.ok(this.uncertaintyKind);
});

Then('the workflow directs the maintainer to {word}', function (this: SpikeWorkflowWorld, route) {
  const expected: Record<string, RegExp> = {
    research: /documentation or code[^\n]*→ research it/i,
    elicit: /user-only knowledge[^\n]*→ `?\/elicit`?/i,
    'figure-it-out': /researchable alternatives[^\n]*→ `?\/figure-it-out`?/i,
  };
  assert.match(this.spikeSkill ?? '', expected[route] ?? /this-pattern-must-not-match/);
});

Then('no experimental code begins', function (this: SpikeWorkflowWorld) {
  assert.match(
    this.spikeSkill ?? '',
    /Otherwise route the uncertainty before writing experimental code/i,
  );
});

Given(/^a proposed spike contains (.+)$/, function (this: SpikeWorkflowWorld, shape: string) {
  this.spikeShape = shape;
  this.spikeSkill = readSpikeSkill();
});

When('the workflow bounds the experiment', function (this: SpikeWorkflowWorld) {
  assert.ok(this.spikeShape);
});

Then(
  /^it (creates one experiment|permits only those variants to fan out|rejects the proposal as production implementation)$/,
  function (this: SpikeWorkflowWorld, outcome: string) {
    const expected: Record<string, RegExp> = {
      'creates one experiment': /Default to one experiment, one worker/i,
      'permits only those variants to fan out':
        /parallel worktrees only for independent comparison variants/i,
      'rejects the proposal as production implementation':
        /Reject feature-wide component work[\s\S]*production implementation/i,
    };
    assert.match(this.spikeSkill ?? '', expected[outcome] ?? /this-pattern-must-not-match/);
  },
);

Given(
  /^a bounded spike has reached a (VALIDATED|PARTIAL|INVALIDATED) result$/,
  function (this: SpikeWorkflowWorld, result: string) {
    this.spikeResult = result;
    this.spikeSkill = readSpikeSkill();
  },
);

When('the maintainer distills the experiment', function (this: SpikeWorkflowWorld) {
  assert.ok(this.spikeResult);
});

Then(
  'the workflow returns its evidence, shortcuts, decision, and production consequences',
  function (this: SpikeWorkflowWorld) {
    const skill = this.spikeSkill ?? '';
    assert.match(skill, /VALIDATED[\s\S]*PARTIAL[\s\S]*INVALIDATED/);
    for (const field of ['Evidence', 'Useful shortcuts', 'Decision', 'Production consequences']) {
      assert.match(skill, new RegExp(`- ${field}:`));
    }
    assert.match(skill, /Return a concise report/i);
  },
);

Given(
  'a completed spike returned structured evidence and impl-plan.md does not exist',
  function (this: SpikeWorkflowWorld) {
    this.bddPlanningGuidance = readFileSync(
      nodePath.join(REPO_ROOT, 'packages/cli/templates/skills/bdd/PLAN_IMPLEMENTATION.md'),
      'utf8',
    );
  },
);

When('plan-implementation begins', function (this: SpikeWorkflowWorld) {
  assert.ok(this.bddPlanningGuidance);
});

Then('plan-implementation creates impl-plan.md', function (this: SpikeWorkflowWorld) {
  assert.match(
    this.bddPlanningGuidance ?? '',
    /produces the implementation design record — `impl-plan\.md`/i,
  );
});

Then('it maps evidence to the Approach proof', function (this: SpikeWorkflowWorld) {
  assert.match(this.bddPlanningGuidance ?? '', /evidence → Approach proof/i);
});

Then('it maps shortcuts to the build order', function (this: SpikeWorkflowWorld) {
  assert.match(this.bddPlanningGuidance ?? '', /shortcuts → Approach build order/i);
});

Then('it maps the decision to Decisions', function (this: SpikeWorkflowWorld) {
  assert.match(this.bddPlanningGuidance ?? '', /decision → Decisions/i);
});

Then(
  'it maps production consequences to implementation tasks and Assessment triggers',
  function (this: SpikeWorkflowWorld) {
    assert.match(
      this.bddPlanningGuidance ?? '',
      /production consequences → implementation tasks and Assessment triggers/i,
    );
  },
);

Given(
  /^(validated scenarios|ticket state) has uncommitted changes$/,
  function (this: SpikeWorkflowWorld, state: string) {
    const fixture = createGitRepositoryFixture('safeword-spike-dirty-');
    this.projectDirectory = fixture.projectDirectory;
    this.repositoryDirectory = fixture.repositoryDirectory;

    const { scenarioPath, ticketPath } = writeValidatedState(
      this.repositoryDirectory,
      'Feature: validated behavior\n',
      '---\nphase: scenario-gate\n---\n',
    );
    runGit(this.repositoryDirectory, ['add', '.']);
    runGit(this.repositoryDirectory, ['commit', '-m', 'validated state']);

    const dirtyPath = state === 'validated scenarios' ? scenarioPath : ticketPath;
    writeFileSync(dirtyPath, `${readFileSync(dirtyPath, 'utf8')}uncommitted change\n`);
    this.dirtyValidatedState = state;
    this.initialBranches = runGit(this.repositoryDirectory, [
      'branch',
      '--format=%(refname:short)',
    ]);
    this.initialWorktrees = runGit(this.repositoryDirectory, ['worktree', 'list', '--porcelain']);
    this.spikeSkill = readSpikeSkill();
  },
);

When('the maintainer prepares PRE_SPIKE_BASE', function (this: SpikeWorkflowWorld) {
  assert.ok(this.repositoryDirectory && this.spikeSkill);
  if (this.preSpikeBase && this.spikeWorktree) {
    runGit(this.repositoryDirectory, [
      'worktree',
      'add',
      '-b',
      'spike/committed-state',
      this.spikeWorktree,
      this.preSpikeBase,
    ]);
  }
});

Then('the workflow does not record PRE_SPIKE_BASE', function (this: SpikeWorkflowWorld) {
  assert.match(
    this.spikeSkill ?? '',
    /uncommitted validated scenarios or ticket state[\s\S]*do not record `PRE_SPIKE_BASE`/i,
  );
});

Then('it creates no spike branch or worktree', function (this: SpikeWorkflowWorld) {
  assert.ok(this.repositoryDirectory);
  assert.equal(
    runGit(this.repositoryDirectory, ['branch', '--format=%(refname:short)']),
    this.initialBranches,
  );
  assert.equal(
    runGit(this.repositoryDirectory, ['worktree', 'list', '--porcelain']),
    this.initialWorktrees,
  );
  assert.match(this.spikeSkill ?? '', /do not create a spike branch or\s+worktree/i);
});

Then(
  /^it requires the (validated scenarios|ticket state) changes to be included in a commit$/,
  function (this: SpikeWorkflowWorld, state: string) {
    assert.equal(this.dirtyValidatedState, state);
    assert.match(
      this.spikeSkill ?? '',
      /validated\s+scenario and ticket-state changes[\s\S]*included in (?:one|the same) commit/i,
    );
  },
);

Given(
  'validated scenarios and ticket state are included in one commit',
  function (this: SpikeWorkflowWorld) {
    const fixture = createGitRepositoryFixture('safeword-spike-base-');
    this.projectDirectory = fixture.projectDirectory;
    this.repositoryDirectory = fixture.repositoryDirectory;
    this.spikeWorktree = nodePath.join(this.projectDirectory, 'spike');

    this.validatedScenarioContent = 'Feature: committed validated behavior\n';
    this.ticketStateContent = '---\nphase: scenario-gate\n---\nValidated together.\n';
    writeValidatedState(
      this.repositoryDirectory,
      this.validatedScenarioContent,
      this.ticketStateContent,
    );
    runGit(this.repositoryDirectory, ['add', '.']);
    runGit(this.repositoryDirectory, ['commit', '-m', 'commit validated behavior and ticket']);
    this.preSpikeBase = runGit(this.repositoryDirectory, ['rev-parse', 'HEAD']);
    this.spikeSkill = readSpikeSkill();
  },
);

Then('PRE_SPIKE_BASE identifies that commit', function (this: SpikeWorkflowWorld) {
  assert.ok(this.spikeWorktree && this.preSpikeBase);
  assert.equal(runGit(this.spikeWorktree, ['rev-parse', 'HEAD']), this.preSpikeBase);
});

Then(
  'the spike worktree contains the exact validated scenario and ticket changes',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.spikeWorktree);
    assert.equal(
      readFileSync(nodePath.join(this.spikeWorktree, 'features/example.feature'), 'utf8'),
      this.validatedScenarioContent,
    );
    assert.equal(
      readFileSync(nodePath.join(this.spikeWorktree, '.project/tickets/T/ticket.md'), 'utf8'),
      this.ticketStateContent,
    );
    assert.match(
      this.spikeSkill ?? '',
      /verify the spike worktree[\s\S]*exact validated scenario and ticket-state files/i,
    );
  },
);

Given(/^its experiment charter is missing the (.+)$/, function (this: SpikeWorkflowWorld, field) {
  this.missingCharterField = field;
});

Then('no proof command runs', function (this: SpikeWorkflowWorld) {
  assert.ok(this.spikeSkill);
  assert.match(this.spikeSkill, /If any field is missing[\s\S]*Do not[\s\S]*run a proof command/i);
});

Then(/^the workflow identifies the missing (.+)$/, function (this: SpikeWorkflowWorld, field) {
  assert.equal(this.missingCharterField, field);
  assert.match(this.spikeSkill ?? '', /name (?:the missing field|it)/i);
});

Given(
  'a completed spike branch contains experimental commits and changed files',
  function (this: SpikeWorkflowWorld) {
    const fixture = createGitRepositoryFixture('safeword-spike-git-');
    this.projectDirectory = fixture.projectDirectory;
    this.repositoryDirectory = fixture.repositoryDirectory;
    this.productionWorktree = nodePath.join(this.projectDirectory, 'production');
    const spikeWorktree = nodePath.join(this.projectDirectory, 'spike');
    writeFileSync(nodePath.join(this.repositoryDirectory, 'proof.txt'), 'production base\n');
    runGit(this.repositoryDirectory, ['add', 'proof.txt']);
    runGit(this.repositoryDirectory, ['commit', '-m', 'production base']);
    this.preSpikeBase = runGit(this.repositoryDirectory, ['rev-parse', 'HEAD']);
    runGit(this.repositoryDirectory, [
      'worktree',
      'add',
      '-b',
      'spike/experiment',
      spikeWorktree,
      this.preSpikeBase,
    ]);
    writeFileSync(nodePath.join(spikeWorktree, 'proof.txt'), 'experimental shortcut\n');
    runGit(spikeWorktree, ['add', 'proof.txt']);
    runGit(spikeWorktree, ['commit', '-m', 'experimental result']);
    this.spikeCommit = runGit(spikeWorktree, ['rev-parse', 'HEAD']);
    this.spikeSkill = readSpikeSkill();
  },
);

When(
  'the maintainer opens a fresh production worktree from PRE_SPIKE_BASE',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.repositoryDirectory && this.productionWorktree && this.preSpikeBase);
    runGit(this.repositoryDirectory, [
      'worktree',
      'add',
      '-b',
      'production/planned-implementation',
      this.productionWorktree,
      this.preSpikeBase,
    ]);
  },
);

When(
  'plan-implementation records and commits the spike handoff there',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.productionWorktree);
    const planPath = nodePath.join(this.productionWorktree, '.project/tickets/T/impl-plan.md');
    const ticketPath = nodePath.join(this.productionWorktree, '.project/tickets/T/ticket.md');
    mkdirSync(nodePath.dirname(planPath), { recursive: true });
    writeFileSync(planPath, '# Impl Plan\n\nEvidence: proof passed\n');
    writeFileSync(ticketPath, '---\nphase: plan-implementation\n---\n');
    runGit(this.productionWorktree, ['add', '.project']);
    runGit(this.productionWorktree, ['commit', '-m', 'record reviewed spike plan']);
    this.planCommit = runGit(this.productionWorktree, ['rev-parse', 'HEAD']);
  },
);

When(
  'the plan is reviewed before production implementation begins',
  function (this: SpikeWorkflowWorld) {
    this.planReviewed = true;
  },
);

Then(
  'production implementation begins from the reviewed plan in that same worktree',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.productionWorktree && this.planCommit);
    assert.equal(this.planReviewed, true);
    assert.equal(runGit(this.productionWorktree, ['rev-parse', 'HEAD']), this.planCommit);
    assert.match(
      this.spikeSkill ?? '',
      /create the fresh production worktree[\s\S]*plan-implementation[\s\S]*review[\s\S]*same worktree/i,
    );
  },
);

Then(
  'the production worktree contains committed plan and ticket evidence',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.productionWorktree && this.planCommit);
    assert.equal(
      existsSync(nodePath.join(this.productionWorktree, '.project/tickets/T/impl-plan.md')),
      true,
    );
    assert.equal(
      existsSync(nodePath.join(this.productionWorktree, '.project/tickets/T/ticket.md')),
      true,
    );
    assert.match(
      runGit(this.productionWorktree, ['show', '--name-only', '--format=', this.planCommit]),
      /\.project\/tickets\/T\/impl-plan\.md[\s\S]*\.project\/tickets\/T\/ticket\.md/,
    );
  },
);

Then(
  'production planning starts from the pre-spike production base in that fresh worktree',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.productionWorktree && this.preSpikeBase);
    assert.equal(runGit(this.productionWorktree, ['rev-parse', 'HEAD']), this.preSpikeBase);
    assert.match(
      this.spikeSkill ?? '',
      /fresh production worktree from `PRE_SPIKE_BASE`[\s\S]*plan-implementation/i,
    );
  },
);

Then(
  'its branch history contains no merged or cherry-picked spike commits',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.productionWorktree && this.spikeCommit);
    const ancestry = spawnSync('git', ['merge-base', '--is-ancestor', this.spikeCommit, 'HEAD'], {
      cwd: this.productionWorktree,
    });
    assert.equal(ancestry.status, 1, 'spike commit unexpectedly entered production ancestry');
    assert.match(this.spikeSkill ?? '', /Do not merge[\s\S]*cherry-pick/i);
  },
);

Then('the spike branch remains unmerged', function (this: SpikeWorkflowWorld) {
  assert.ok(this.productionWorktree);
  const merged = runGit(this.productionWorktree, ['branch', '--merged', 'HEAD']);
  assert.doesNotMatch(merged, /spike\/experiment/);
  assert.match(this.spikeSkill ?? '', /spike branch remains\s+unmerged/i);
});

Given('a Codex plugin catalogue without the spike action', function (this: SpikeWorkflowWorld) {
  this.projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-spike-codex-'));
  this.codexPluginDirectory = nodePath.join(this.projectDirectory, 'plugin');
  assert.equal(
    existsSync(nodePath.join(this.codexPluginDirectory, 'skills/spike/SKILL.md')),
    false,
  );
});

When('the maintainer runs the real Codex catalogue generator', function (this: SpikeWorkflowWorld) {
  assert.ok(this.codexPluginDirectory);
  writeCodexPluginCatalogue(
    nodePath.join(REPO_ROOT, 'packages/cli/templates/skills'),
    this.codexPluginDirectory,
    VERSION,
  );
});

Then(
  'the generated Codex artifact exposes a spike action whose contract requires explicit invocation',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.codexPluginDirectory);
    this.codexSpikeSkill = readFileSync(
      nodePath.join(this.codexPluginDirectory, 'skills/spike/SKILL.md'),
      'utf8',
    );
    assert.match(this.codexSpikeSkill, /name: spike/);
    assert.match(this.codexSpikeSkill, /only when explicitly\s+invoked/i);
  },
);

Then(
  'it requires the canonical charter, isolation, and evidence-distillation contract',
  function (this: SpikeWorkflowWorld) {
    const canonical = readSpikeSkill();
    assert.ok(this.codexSpikeSkill);
    for (const heading of ['## Charter', '## Isolation', '## Evidence distillation']) {
      assert.ok(canonical.includes(heading));
      assert.ok(this.codexSpikeSkill.includes(heading));
    }
  },
);

Given(
  "the spike action is available through each host's supported delivery surface",
  function (this: SpikeWorkflowWorld) {
    for (const path of [
      '.claude/skills/spike/SKILL.md',
      '.cursor/commands/spike.md',
      'packages/cli/codex-plugin/skills/spike/SKILL.md',
    ]) {
      assert.equal(existsSync(nodePath.join(REPO_ROOT, path)), true, path);
    }
  },
);

When(
  'each host evaluates workflows eligible for automatic selection',
  function (this: SpikeWorkflowWorld) {
    this.spikeSkill = readSpikeSkill();
    this.codexSpikeSkill = readFileSync(
      nodePath.join(REPO_ROOT, 'packages/cli/codex-plugin/skills/spike/SKILL.md'),
      'utf8',
    );
  },
);

Then(
  'Claude Code excludes spike through manual-only skill metadata',
  function (this: SpikeWorkflowWorld) {
    assert.match(this.spikeSkill ?? '', /disable-model-invocation: true/);
  },
);

Then(
  'the generated Codex description and body instruct the agent to run spike only after an explicit user request',
  function (this: SpikeWorkflowWorld) {
    const codex = this.codexSpikeSkill ?? '';
    const body = codex.replace(/^---[\s\S]*?---\s*/u, '');
    assert.match(codex, /description:[\s\S]*only when explicitly\s+invoked/i);
    assert.match(body, /only after an explicit user request/i);
  },
);

Then(
  'Cursor exposes spike as a command without an automatic rule',
  function (this: SpikeWorkflowWorld) {
    assert.equal(existsSync(nodePath.join(REPO_ROOT, '.cursor/commands/spike.md')), true);
    assert.equal(existsSync(nodePath.join(REPO_ROOT, '.cursor/rules/safeword-spike.mdc')), false);
  },
);

Given('the canonical spike action', function (this: SpikeWorkflowWorld) {
  this.spikeSkill = readSpikeSkill();
});

When('Claude Code evaluates proof-command permissions', function (this: SpikeWorkflowWorld) {
  assert.ok(this.spikeSkill);
});

Then('the action does not blanket-preapprove tools', function (this: SpikeWorkflowWorld) {
  assert.doesNotMatch(this.spikeSkill ?? '', /^allowed-tools:/m);
});

Given('scenario validation has completed', function (this: SpikeWorkflowWorld) {
  this.bddScenariosGuidance = readFileSync(
    nodePath.join(REPO_ROOT, 'packages/cli/templates/skills/bdd/SCENARIOS.md'),
    'utf8',
  );
});

Given('one implementation risk requires executable evidence', function (this: SpikeWorkflowWorld) {
  assert.ok(this.bddScenariosGuidance);
});

When('BDD transitions toward plan-implementation', function (this: SpikeWorkflowWorld) {
  assert.ok(this.bddScenariosGuidance);
});

Then('the spike checkpoint is the next offered action', function (this: SpikeWorkflowWorld) {
  assert.match(
    this.bddScenariosGuidance ?? '',
    /build-only[\s\S]*executable proof[\s\S]*offer[\s\S]*`?\/spike`?/i,
  );
});

Then('plan-implementation has not begun', function (this: SpikeWorkflowWorld) {
  assert.match(
    this.bddScenariosGuidance ?? '',
    /remain in `scenario-gate`[\s\S]*do not set or advance\s+to `plan-implementation`/i,
  );
});

Given('BDD is in {word}', function (this: SpikeWorkflowWorld, phase: string) {
  this.bddPhase = phase;
  this.bddDiscoveryGuidance = readFileSync(
    nodePath.join(REPO_ROOT, 'packages/cli/templates/skills/bdd/DISCOVERY.md'),
    'utf8',
  );
  this.bddScenariosGuidance = readFileSync(
    nodePath.join(REPO_ROOT, 'packages/cli/templates/skills/bdd/SCENARIOS.md'),
    'utf8',
  );
});

Given('scenario validation has not completed', function (this: SpikeWorkflowWorld) {
  assert.ok(this.bddPhase);
});

When('BDD selects the next workflow action', function (this: SpikeWorkflowWorld) {
  assert.ok(this.bddPhase);
});

Then('the spike checkpoint is not offered', function (this: SpikeWorkflowWorld) {
  const guidance = this.bddScenariosGuidance ?? '';
  assert.match(guidance, /run this checkpoint only here, after\s+scenario validation is complete/i);
  assert.match(guidance, /never during intake or define-behavior/i);
});

Then(
  /^BDD (advances to define-behavior|advances to scenario-gate|remains in scenario-gate until validation passes)$/,
  function (this: SpikeWorkflowWorld, transition: string) {
    if (transition === 'advances to define-behavior') {
      assert.match(
        this.bddDiscoveryGuidance ?? '',
        /Update frontmatter:[^\n]*`phase: define-behavior`/i,
      );
      return;
    }
    if (transition === 'advances to scenario-gate') {
      assert.match(
        this.bddScenariosGuidance ?? '',
        /Update frontmatter:[^\n]*`phase: scenario-gate`/i,
      );
      return;
    }
    assert.equal(transition, 'remains in scenario-gate until validation passes');
    assert.match(
      this.bddScenariosGuidance ?? '',
      /until scenario validation is complete,\s+remain in\s+`scenario-gate`/i,
    );
  },
);

Given(
  'behavior is validated and no build-only kill risk remains',
  function (this: SpikeWorkflowWorld) {
    this.bddScenariosGuidance = readFileSync(
      nodePath.join(REPO_ROOT, 'packages/cli/templates/skills/bdd/SCENARIOS.md'),
      'utf8',
    );
  },
);

When('BDD prepares implementation planning', function (this: SpikeWorkflowWorld) {
  assert.ok(this.bddScenariosGuidance);
});

Then('BDD proceeds directly to plan-implementation', function (this: SpikeWorkflowWorld) {
  assert.match(
    this.bddScenariosGuidance ?? '',
    /no eligible risk exists[\s\S]{0,160}without offering `?\/spike`?[\s\S]{0,200}`phase: plan-implementation`/i,
  );
});

Given('a project without Claude or Cursor spike artifacts', function (this: SpikeWorkflowWorld) {
  this.projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-spike-'));
  writeFileSync(
    nodePath.join(this.projectDirectory, 'package.json'),
    JSON.stringify({ name: 'spike-fixture', private: true }, undefined, 2),
  );
  assert.equal(existsSync(nodePath.join(this.projectDirectory, '.claude/skills/spike')), false);
  assert.equal(
    existsSync(nodePath.join(this.projectDirectory, '.cursor/commands/spike.md')),
    false,
  );
});

When(
  'the maintainer runs the real safeword setup CLI entry point',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.projectDirectory);
    const result = spawnSync('bun', [CLI_PATH, 'setup', '--yes', '--agents', 'cursor'], {
      cwd: this.projectDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        SAFEWORD_NO_AUTO_UPGRADE: '1',
        SAFEWORD_SKIP_INSTALL: '1',
        SAFEWORD_TEST_DISABLE_AUTO_UPGRADE: '1',
      },
      timeout: 60_000,
    });
    this.setupResult = {
      status: result.status,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  },
);

Then(
  'the installed Claude Code and Cursor artifacts each expose a manual spike action',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.projectDirectory);
    assert.equal(
      this.setupResult?.status,
      0,
      `${this.setupResult?.stdout ?? ''}\n${this.setupResult?.stderr ?? ''}`,
    );
    assert.equal(
      existsSync(nodePath.join(this.projectDirectory, '.safeword/skills/spike/SKILL.md')),
      true,
      'Claude Code spike skill was not installed',
    );
    assert.equal(
      existsSync(nodePath.join(this.projectDirectory, '.cursor/commands/spike.md')),
      true,
      'Cursor spike command was not installed',
    );
  },
);

Then(
  'both actions require the same charter, isolation, and evidence-distillation contract',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.projectDirectory);
    const claudeSkill = readFileSync(
      nodePath.join(this.projectDirectory, '.safeword/skills/spike/SKILL.md'),
      'utf8',
    );
    const cursorCommand = readFileSync(
      nodePath.join(this.projectDirectory, '.cursor/commands/spike.md'),
      'utf8',
    );

    for (const contract of ['## Charter', '## Isolation', '## Evidence distillation']) {
      assert.ok(claudeSkill.toLowerCase().includes(contract.toLowerCase()), contract);
    }
    assert.ok(cursorCommand.includes('.safeword/skills/spike/SKILL.md'), cursorCommand);
  },
);
