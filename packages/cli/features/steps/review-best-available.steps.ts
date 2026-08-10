import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import { generateCodexPluginAssets } from '../../src/codex-plugin/catalogue.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';
import type { SafewordWorld } from './world.js';

type ReviewSurface =
  | 'Claude Code'
  | 'Claude Code Cloud'
  | 'Cursor'
  | 'Cursor Cloud Agents'
  | 'OpenAI Codex'
  | 'OpenAI Codex Cloud';

interface ReviewWiring {
  contract: string;
  entryArtifact: string;
  entryPoint: string;
  surface: ReviewSurface;
}

const wiringByWorld = new WeakMap<SafewordWorld, ReviewWiring>();
const installedPluginFallbackByWorld = new WeakMap<SafewordWorld, string[]>();
const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const repoRoot = nodePath.resolve(packageRoot, '../..');

const artifactsBySurface: Record<ReviewSurface, { contract: string; entryPoint: string }> = {
  'Claude Code': {
    contract: '.claude/skills/finish-review/SKILL.md',
    entryPoint: '.claude/skills/quality-review/SKILL.md',
  },
  'Claude Code Cloud': {
    contract: '.claude/skills/finish-review/SKILL.md',
    entryPoint: '.claude/skills/quality-review/SKILL.md',
  },
  Cursor: {
    contract: '.cursor/commands/finish-review.md',
    entryPoint: '.cursor/rules/safeword-quality-reviewing.mdc',
  },
  'Cursor Cloud Agents': {
    contract: '.cursor/commands/finish-review.md',
    entryPoint: '.cursor/rules/safeword-quality-reviewing.mdc',
  },
  'OpenAI Codex': {
    contract: 'packages/cli/codex-plugin/skills/finish-review/SKILL.md',
    entryPoint: 'packages/cli/codex-plugin/skills/quality-review/SKILL.md',
  },
  'OpenAI Codex Cloud': {
    contract: 'packages/cli/codex-plugin/skills/finish-review/SKILL.md',
    entryPoint: 'packages/cli/codex-plugin/skills/quality-review/SKILL.md',
  },
};

function readPackageFile(relativePath: string): string {
  return readFileSync(nodePath.join(packageRoot, relativePath), 'utf8');
}

function reviewWiring(world: SafewordWorld): ReviewWiring {
  const wiring = wiringByWorld.get(world);
  assert.ok(wiring, 'review wiring must be selected and inspected first');
  return wiring;
}

Given(
  'a project uses the installed Claude plugin without project-local Safeword setup',
  function (this: SafewordWorld) {
    installedPluginFallbackByWorld.set(this, []);
  },
);

When('the installed Claude fallback assets are inspected', function (this: SafewordWorld) {
  installedPluginFallbackByWorld.set(
    this,
    ['plugin/skills/finish-review/SKILL.md', 'plugin/agents/safeword-reviewer.md'].map(path =>
      readFileSync(nodePath.join(repoRoot, path), 'utf8'),
    ),
  );
});

Then(
  'the fallback skill and reviewer load their contract from the installed plugin',
  function (this: SafewordWorld) {
    const assets = installedPluginFallbackByWorld.get(this);
    assert.ok(assets, 'installed plugin fallback assets must be inspected first');
    for (const asset of assets) {
      assert.match(asset, /"\$\{CLAUDE_PLUGIN_ROOT\}"\/skills\/finish-review\/REVIEWER\.md/u);
      assert.doesNotMatch(asset, /\.safeword\/skills\/finish-review\/REVIEWER\.md/u);
    }
  },
);

Given(
  /^the (Claude Code(?: Cloud)?|OpenAI Codex(?: Cloud)?|Cursor(?: Cloud Agents)?) review entry point at "([^"]+)"$/,
  function (this: SafewordWorld, surface: ReviewSurface, entryArtifact: string) {
    assert.equal(entryArtifact, artifactsBySurface[surface].entryPoint);
    wiringByWorld.set(this, { contract: '', entryArtifact, entryPoint: '', surface });
  },
);

When('its shipped fallback wiring is inspected', function (this: SafewordWorld) {
  const wiring = reviewWiring(this);

  const artifacts = artifactsBySurface[wiring.surface];
  wiring.entryPoint = readFileSync(nodePath.join(repoRoot, wiring.entryArtifact), 'utf8');
  wiring.contract = readFileSync(nodePath.join(repoRoot, artifacts.contract), 'utf8');

  if (wiring.surface.startsWith('Cursor')) {
    assert.match(wiring.entryPoint, /@\.safeword\/skills\/quality-review\/SKILL\.md/u);
    assert.match(wiring.contract, /\.safeword\/skills\/finish-review\/SKILL\.md/u);
    wiring.entryPoint = readPackageFile('templates/skills/quality-review/SKILL.md');
    wiring.contract = readPackageFile('templates/skills/finish-review/SKILL.md');
  }
});

Then('it points to the shared finish-review contract', function (this: SafewordWorld) {
  const wiring = reviewWiring(this);
  assert.match(wiring.entryPoint, /(?:\/|\$safeword:)finish-review/u);
  assert.match(wiring.contract, /Finish Review After Route Exhaustion/u);
});

Then(
  'its public entry point and continuation are schema-owned or generated for that host',
  function (this: SafewordWorld) {
    const wiring = reviewWiring(this);
    const contractArtifact = artifactsBySurface[wiring.surface].contract;
    if (wiring.surface.startsWith('OpenAI Codex')) {
      const generated = generateCodexPluginAssets(nodePath.join(packageRoot, 'templates/skills'));
      const generatedPaths = new Set(
        generated.map(asset => `packages/cli/codex-plugin/${asset.relativePath}`),
      );
      assert.ok(generatedPaths.has(wiring.entryArtifact));
      assert.ok(generatedPaths.has(contractArtifact));
      return;
    }

    assert.ok(Object.hasOwn(SAFEWORD_SCHEMA.ownedFiles, wiring.entryArtifact));
    assert.ok(Object.hasOwn(SAFEWORD_SCHEMA.ownedFiles, contractArtifact));
  },
);

Then('it enters that contract only for REVIEW_ROUTES_EXHAUSTED', function (this: SafewordWorld) {
  const wiring = reviewWiring(this);
  assert.match(
    wiring.entryPoint.replaceAll(/\s+/gu, ' '),
    /Only when[^.]{0,240}REVIEW_ROUTES_EXHAUSTED/u,
  );
  assert.match(wiring.contract, /Continue only when.*REVIEW_ROUTES_EXHAUSTED/su);
  assert.match(wiring.contract, /For every other result[\s\S]*return the original/u);
});

Then(
  'it preserves every non-exhaustion coordinator result unchanged',
  function (this: SafewordWorld) {
    const wiring = reviewWiring(this);
    const normalized = `${wiring.entryPoint} ${wiring.contract}`.replaceAll(/\s+/gu, ' ');
    assert.match(normalized, /For every other result[^.]*return the original[^.]*unchanged/iu);
    assert.match(normalized, /Do not delegate or self-review/iu);
  },
);
