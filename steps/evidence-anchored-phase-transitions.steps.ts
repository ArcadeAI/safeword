/**
 * Acceptance steps for evidence-anchored phase transitions (RM84M8, #809).
 *
 * #809 ships a pure detector with no blocking caller (enforcement is #810).
 * The detector is a hook lib whose transitive `.js` imports only resolve under
 * bun, not the cucumber lane's node+tsx loader — so, like phase-provenance.steps.ts,
 * these steps shell out to bun (via `bun -e`) to run the REAL template lib
 * (source of truth) and assert its verdict. The reachability cases pass a
 * resolver kind the runner reconstructs as a stub ShaResolver; the detector
 * never touches git. Mirrors the unit coverage in
 * packages/cli/tests/hooks/phase-anchor.test.ts.
 */

import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

/** A well-formed 7-hex abbreviated SHA. */
const SHA = 'a1b2c3d';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const LIB_URL = pathToFileURL(
  nodePath.join(PROJECT_ROOT, 'packages/cli/templates/hooks/lib/phase-provenance.ts'),
).href;

type ResolverKind = 'none' | 'reachable' | 'unreachable';

interface AnchorVerdict {
  kind: 'not-applicable' | 'anchored' | 'unanchored';
}

interface AnchorWorld extends SafewordWorld {
  priorType?: string | null;
  priorPhase?: string | null;
  resolver?: ResolverKind;
  verdict?: AnchorVerdict;
}

/** Build a ticket.md string; `null` omits the type or phase field entirely. */
function ticketContent(type: string | null, phase: string | null, anchors?: string[]): string {
  const lines = ['---', 'id: ZZTEST', 'slug: fixture'];
  if (type !== null) lines.push(`type: ${type}`);
  if (phase !== null) lines.push(`phase: ${phase}`);
  lines.push('status: in_progress');
  if (anchors !== undefined) {
    lines.push('phase_anchors:');
    for (const entry of anchors) lines.push(`  - ${entry}`);
  }
  lines.push('---', '', '# Fixture', '');
  return lines.join('\n');
}

// Runs the real detector under bun, where the lib's `.js` imports resolve.
// A resolver kind is reconstructed into a stub ShaResolver inside the runner —
// a function can't cross the process boundary, and reachability has only three
// stubbed shapes.
const RUNNER = `
const { detectUnanchoredPhaseTransition } = await import(${JSON.stringify(LIB_URL)});
const { prior, proposed, resolver } = JSON.parse(await new Response(Bun.stdin).text());
const resolve = resolver === 'reachable' ? () => 'f00dcafe'
  : resolver === 'unreachable' ? () => false
  : undefined;
console.log(JSON.stringify(detectUnanchoredPhaseTransition(prior, proposed, resolve)));
`;

function runDetector(prior: string, proposed: string, resolver: ResolverKind): AnchorVerdict {
  const stdout = execFileSync('bun', ['-e', RUNNER], {
    cwd: PROJECT_ROOT,
    input: JSON.stringify({ prior, proposed, resolver }),
    encoding: 'utf8',
  });
  return JSON.parse(stdout.trim()) as AnchorVerdict;
}

function priorContent(world: AnchorWorld): string {
  return ticketContent(world.priorType ?? null, world.priorPhase ?? null);
}

/** Run the detector for a proposed advance and record the verdict. */
function advance(
  world: AnchorWorld,
  options: { type?: string | null; phase: string; anchors?: string[] },
): void {
  const proposedType = options.type === undefined ? (world.priorType ?? null) : options.type;
  const proposed = ticketContent(proposedType, options.phase, options.anchors);
  world.verdict = runDetector(priorContent(world), proposed, world.resolver ?? 'none');
}

// ---------------------------------------------------------------------------
// Givens — prior world state
// ---------------------------------------------------------------------------

Given(
  'a {word} ticket at phase {word}( with no anchors recorded)',
  function (this: AnchorWorld, kind: string, phase: string) {
    this.priorType = kind === 'none' ? null : kind;
    this.priorPhase = phase;
  },
);

