/**
 * TXRHMD (#480): content contract for the plan-implementation phase doc and
 * the surfaces its introduction rewrites. Each assertion maps 1:1 to a
 * doc-contract scenario in features/plan-implementation-phase.feature.
 * Both the shipped template and the dogfood copy must satisfy the contract
 * (pattern: impl-plan.test.ts).
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(__dirname, '../../../..');
const bddCopies = [
  nodePath.join(repoRoot, 'packages/cli/templates/skills/bdd'),
  nodePath.join(repoRoot, '.claude/skills/bdd'),
];

function readCopies(file: string): { path: string; text: string }[] {
  return bddCopies.map(directory => {
    const path = nodePath.join(directory, file);
    return { path, text: readFileSync(path, 'utf8') };
  });
}

describe('PLAN_IMPLEMENTATION.md contract (TXRHMD)', () => {
  it('owns the impl-plan authoring steps with the five design sections (TB1.R3)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toContain('impl-plan.md');
      for (const section of [
        'Approach',
        'Decisions',
        'Arch alignment',
        'Known deviations',
        'Assessment triggers',
      ]) {
        expect(text, path).toContain(section);
      }
    }
  });

  it('directs consulting the architecture record before the alignment section (TB1.R4)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toContain('paths.architecture');
    }
  });

  it('bounds the ADR offer to significant decisions and routine ones to the table (TB1.R4)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/structure, key quality attributes/i);
      expect(text, path).toMatch(/difficult to reverse/i);
      expect(text, path).toMatch(/Decisions table/i);
    }
  });

  it('directs superseding a contradicted ADR rather than deviating silently (TB1.R4)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/supersed/i);
    }
  });

  it('scaffolds ADRs from the template into the configured record location (TB1.R4)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toContain('adr-template.md');
      expect(text, path).toMatch(/date-prefixed/i);
    }
  });

  it('never writes decision records into generated architecture state docs (TB1.R4)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/architecture\.generated\.md|generated architecture state/i);
      expect(text, path).toMatch(/never|not a destination|don't write/i);
    }
  });

  it('directs mid-flight plan updates and ADR supersession before verify (TB1.R4)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/during implement|mid-flight|proven wrong/i);
    }
  });

  it('records per-surface proof coverage from the spec (TB1.R6)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/affected surface/i);
    }
  });

  it('keys plan depth to blast radius in both directions (TB2.R1)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/brief plan is correct|small feature/i);
      expect(text, path).toMatch(/hard-to-reverse|cross-cutting/i);
    }
  });

  it('closes the stored artifact set to plan + ADRs + existing design lanes (TB2.R1)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/design-doc/i);
      expect(text, path).toMatch(/no (new|novel) artifact kinds|novel artifact/i);
    }
  });

  it('bounds each ADR to a lean record (TB2.R2)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/page or two/i);
      expect(text, path).toMatch(/mega/i);
    }
  });

  it('editorial check: deletion test + shorter-scores-no-worse (TB2.R3)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/deleted? without (information )?loss|deletion test/i);
      expect(text, path).toMatch(/shorter plan scores no worse/i);
    }
  });

  it('skip governs applicability, never effort or size (TB2.R3)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/applicability, never effort/i);
      expect(text, path).toMatch(/content-or-skip/i);
    }
  });

  it('directs architecture awareness after the ideal design, reuse-or-change (TB3.R1)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(
        /after (sketching|designing) the ideal|ideal (approach|design) first/i,
      );
      expect(text, path).toMatch(/reuse/i);
      expect(text, path).toMatch(/sunk[- ]cost|changeable with a recorded decision/i);
    }
  });

  it('routes deep design through the existing design lanes (TB3.R2)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toContain('design-doc-template.md');
      expect(text, path).toMatch(/data-architecture-guide/i);
    }
  });

  it('directs a figure-it-out pass for load-bearing choices (TB3.R3)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/figure-it-out/i);
      expect(text, path).toMatch(/load-bearing/i);
    }
  });

  it('surfaces relevant language skills, never the full inventory (TB3.R4)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/language skills?/i);
      expect(text, path).toMatch(/languages? the feature touches|feature's touched/i);
      expect(text, path).toMatch(
        /not the (repository|repo)'s full inventory|never the full inventory/i,
      );
    }
  });

  it('plans selected components against their installed documentation (TB3.R5)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/installed version'?s? documentation/i);
    }
  });

  it('human handoff only after the independent review passes; elicit anytime (NTB2.R1)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/independent review/i);
      expect(text, path).toMatch(/only after|before any human/i);
      expect(text, path).toMatch(/elicit|only the user (has|knows)/i);
    }
  });

  it('designApprovalGate: default autonomous, enabled waits post-review (NTB2.R2)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toContain('designApprovalGate');
      expect(text, path).toMatch(/absent or off|default(s)? (to )?(off|autonomous)/i);
    }
  });

  it('headless sessions record pending approval and surface the plan (NTB2.R3)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).toMatch(/without an interactive user|headless/i);
      expect(text, path).toMatch(/work log/i);
      expect(text, path).toMatch(/reviewable output|PR description|session summary/i);
    }
  });

  it('carries no interactive-only dependencies and defines headless gate behavior (SM1.R4)', () => {
    for (const { path, text } of readCopies('PLAN_IMPLEMENTATION.md')) {
      expect(text, path).not.toMatch(/^!`/m); // no bash auto-expansion lines
      expect(text, path).toMatch(/Cursor Cloud/i); // stop-hook caveat noted
    }
  });
});

describe('surfaces rewritten by the phase introduction (TXRHMD)', () => {
  it('scenario-gate exit no longer directs impl-plan authoring; advance targets plan-implementation (TB1.R3)', () => {
    for (const { path, text } of readCopies('SCENARIOS.md')) {
      expect(text, path).not.toMatch(/Write `?impl-plan\.md`?/);
      expect(text, path).toContain('phase: plan-implementation');
    }
  });

  it('no shipped surface still says "authored at scenario-gate exit" (TB1.R3)', () => {
    // Template tree + dogfood skills + hook sources: the grep scenario.
    const roots = [
      'packages/cli/templates',
      '.claude/skills',
      '.safeword/hooks',
      '.safeword/templates',
      'packages/cli/src',
    ];
    for (const root of roots) {
      const out = execSync(
        `grep -rl "authored at scenario-gate exit" ${root} 2>/dev/null || true`,
        { cwd: repoRoot, encoding: 'utf8' },
      ).trim();
      expect(out, `stale phrase under ${root}: ${out}`).toBe('');
    }
  });

  it('no shipped surface keeps a six-phase adjacency (scenario-gate directly to implement)', () => {
    const roots = [
      'packages/cli/templates',
      '.claude/skills',
      '.agents/skills',
      '.safeword/templates',
    ];
    for (const root of roots) {
      for (const pattern of ['scenario-gate | implement', 'scenario-gate → implement']) {
        const out = execSync(`grep -rlF "${pattern}" ${root} 2>/dev/null || true`, {
          cwd: repoRoot,
          encoding: 'utf8',
        }).trim();
        expect(out, `six-phase adjacency "${pattern}" under ${root}: ${out}`).toBe('');
      }
    }
  });

  it('resume + phase-file tables route plan-implementation to PLAN_IMPLEMENTATION.md (TB1.R2)', () => {
    for (const { path, text } of readCopies('SKILL.md')) {
      expect(text, path).toContain('PLAN_IMPLEMENTATION.md');
      expect(text, path).toMatch(/plan-implementation.*PLAN_IMPLEMENTATION\.md/s);
      expect(text, path).toMatch(
        /intake \| define-behavior \| scenario-gate \| plan-implementation \| implement \| verify \| done/,
      );
    }
  });

  it('splitting checkpoint moves to plan-implementation; children restart there (SM1.R1)', () => {
    for (const { path, text } of readCopies('SPLITTING.md')) {
      expect(text, path).toMatch(/plan-implementation/);
    }
  });

  it('DISCOVERY planning note points at the plan-implementation phase', () => {
    for (const { path, text } of readCopies('DISCOVERY.md')) {
      expect(text, path).not.toContain('happens at the scenario-gate exit');
      expect(text, path).toContain('plan-implementation');
    }
  });

  it('TDD entry names the plan-implementation phase as the plan author', () => {
    for (const { path, text } of readCopies('TDD.md')) {
      expect(text, path).not.toContain('written at scenario-gate exit');
      expect(text, path).toContain('plan-implementation');
    }
  });
});

describe('record + public docs (TXRHMD slices 6-7)', () => {
  it('ARCHITECTURE.md records the superseding ADR and marks the old one superseded (SM1.R3)', () => {
    const text = readFileSync(nodePath.join(repoRoot, 'ARCHITECTURE.md'), 'utf8');
    expect(text).toMatch(/plan-implementation/);
    expect(text).toMatch(/[Ss]uperseded by/);
  });

  it('the website flow enumeration names the planning phase', () => {
    const text = readFileSync(
      nodePath.join(repoRoot, 'packages/website/src/content/docs/reference/hooks-and-skills.mdx'),
      'utf8',
    );
    expect(text).toMatch(/[Pp]lan[- ][Ii]mplementation/);
  });

  it('the config reference documents designApprovalGate defaulting to off (NTB2.R2)', () => {
    const text = readFileSync(
      nodePath.join(repoRoot, 'packages/website/src/content/docs/reference/configuration.mdx'),
      'utf8',
    );
    expect(text).toContain('designApprovalGate');
    expect(text).toMatch(/default.*off|off.*default|autonomous/i);
  });
});
