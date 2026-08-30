import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { parseImplPlan } from '../packages/cli/templates/hooks/lib/impl-plan.ts';
import { checkPrincipleTrace } from '../packages/cli/templates/hooks/lib/principle-trace.ts';
import { resolveReviewKnowledgeSources } from '../packages/cli/templates/hooks/lib/project-knowledge.ts';
import { checkHealth } from '../packages/cli/src/health.ts';
import { runParity } from '../packages/cli/src/parity.ts';
import { reconcile } from '../packages/cli/src/reconcile.ts';
import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.ts';
import { defaultConfiguredPath } from '../packages/cli/src/utils/configured-paths.ts';
import {
  reviewEntrypoint,
  type ReviewHost,
  type ReviewStage,
} from '../packages/cli/tests/helpers/review-entrypoints.ts';
import type { SafewordWorld } from './world.ts';

const ROOT = nodePath.resolve(import.meta.dirname, '..');
const TEMPLATES = nodePath.join(ROOT, 'packages/cli/templates');
const RESOLVER = '.safeword/hooks/resolve-project-knowledge.ts';
// Codex's plugin ships no project-local hooks for a skill to invoke, so its
// entry points resolve the same knowledge through the pinned public
// subcommand. The behaviour under test is unchanged — each host still reads
// current configured content at review time — so each host is exercised
// through its own resolver rather than assuming one shared script path.
const CODEX_RESOLVER = 'project review-knowledge';
const CODEX_CLI = nodePath.join(ROOT, 'packages/cli/dist/cli.js');
const KNOWLEDGE_KEYS = ['principles', 'personas', 'surfaces'] as const;
type KnowledgeKey = (typeof KNOWLEDGE_KEYS)[number];

const PROJECT_TYPE = {
  typescript: false,
  react: false,
  nextjs: false,
  astro: false,
  vitest: false,
  playwright: false,
  tailwind: false,
  tanstackQuery: false,
  publishableLibrary: false,
  shell: false,
  hasJsSource: false,
  existingLinter: false,
  existingFormatter: false,
  existingPrettierConfig: false,
  existingEslintConfig: undefined,
  legacyEslint: false,
  existingRuffConfig: undefined,
  existingMypyConfig: false,
  existingImportLinterConfig: false,
  existingGolangciConfig: undefined,
  existingClippyConfig: undefined,
  existingRustfmtConfig: undefined,
  existingSqlfluffConfig: undefined,
  existingCucumberHarness: undefined,
  scaffoldBddLane: true,
};

interface KnowledgeWorld extends SafewordWorld {
  projectDirectory?: string;
  knowledge?: KnowledgeKey;
  beforeBytes?: string;
  reviewInput?: ReturnType<typeof resolveReviewKnowledgeSources>;
  traceFindings?: string[];
  planResult?: ReturnType<typeof parseImplPlan>;
  health?: Awaited<ReturnType<typeof checkHealth>>;
  parity?: ReturnType<typeof runParity>;
  paritySurface?: string;
  docsValid?: boolean;
  evidence?: string;
  plan?: string;
  reviewerDisputesTrace?: boolean;
}

function project(world: KnowledgeWorld): string {
  if (world.projectDirectory !== undefined) return world.projectDirectory;
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-principles-bdd-'));
  world.projectDirectory = directory;
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, 'package.json'),
    JSON.stringify({ name: 'principles-bdd-fixture', version: '1.0.0' }),
  );
  writeConfig(directory, {});
  return directory;
}

function writeConfig(directory: string, paths: Partial<Record<KnowledgeKey, string>>): void {
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword', 'config.json'),
    JSON.stringify({ installedPacks: [], paths }),
  );
}

function configureKnowledgeOverride(world: KnowledgeWorld, key: KnowledgeKey): void {
  const directory = project(world);
  world.knowledge = key;
  writeConfig(directory, { [key]: `knowledge/${key}.md` });
  mkdirSync(nodePath.join(directory, 'knowledge'), { recursive: true });
  writeFileSync(nodePath.join(directory, 'knowledge', `${key}.md`), `# User ${key}\n`);
}

async function install(directory: string): Promise<void> {
  await reconcile(SAFEWORD_SCHEMA, 'install', {
    cwd: directory,
    projectType: PROJECT_TYPE,
    developmentDeps: {},
    productionDeps: {},
    isGitRepo: true,
    languages: { javascript: true, python: false, golang: false, rust: false, sql: false },
  });
}

