import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

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
  entryPoint: string;
  surface: ReviewSurface;
}

const wiringByWorld = new WeakMap<SafewordWorld, ReviewWiring>();
const packageRoot = nodePath.resolve(import.meta.dirname, '../..');

function readPackageFile(relativePath: string): string {
  return readFileSync(nodePath.join(packageRoot, relativePath), 'utf8');
}

Given(
  /^the (Claude Code(?: Cloud)?|OpenAI Codex(?: Cloud)?|Cursor(?: Cloud Agents)?) review entry point$/,
  function (this: SafewordWorld, surface: ReviewSurface) {
    wiringByWorld.set(this, { contract: '', entryPoint: '', surface });
  },
);

When('its shipped fallback wiring is inspected', function (this: SafewordWorld) {
  const wiring = wiringByWorld.get(this);
  assert.ok(wiring, 'review surface must be selected first');

  if (wiring.surface.startsWith('Claude Code')) {
    assert.equal(
      SAFEWORD_SCHEMA.ownedFiles['.claude/skills/quality-review/SKILL.md']?.template,
      'skills/quality-review/SKILL.md',
    );
    assert.equal(
      SAFEWORD_SCHEMA.ownedFiles['.claude/skills/finish-review/SKILL.md']?.template,
      'skills/finish-review/SKILL.md',
    );
    wiring.entryPoint = readPackageFile('templates/skills/quality-review/SKILL.md');
    wiring.contract = readPackageFile('templates/skills/finish-review/SKILL.md');
    return;
  }

  if (wiring.surface.startsWith('OpenAI Codex')) {
    wiring.entryPoint = readPackageFile('codex-plugin/skills/quality-review/SKILL.md');
    wiring.contract = readPackageFile('codex-plugin/skills/finish-review/SKILL.md');
    return;
  }

  const cursorEntryPoint = readPackageFile('templates/cursor/rules/safeword-quality-reviewing.mdc');
  const cursorContract = readPackageFile('templates/cursor/rules/safeword-finish-review.mdc');
  assert.match(cursorEntryPoint, /@\.safeword\/skills\/quality-review\/SKILL\.md/u);
  assert.match(cursorContract, /@\.safeword\/skills\/finish-review\/SKILL\.md/u);
  wiring.entryPoint = readPackageFile('templates/skills/quality-review/SKILL.md');
  wiring.contract = readPackageFile('templates/skills/finish-review/SKILL.md');
});

Then('it points to the shared finish-review contract', function (this: SafewordWorld) {
  const wiring = wiringByWorld.get(this);
  assert.ok(wiring, 'review wiring must be inspected first');
  assert.match(wiring.entryPoint, /(?:\/|\$safeword:)finish-review/u);
  assert.match(wiring.contract, /Finish Review After Route Exhaustion/u);
});

Then('it enters that contract only for REVIEW_ROUTES_EXHAUSTED', function (this: SafewordWorld) {
  const wiring = wiringByWorld.get(this);
  assert.ok(wiring, 'review wiring must be inspected first');
  assert.match(
    wiring.entryPoint.replaceAll(/\s+/gu, ' '),
    /Only when[^.]{0,240}REVIEW_ROUTES_EXHAUSTED/u,
  );
  assert.match(wiring.contract, /Continue only when.*REVIEW_ROUTES_EXHAUSTED/su);
  assert.match(wiring.contract, /For every other result[\s\S]*return the original/u);
});
