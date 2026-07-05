/**
 * Acceptance-lane steps for the narrative-drift advisory (ticket BY7RNR,
 * GitHub #848). Black-box: build temp monorepos whose generated `## Packages`
 * disagree with the human narrative (root ARCHITECTURE.md or a configured
 * paths.architecture file/directory), drive the real `safeword architecture`
 * CLI in every mode, and assert the drift advisory is surfaced — capped,
 * /audit-pointing, and never an exit-code change. Reuses the shared
 * `safeword refreshes the architecture doc and captures its output` /
 * `the command succeeds` steps (cucumber registers steps globally).
 */

import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  type ArchitectureWorld,
  CLI_PATH,
  worldDir as dir,
  writeJson,
} from './support/architecture-fixtures.ts';

/** The distinctive prefix every narrative-drift advisory line carries. */
const DRIFT_ADVISORY_MARKER = 'Architecture narrative';

function makeJsMonorepo(world: ArchitectureWorld, packageNames: string[]): void {
  writeJson(nodePath.join(dir(world), 'package.json'), {
    name: 'root',
    workspaces: ['packages/*'],
  });
  for (const name of packageNames) {
    const folder = name.includes('/') ? (name.split('/').at(-1) ?? name) : name;
    writeJson(nodePath.join(dir(world), 'packages', folder, 'package.json'), { name });
    mkdirSync(nodePath.join(dir(world), 'packages', folder, 'src', 'ui'), { recursive: true });
  }
}

function writeNarrative(world: ArchitectureWorld, relativePath: string, mentions: string[]): void {
  const absolute = nodePath.join(dir(world), relativePath);
  mkdirSync(nodePath.dirname(absolute), { recursive: true });
  writeFileSync(
    absolute,
    `# Architecture\n\n${mentions.map(name => `The ${name} package.`).join('\n')}\n`,
  );
}

function writeArchitectureConfig(world: ArchitectureWorld, architecturePath: string): void {
  writeJson(nodePath.join(dir(world), '.safeword', 'config.json'), {
    paths: { architecture: architecturePath },
  });
}

/** Run `safeword architecture [args]`, capturing combined output + exit code. */
function runCapturing(world: ArchitectureWorld, args: string[]): void {
  const result = spawnSync('bun', [CLI_PATH, 'architecture', ...args], {
    cwd: dir(world),
    encoding: 'utf8',
    timeout: 30_000,
  });
  world.status = result.status ?? 1;
  world.output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

// --- Givens ---

Given(
  /^a monorepo with JS packages "([^"]+)" and "([^"]+)"$/,
  function (this: ArchitectureWorld, first: string, second: string) {
    makeJsMonorepo(this, [first, second]);
  },
);

Given(
  /^a monorepo with JS packages "([^"]+)" and "([^"]+)" under git$/,
  function (this: ArchitectureWorld, first: string, second: string) {
    makeJsMonorepo(this, [first, second]);
    const git = (...args: string[]): void => {
      execFileSync('git', args, { cwd: dir(this), stdio: 'ignore' });
    };
    git('init', '-b', 'main');
    git('config', 'user.email', 'bdd@safeword.test');
    git('config', 'user.name', 'BDD');
  },
);

Given(
  /^a monorepo with JS packages "([^"]+)" and "([^"]+)" and no narrative document$/,
  function (this: ArchitectureWorld, first: string, second: string) {
    makeJsMonorepo(this, [first, second]);
  },
);

Given(
  /^a monorepo with the scoped JS package "([^"]+)"$/,
  function (this: ArchitectureWorld, name: string) {
    makeJsMonorepo(this, [name]);
  },
);

Given(
  'a monorepo with 8 JS packages none of which the root ARCHITECTURE.md narrative mentions',
  function (this: ArchitectureWorld) {
    makeJsMonorepo(
      this,
      Array.from({ length: 8 }, (_, index) => `pkg${index + 1}`),
    );
    writeNarrative(this, 'ARCHITECTURE.md', []);
  },
);

Given(
  /^a root ARCHITECTURE\.md narrative that mentions only "([^"]+)"$/,
  function (this: ArchitectureWorld, mentioned: string) {
    writeNarrative(this, 'ARCHITECTURE.md', [mentioned]);
  },
);