function defaultPath(directory: string, key: KnowledgeKey): string {
  return defaultConfiguredPath(directory, key);
}

function completePlan(alignmentHeadings: string[]): string {
  return `# Impl Plan\n\n**Status:** planned\n\n## Approach\n\nApproach.\n\n## Decisions\n\nDecision.\n\n${alignmentHeadings
    .map(heading => `## ${heading}\n\nAligned.`)
    .join('\n\n')}\n\n## Known deviations\n\nNone.\n\n## Assessment triggers\n\nReassess later.\n`;
}

function tracePlan(row: string, deviations = 'None.'): string {
  return `# Impl Plan\n\n**Status:** implemented\n\n## Design alignment\n\n| Principle | Consequence | Proof | Conflict |\n| --- | --- | --- | --- |\n${row}\n\n## Known deviations\n\n${deviations}\n`;
}

function entrypointPath(host: string, review: string): string {
  const hostKey = {
    'Claude Code': 'claude',
    Cursor: 'cursor',
    'OpenAI Codex': 'codex',
  }[host] as ReviewHost | undefined;
  assert.ok(hostKey, `unknown review host: ${host}`);
  const entrypoint = reviewEntrypoint(hostKey, review as ReviewStage);
  return entrypoint.host === 'codex'
    ? nodePath.join(ROOT, 'packages/cli/codex-plugin', entrypoint.path)
    : entrypoint.path;
}

function instructionsFor(directory: string, path: string, resolver: string): string {
  const absolute = nodePath.isAbsolute(path) ? path : nodePath.join(directory, path);
  const content = readFileSync(absolute, 'utf8');
  if (content.includes(resolver)) return content;
  const reference = content.match(/@?((?:\.claude|\.safeword)\/skills\/[\w./-]+)/u)?.[1];
  assert.ok(reference, `${path} does not reference a review procedure`);
  return readFileSync(nodePath.join(directory, reference), 'utf8');
}

After(function (this: KnowledgeWorld) {
  if (this.projectDirectory !== undefined) {
    rmSync(this.projectDirectory, { recursive: true, force: true });
  }
});

Given('the ticket makes principles, personas, and surfaces relevant', function () {
  assert.deepEqual(KNOWLEDGE_KEYS, ['principles', 'personas', 'surfaces']);
});

Given('all three sources use configured project paths', async function (this: KnowledgeWorld) {
  const directory = project(this);
  const paths = Object.fromEntries(KNOWLEDGE_KEYS.map(key => [key, `knowledge/${key}.md`]));
  writeConfig(directory, paths);
  mkdirSync(nodePath.join(directory, 'knowledge'), { recursive: true });
  for (const key of KNOWLEDGE_KEYS) {
    writeFileSync(nodePath.join(directory, 'knowledge', `${key}.md`), `# Current ${key}\n`);
  }
  await install(directory);
});

When(
  '{string} launches its installed {string} review entry point',
  function (this: KnowledgeWorld, host: string, review: string) {
    const directory = project(this);
    const entrypoint = entrypointPath(host, review);
    const viaCodexPlugin = host === 'OpenAI Codex';
    const resolver = viaCodexPlugin ? CODEX_RESOLVER : RESOLVER;
    assert.ok(instructionsFor(directory, entrypoint, resolver).includes(resolver));
    const result = viaCodexPlugin
      ? spawnSync('bun', [CODEX_CLI, 'project', 'review-knowledge', '--cwd', directory, '--json'], {
          encoding: 'utf8',
        })
      : spawnSync('bun', [nodePath.join(directory, RESOLVER), directory], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout) as unknown;
    this.reviewInput = (
      viaCodexPlugin ? (parsed as { data: { sources: unknown } }).data.sources : parsed
    ) as ReturnType<typeof resolveReviewKnowledgeSources>;
  },
);

Then(
  'the reviewer receives the resolved current contents of all three sources',
  function (this: KnowledgeWorld) {
    assert.deepEqual(
      this.reviewInput?.map(source => [source.key, source.configured, source.content]),
      KNOWLEDGE_KEYS.map(key => [key, true, `# Current ${key}\n`]),
    );
  },
);