Given(
  'a stubbed commit resolver that canonicalizes the anchor to a different commit reachable from HEAD',
  function (this: AnchorWorld) {
    this.resolver = 'reachable';
  },
);

Given(
  'a stubbed commit resolver that reports the anchor as not reachable from HEAD',
  function (this: AnchorWorld) {
    this.resolver = 'unreachable';
  },
);

// ---------------------------------------------------------------------------
// Whens — the proposed advance
// ---------------------------------------------------------------------------

When(
  'it advances to {word} recording a well-formed commit-SHA anchor for {word}',
  function (this: AnchorWorld, phase: string, anchorPhase: string) {
    advance(this, { phase, anchors: [`${anchorPhase}: ${SHA}`] });
  },
);

When(
  'it advances two steps to {word} recording a well-formed anchor for {word} only',
  function (this: AnchorWorld, phase: string, anchorPhase: string) {
    advance(this, { phase, anchors: [`${anchorPhase}: ${SHA}`] });
  },
);

When(
  'it advances to {word} recording that rebased anchor for {word}',
  function (this: AnchorWorld, phase: string, anchorPhase: string) {
    advance(this, { phase, anchors: [`${anchorPhase}: ${SHA}`] });
  },
);

When(
  'it advances to {word} with no phase_anchors block recorded',
  function (this: AnchorWorld, phase: string) {
    advance(this, { phase });
  },
);

When(
  'it advances to {word} with a phase_anchors block naming only {word}',
  function (this: AnchorWorld, phase: string, namedPhase: string) {
    advance(this, { phase, anchors: [`${namedPhase}: ${SHA}`] });
  },
);

When(
  'it advances to {word} recording a non-hex anchor for {word}',
  function (this: AnchorWorld, phase: string, anchorPhase: string) {
    advance(this, { phase, anchors: [`${anchorPhase}: zzzzzzz`] });
  },
);

When(
  'it advances to {word} recording an empty anchor value for {word}',
  function (this: AnchorWorld, phase: string, anchorPhase: string) {
    advance(this, { phase, anchors: [`${anchorPhase}:`] });
  },
);

When(
  'it advances to {word} recording that unreachable anchor for {word}',
  function (this: AnchorWorld, phase: string, anchorPhase: string) {
    advance(this, { phase, anchors: [`${anchorPhase}: ${SHA}`] });
  },
);

When('it moves back to {word} with no anchor', function (this: AnchorWorld, phase: string) {
  advance(this, { phase });
});

When(
  'it is re-saved at phase {word} with no new anchor',
  function (this: AnchorWorld, phase: string) {
    advance(this, { phase });
  },
);

When('it advances to {word} with no anchor', function (this: AnchorWorld, phase: string) {
  advance(this, { phase });
});

When('its type is changed to feature without changing the phase', function (this: AnchorWorld) {
  advance(this, { type: 'feature', phase: this.priorPhase ?? 'implement' });
});

When('its body is edited without changing the phase', function (this: AnchorWorld) {
  const prior = priorContent(this);
  this.verdict = runDetector(prior, `${prior}\nan extra body line\n`, this.resolver ?? 'none');
});

// ---------------------------------------------------------------------------
// Thens — the verdict
// ---------------------------------------------------------------------------

Then('the advance is recognized as anchored', function (this: AnchorWorld) {
  assert.equal(this.verdict?.kind, 'anchored', `expected anchored; got ${this.verdict?.kind}`);
});

Then('the advance is flagged as unanchored', function (this: AnchorWorld) {
  assert.equal(this.verdict?.kind, 'unanchored', `expected unanchored; got ${this.verdict?.kind}`);
});

Then('the advance is not flagged', function (this: AnchorWorld) {
  assert.equal(
    this.verdict?.kind,
    'not-applicable',
    `expected not-applicable; got ${this.verdict?.kind}`,
  );
});