Given(
  /^a root ARCHITECTURE\.md narrative that mentions "([^"]+)" and "([^"]+)"$/,
  function (this: ArchitectureWorld, first: string, second: string) {
    writeNarrative(this, 'ARCHITECTURE.md', [first, second]);
  },
);

Given(
  /^a narrative at "([^"]+)" configured via paths\.architecture that mentions only "([^"]+)"$/,
  function (this: ArchitectureWorld, narrativePath: string, mentioned: string) {
    writeNarrative(this, narrativePath, [mentioned]);
    writeArchitectureConfig(this, narrativePath);
  },
);

Given(
  /^a paths\.architecture decision-record directory whose records together mention only "([^"]+)"$/,
  function (this: ArchitectureWorld, mentioned: string) {
    writeNarrative(this, nodePath.join('docs', 'adr', '0001-first.md'), [mentioned]);
    writeNarrative(this, nodePath.join('docs', 'adr', '0002-second.md'), []);
    writeArchitectureConfig(this, 'docs/adr');
  },
);

Given(
  /^a paths\.architecture decision-record directory where one record mentions "([^"]+)" and another mentions "([^"]+)"$/,
  function (this: ArchitectureWorld, first: string, second: string) {
    writeNarrative(this, nodePath.join('docs', 'adr', '0001-first.md'), [first]);
    writeNarrative(this, nodePath.join('docs', 'adr', '0002-second.md'), [second]);
    writeArchitectureConfig(this, 'docs/adr');
  },
);

Given(
  'a single-repo project with source modules and a root ARCHITECTURE.md narrative that mentions none of them',
  function (this: ArchitectureWorld) {
    writeJson(nodePath.join(dir(this), 'package.json'), { name: 'solo' });
    mkdirSync(nodePath.join(dir(this), 'src', 'commands'), { recursive: true });
    mkdirSync(nodePath.join(dir(this), 'src', 'utils'), { recursive: true });
    writeNarrative(this, 'ARCHITECTURE.md', []);
  },
);

Given('the generated architecture docs are current', function (this: ArchitectureWorld) {
  runCapturing(this, []);
  assert.equal(this.status, 0, 'fixture generation run failed');
});

Given('the generated architecture docs are stale', function (this: ArchitectureWorld) {
  runCapturing(this, []);
  assert.equal(this.status, 0, 'fixture generation run failed');
  // A new workspace package moves the shape without regenerating the doc.
  writeJson(nodePath.join(dir(this), 'packages', 'freshly-added', 'package.json'), {
    name: 'freshly-added',
  });
  mkdirSync(nodePath.join(dir(this), 'packages', 'freshly-added', 'src', 'ui'), {
    recursive: true,
  });
});

// --- Whens ---

When(
  'safeword checks architecture staleness and captures its output',
  function (this: ArchitectureWorld) {
    runCapturing(this, ['--check']);
  },
);

When(
  'safeword stages the architecture docs and captures its output',
  function (this: ArchitectureWorld) {
    runCapturing(this, ['--stage']);
  },
);

// --- Thens ---

Then('the command fails', function (this: ArchitectureWorld) {
  assert.notEqual(this.status, 0, 'expected a non-zero exit');
});

Then(
  /^the output advises that the narrative does not mention "([^"]+)"$/,
  function (this: ArchitectureWorld, name: string) {
    const output = this.output ?? '';
    assert.ok(output.includes(DRIFT_ADVISORY_MARKER), 'output carries no drift advisory');
    assert.ok(output.includes(name), `drift advisory does not name ${name}`);
  },
);

Then(
  /^the advisory points at \/audit as the reconciliation path$/,
  function (this: ArchitectureWorld) {
    assert.ok((this.output ?? '').includes('/audit'), 'advisory does not point at /audit');
  },
);

Then('the output carries no narrative drift advisory', function (this: ArchitectureWorld) {
  assert.ok(
    !(this.output ?? '').includes(DRIFT_ADVISORY_MARKER),
    `unexpected drift advisory in: ${this.output ?? ''}`,
  );
});

Then(
  'the drift advisory names exactly 6 packages and reports 2 more',
  function (this: ArchitectureWorld) {
    const line = (this.output ?? '')
      .split('\n')
      .find(candidate => candidate.includes(DRIFT_ADVISORY_MARKER));
    assert.ok(line !== undefined, 'output carries no drift advisory');
    const listing = /: (?<names>.+) — run \/audit/.exec(line)?.groups?.names;
    assert.ok(listing !== undefined, `advisory has no package listing: ${line}`);
    assert.match(listing, / and 2 more$/, `advisory does not report the 2-package tail: ${line}`);
    const named = listing.replace(/ and 2 more$/, '').split(', ');
    assert.equal(named.length, 6, `expected exactly 6 named packages, got ${named.length}`);
  },
);