Given(
  'a configured project-knowledge source changed after intake',
  function (this: KnowledgeWorld) {
    const directory = project(this);
    writeConfig(directory, { principles: 'knowledge/principles.md' });
    mkdirSync(nodePath.join(directory, 'knowledge'), { recursive: true });
    writeFileSync(nodePath.join(directory, 'knowledge/principles.md'), '# Intake value\n');
    resolveReviewKnowledgeSources(directory);
    writeFileSync(nodePath.join(directory, 'knowledge/principles.md'), '# Current value\n');
  },
);

When('a later independent review begins', function (this: KnowledgeWorld) {
  this.reviewInput = resolveReviewKnowledgeSources(project(this));
});

Then('its review context contains the current configured content', function (this: KnowledgeWorld) {
  assert.equal(
    this.reviewInput?.find(source => source.key === 'principles')?.content,
    '# Current value\n',
  );
});

Given('an implementation plan contains {string}', function (this: KnowledgeWorld, defect: string) {
  const directory = project(this);
  mkdirSync(nodePath.join(directory, '.project'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.project/principles.md'),
    '## Delight the user\n\n**Intent:** Delight.\n\n**Prefer:** Recovery.\n\n**Avoid:** Dead ends.\n\n**Evidence:** Proof.\n',
  );
  writeFileSync(nodePath.join(directory, 'proof.md'), '# Evidence\n');
  this.plan = {
    'a principle absent from its configured file':
      '| Unknown principle | consequence | proof.md | |',
    'a mapping without consequence or proof': '| Delight the user | | | |',
    'a proof link that does not resolve': '| Delight the user | consequence | missing.md | |',
    'an explicit conflict marker without a matching Known deviations entry':
      '| Delight the user | consequence | proof.md | explicit-conflict |',
  }[defect];
  assert.ok(this.plan, `unknown trace defect: ${defect}`);
});

Given(
  'a principle trace has a source entry, consequence, and resolving proof',
  function (this: KnowledgeWorld) {
    const directory = project(this);
    mkdirSync(nodePath.join(directory, '.project'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.project/principles.md'),
      '## Delight the user\n\n**Intent:** Delight.\n\n**Prefer:** Recovery.\n\n**Avoid:** Dead ends.\n\n**Evidence:** Proof.\n',
    );
    writeFileSync(nodePath.join(directory, 'proof.md'), '# Evidence\n');
    this.plan = '| Delight the user | disputed consequence | proof.md | |';
  },
);

Given(
  'a reviewer disputes whether the consequence was a wise interpretation',
  function (this: KnowledgeWorld) {
    this.reviewerDisputesTrace = true;
  },
);

When('the objective audit runs', function (this: KnowledgeWorld) {
  this.traceFindings = checkPrincipleTrace(project(this), tracePlan(this.plan ?? ''));
});

Then('it reports E010 with {string}', function (this: KnowledgeWorld, detail: string) {
  assert.ok(
    this.traceFindings?.some(finding => finding.includes(`[E010]`) && finding.includes(detail)),
  );
});

Then('it reports no E010 for that disagreement', function (this: KnowledgeWorld) {
  assert.equal(this.reviewerDisputesTrace, true);
  assert.deepEqual(this.traceFindings, []);
});

Given('a configured principle heading is numbered', function (this: KnowledgeWorld) {
  const directory = project(this);
  mkdirSync(nodePath.join(directory, '.project'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.project/principles.md'),
    '## 1. Delight the user\n\n**Intent:** Delight.\n\n**Prefer:** Recovery.\n\n**Avoid:** Dead ends.\n\n**Evidence:** Proof.\n',
  );
  writeFileSync(nodePath.join(directory, 'proof.md'), '# Evidence\n');
});

Given(
  'the implementation plan names that principle without the number',
  function (this: KnowledgeWorld) {
    this.plan = '| Delight the user | concrete consequence | proof.md | |';
  },
);

Then('the principle trace is accepted', function (this: KnowledgeWorld) {
  assert.deepEqual(this.traceFindings, []);
});

Given(
  'the default {string} file is {string}',
  function (this: KnowledgeWorld, knowledge: KnowledgeKey, state: string) {
    const directory = project(this);
    this.knowledge = knowledge;
    if (state === 'customized by the user') {
      mkdirSync(nodePath.dirname(defaultPath(directory, knowledge)), { recursive: true });
      this.beforeBytes = `# User ${knowledge}\n`;
      writeFileSync(defaultPath(directory, knowledge), this.beforeBytes);
    }
  },
);

for (const key of KNOWLEDGE_KEYS) {
  Given(`paths.${key} points to an existing user-owned file`, function (this: KnowledgeWorld) {
    configureKnowledgeOverride(this, key);
  });
  Given(`paths.${key} points to a user-owned file`, function (this: KnowledgeWorld) {
    configureKnowledgeOverride(this, key);
  });
  Given(`paths.${key} points to a missing file`, function (this: KnowledgeWorld) {
    const directory = project(this);
    this.knowledge = key;
    writeConfig(directory, { [key]: `knowledge/missing-${key}.md` });
  });
}

Given(
  'the default {string} file is absent',
  function (this: KnowledgeWorld, knowledge: KnowledgeKey) {
    this.knowledge = knowledge;
    assert.equal(existsSync(defaultPath(project(this), knowledge)), false);
  },
);

Given(
  'the default {string} file also exists',
  function (this: KnowledgeWorld, knowledge: KnowledgeKey) {
    const path = defaultPath(project(this), knowledge);
    mkdirSync(nodePath.dirname(path), { recursive: true });
    writeFileSync(path, `# Orphan ${knowledge}\n`);
    this.beforeBytes = readFileSync(path, 'utf8');
  },
);

Given(
  'the default {string} file contains user-authored content',
  function (this: KnowledgeWorld, knowledge: KnowledgeKey) {
    const path = defaultPath(project(this), knowledge);
    mkdirSync(nodePath.dirname(path), { recursive: true });
    this.beforeBytes = `# Authored ${knowledge}\n`;
    writeFileSync(path, this.beforeBytes);
  },
);

When('Safeword setup reconciles the project', async function (this: KnowledgeWorld) {
  await install(project(this));
});

When('Safeword checks project health', async function (this: KnowledgeWorld) {
  await install(project(this));
  this.health = await checkHealth(project(this), { skipPackageChecks: true });
});

Then('the file is {string}', function (this: KnowledgeWorld, outcome: string) {
  const path = defaultPath(project(this), this.knowledge!);
  assert.equal(existsSync(path), true);
  if (outcome === 'created from its scaffold') assert.match(readFileSync(path, 'utf8'), /^# /u);
  else assert.equal(readFileSync(path, 'utf8'), this.beforeBytes);
});

Then(
  'the default {string} file remains absent',
  function (this: KnowledgeWorld, knowledge: KnowledgeKey) {
    assert.equal(existsSync(defaultPath(project(this), knowledge)), false);
  },
);

Then('it exits successfully without an orphan advisory', function (this: KnowledgeWorld) {
  assert.equal(
    this.health?.issues.some(issue => issue.includes(`${this.knowledge}-path`)),
    false,
  );
  assert.equal(
    this.health?.advisories.some(item => item.includes(`paths.${this.knowledge}`)),
    false,
  );
});

Then(
  'it exits non-zero with a {string} error',
  function (this: KnowledgeWorld, diagnostic: string) {
    assert.ok(this.health?.issues.some(issue => issue.includes(diagnostic)));
  },
);

Then(
  'it exits successfully with an orphan advisory naming both paths',
  function (this: KnowledgeWorld) {
    const advisory = this.health?.advisories.find(item => item.includes(`paths.${this.knowledge}`));
    assert.ok(advisory?.includes(`knowledge/${this.knowledge}.md`));
    assert.ok(advisory?.includes(`.project/${this.knowledge}.md`));
    assert.equal(
      readFileSync(defaultPath(project(this), this.knowledge!), 'utf8'),
      this.beforeBytes,
    );
  },
);

Then('the default file remains byte-identical', function (this: KnowledgeWorld) {
  assert.equal(readFileSync(defaultPath(project(this), this.knowledge!), 'utf8'), this.beforeBytes);
});

Given(
  'an otherwise complete plan uses only {string}',
  function (this: KnowledgeWorld, heading: string) {
    this.plan = completePlan([heading]);
  },
);

Given('an otherwise complete plan has {string}', function (this: KnowledgeWorld, state: string) {
  this.plan = completePlan(
    state === 'both supported alignment headings' ? ['Design alignment', 'Arch alignment'] : [],
  );
});

When('the implementation-plan gate parses it', function (this: KnowledgeWorld) {
  this.planResult = parseImplPlan(this.plan ?? '');
});

Then('the plan is accepted with that section as Design alignment', function (this: KnowledgeWorld) {
  assert.deepEqual(this.planResult?.errors, []);
  assert.equal(this.planResult?.sections['Design alignment']?.satisfied, true);
});

Then('the plan is rejected with {string}', function (this: KnowledgeWorld, remediation: string) {
  const errors = this.planResult?.errors.join('\n') ?? '';
  if (remediation === 'add Design alignment') {
    assert.match(errors, /Missing section heading `## Design alignment`/u);
  } else {
    assert.match(errors, /Both `## Design alignment`[\s\S]*keep exactly one/u);
  }
});

Given(
  'canonical, dogfood Claude, Cursor, and Codex artifacts carry the same knowledge contract',
  function () {
    assert.ok(SAFEWORD_SCHEMA.contracts);
  },
);

Given(
  'the {string} artifact omits a required knowledge behavior',
  function (this: KnowledgeWorld, surface: string) {
    const directory = project(this);
    const templates = nodePath.join(directory, 'templates');
    mkdirSync(templates, { recursive: true });
    this.paritySurface = surface;
    if (surface === 'canonical template') {
      writeFileSync(nodePath.join(directory, 'dogfood.md'), 'required\n');
      this.parity = runParity({
        schema: { ownedFiles: { 'dogfood.md': { template: 'canonical.md' } }, contracts: {} },
        mode: 'all',
        rootDirectory: directory,
        templatesDirectory: templates,
      });
    } else if (surface === 'dogfood Claude') {
      writeFileSync(nodePath.join(templates, 'canonical.md'), 'required\n');
      this.parity = runParity({
        schema: { ownedFiles: { 'dogfood.md': { template: 'canonical.md' } }, contracts: {} },
        mode: 'all',
        rootDirectory: directory,
        templatesDirectory: templates,
      });
    } else {
      const path = surface === 'Cursor' ? '.cursor/review.md' : 'codex-plugin/review.md';
      this.parity = runParity({
        schema: { ownedFiles: {}, contracts: { [path]: { requires: ['current knowledge'] } } },
        mode: 'contracts-only',
        rootDirectory: directory,
        templatesDirectory: templates,
      });
    }
  },
);

When('Safeword checks workflow parity', function (this: KnowledgeWorld) {
  this.parity ??= runParity({
    schema: SAFEWORD_SCHEMA,
    mode: 'all',
    rootDirectory: ROOT,
    templatesDirectory: TEMPLATES,
  });
});

Then('every required parity pair and contract passes', function (this: KnowledgeWorld) {
  assert.deepEqual(this.parity?.failures, []);
  assert.ok((this.parity?.passedCount ?? 0) > 0);
});

Then('parity fails and names {string}', function (this: KnowledgeWorld, surface: string) {
  assert.equal(this.paritySurface, surface);
  const messages = this.parity?.failures.map(failure => failure.message).join('\n') ?? '';
  const token = {
    'canonical template': 'canonical.md',
    'dogfood Claude': 'dogfood.md',
    Cursor: '.cursor/review.md',
    Codex: 'codex-plugin/review.md',
  }[surface];
  assert.ok(token && messages.includes(token), messages);
});

Given(
  'the public configuration guidance is {string}',
  function (this: KnowledgeWorld, state: string) {
    let docs = `${readFileSync(nodePath.join(ROOT, 'README.md'), 'utf8')}\n${readFileSync(
      nodePath.join(ROOT, 'packages/website/src/content/docs/reference/configuration.mdx'),
      'utf8',
    )}`;
    if (state.startsWith('omits paths.')) docs = docs.replaceAll(state.slice('omits '.length), '');
    if (state === 'omits preservation behavior') docs = docs.replaceAll('preserv', 'removed');
    if (state === 'omits orphan behavior') docs = docs.replaceAll('orphan', 'removed');
    this.evidence = docs;
  },
);

When('its project-knowledge contract is checked', function (this: KnowledgeWorld) {
  const docs = this.evidence ?? '';
  this.docsValid =
    KNOWLEDGE_KEYS.every(key => docs.includes(`paths.${key}`)) &&
    /preserv/iu.test(docs) &&
    /orphan/iu.test(docs) &&
    /health|doctor/iu.test(docs);
});

Then('the documentation contract {string}', function (this: KnowledgeWorld, outcome: string) {
  assert.equal(this.docsValid, outcome === 'passes');
});
