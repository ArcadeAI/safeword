// Planning inventory only: reads source and Git; never dispatches a reviewer.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const require = createRequire(path.join(root, 'packages/cli/package.json'));
const { AstBuilder, GherkinClassicTokenMatcher, Parser, compile } = require('@cucumber/gherkin');
const { IdGenerator } = require('@cucumber/messages');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const read = relative => readFileSync(path.join(root, relative));
const git = args => execFileSync('git', args, { cwd: root });
const feature = 'features/keep-bounded-planning-reviews-trustworthy.feature';
const proofMap = feature.replace('.feature', '.bdd-proof.json');
const directory = '.project/tickets/T3E4NS-keep-bounded-planning-reviews-trustworthy';
const manifest = JSON.parse(read(proofMap));
const nextId = IdGenerator.incrementing();
const document = new Parser(new AstBuilder(nextId), new GherkinClassicTokenMatcher()).parse(
  read(feature).toString(),
);
const pickles = compile(document, feature, nextId);
const scenarios = document.feature.children
  .flatMap(child => child.rule?.children ?? [child])
  .flatMap(child => child.scenario ?? []);
const ledger = read(`${directory}/test-definitions.md`).toString();
const ledgerNames = [...ledger.matchAll(/^### Scenario: (.+)$/gm)].map(match => match[1]);
assert.deepEqual(
  scenarios.map(item => item.name).toSorted(),
  Object.keys(manifest.scenarios).toSorted(),
);
assert.deepEqual(ledgerNames.toSorted(), Object.keys(manifest.scenarios).toSorted());
assert.equal(scenarios.length, 14);
assert.equal(pickles.length, 37);
assert.equal((ledger.match(/^- \[ \] (?:RED|GREEN|REFACTOR)$/gm) ?? []).length, 42);
assert.equal((ledger.match(/^- \[ \] cross-scenario$/gm) ?? []).length, 1);
assert.equal((ledger.match(/^- \[[xX]\]/gm) ?? []).length, 0);

const blocks = scenarios.map(scenario => {
  const registration = manifest.scenarios[scenario.name];
  const proofs = typeof registration[0] === 'string' ? [registration] : registration;
  const cases = pickles
    .filter(pickle => pickle.astNodeIds.includes(scenario.id))
    .map(pickle => ({
      name: pickle.name,
      // Stable semantic identity; generated pickle IDs are deliberately excluded.
      digest: sha256(
        JSON.stringify({
          name: pickle.name,
          steps: pickle.steps.map(step => ({ text: step.text, argument: step.argument })),
          tags: pickle.tags.map(tag => tag.name),
        }),
      ),
      steps: pickle.steps.map(step => step.text),
    }));
  for (const [file, title] of proofs) {
    assert(read(file).toString().includes(title), `Missing declared proof: ${file}: ${title}`);
  }
  return {
    name: scenario.name,
    line: scenario.location.line,
    cases,
    proofs,
    status: 'mapped-not-certified',
  };
});

const historicalRef = 'd593765c059a5d9ed975fbd1b9d4f1b55222fdca';
const historicalPath = 'packages/cli/src/review/ledger-recovery-cases.json';
const historicalBytes = git(['show', `${historicalRef}:${historicalPath}`]);
const deferrals = JSON.parse(historicalBytes).filter(item => item.deferred);
assert.equal(deferrals.length, 33);
assert.equal(new Set(deferrals.map(item => item.digest)).size, 33);
const owners = Object.fromEntries(
  [...new Set(deferrals.flatMap(item => item.owners))]
    .toSorted()
    .map(owner => [owner, deferrals.filter(item => item.owners.includes(owner)).length]),
);
assert.deepEqual(owners, { DRD65E: 1, FC33HK: 12, KKP2R3: 2, MCWV4B: 18 });
const protectedPaths = [
  'features/keep-plan-reviews-current-and-trustworthy.feature',
  `${directory}/ticket.md`,
  `${directory}/spec.md`,
  `${directory}/test-definitions.md`,
  `${directory}/delivery-state.md`,
  feature,
  proofMap,
  '.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/ticket.md',
  '.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/test-definitions.md',
];
const proofFiles = [
  ...new Set(blocks.flatMap(block => block.proofs.map(([file]) => file))),
].toSorted();
const identities = [...new Set([...protectedPaths, ...proofFiles])].map(file => ({
  path: file,
  sha256: sha256(read(file)),
}));
console.log(
  JSON.stringify(
    {
      kind: 'bounded-recovery-planning-inventory:v1',
      authority: 'research-only; no observation, certification, RED, or completion authority',
      sourceRevision: git(['rev-parse', 'HEAD']).toString().trim(),
      ticket: 'T3E4NS',
      feature,
      totals: {
        scenarioBlocks: 14,
        compiledCases: 37,
        uncheckedRgrEntries: 42,
        uncheckedCrossScenarioEntries: 1,
        deferredHistoricalCases: 33,
      },
      identities,
      blocks,
      historicalDeferrals: {
        source: { revision: historicalRef, path: historicalPath, sha256: sha256(historicalBytes) },
        status: 'deferred-unverified',
        scope: 'historical 5F5ZZA; not T3E4NS active cases',
        owners,
        cases: deferrals,
      },
    },
    null,
    2,
  ),
);
