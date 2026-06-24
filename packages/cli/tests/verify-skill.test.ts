import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const templatesDirectory = nodePath.join(repoRoot, 'packages/cli/templates');

const skillContent = readFileSync(
  nodePath.join(templatesDirectory, 'skills/verify/SKILL.md'),
  'utf8',
);
const commandContent = readFileSync(
  nodePath.join(templatesDirectory, 'commands/verify.md'),
  'utf8',
);
const dogfoodAgentsSkillContent = readFileSync(
  nodePath.join(repoRoot, '.agents/skills/verify/SKILL.md'),
  'utf8',
);
const dogfoodClaudeSkillContent = readFileSync(
  nodePath.join(repoRoot, '.claude/skills/verify/SKILL.md'),
  'utf8',
);
const dogfoodCursorCommandContent = readFileSync(
  nodePath.join(repoRoot, '.cursor/commands/verify.md'),
  'utf8',
);

// Both surfaces share the same instructions; tests run against both.
const surfaces: [string, string][] = [
  ['skill', skillContent],
  ['command', commandContent],
];

const allVerifySurfaces: [string, string][] = [
  ['template skill', skillContent],
  ['template command', commandContent],
  ['dogfood agents skill', dogfoodAgentsSkillContent],
  ['dogfood claude skill', dogfoodClaudeSkillContent],
  ['dogfood cursor command', dogfoodCursorCommandContent],
];

describe('verify report structure (146)', () => {
  describe('Rule: Status section preserves existing checklist + done-gate evidence patterns', () => {
    it.each(surfaces)(
      '%s specifies Status section uses existing Verify Checklist',
      (_name, content) => {
        expect(content).toMatch(
          /Status section.*Verify Checklist|Verify Checklist.*Status section/s,
        );
      },
    );

    it.each(surfaces)('%s lists the required evidence patterns', (_name, content) => {
      expect(content).toContain('✓ X/X tests pass');
      expect(content).toContain('**Gherkin:**');
      expect(content).toContain('All N scenarios marked complete');
      expect(content).toContain('Audit passed');
      expect(content).not.toContain('Without all three patterns');
    });
  });

  describe('Rule: Decisions section contains only spec/scope/value questions', () => {
    it.each(surfaces)(
      '%s names Decisions section "Decisions needed (spec / scope / value)"',
      (_name, content) => {
        expect(content).toMatch(/Decisions needed \(spec \/ scope \/ value\)/);
      },
    );

    it.each(surfaces)(
      '%s explicitly states implementation-path questions go in Actions, not Decisions',
      (_name, content) => {
        expect(content.toLowerCase()).toMatch(/implementation.*(go|belong).*actions/);
      },
    );

    it.each(surfaces)(
      '%s specifies Decisions section is hidden when empty (no None placeholder)',
      (_name, content) => {
        expect(content.toLowerCase()).toMatch(/decisions section is hidden when empty/);
      },
    );

    it.each(surfaces)(
      '%s includes at least one concrete spec-vs-impl borderline example',
      (_name, content) => {
        expect(content.toLowerCase()).toContain('borderline classification example');
        // At least one example must mention "implementation-path"
        expect(content.toLowerCase()).toContain('implementation-path');
      },
    );
  });

  describe('Rule: Actions section commits to concrete forward motion', () => {
    it.each(surfaces)('%s names Actions section "Agent\'s next actions"', (_name, content) => {
      expect(content).toMatch(/Agent's next actions/);
    });

    it.each(surfaces)(
      '%s specifies each action must be concrete and falsifiable',
      (_name, content) => {
        expect(content.toLowerCase()).toMatch(/concrete.*falsifiable|falsifiable.*concrete/);
      },
    );

    it.each(surfaces)('%s specifies Actions section is hidden when empty', (_name, content) => {
      expect(content.toLowerCase()).toMatch(/actions.*hidden when empty|hidden.*actions.*empty/);
    });
  });

  describe('Rule: Hard cap N=5 per section; aggregate rest', () => {
    it.each(surfaces)('%s specifies a hard cap of N=5 items per section', (_name, content) => {
      expect(content).toMatch(/cap of \d+|N=5|max(?:imum)? of 5|hard cap.*5/i);
    });

    it.each(surfaces)(
      '%s specifies the aggregation format when items exceed cap',
      (_name, content) => {
        expect(content).toMatch(/N others, see test-definitions\.md/);
      },
    );
  });

  describe('Rule: All-green collapse to single-line verdict', () => {
    it.each(surfaces)(
      '%s specifies single-line "Ready to mark done" when all green and no decisions/actions',
      (_name, content) => {
        // The skill must specify that under all-pass + zero-items, the report
        // collapses to a single-line verdict.
        expect(content.toLowerCase()).toContain('single-line verdict');
        expect(content).toContain('Ready to mark done.');
      },
    );

    it.each(surfaces)('%s explicitly states empty sections are hidden', (_name, content) => {
      expect(content.toLowerCase()).toContain('empty sections are hidden');
    });
  });

  describe('Rule: section 2 consumes safeword test-plan (5FF0ZD)', () => {
    it.each(surfaces)('%s evals the test and build plans from test-plan', (_name, content) => {
      expect(content).toContain('test-plan --kind verify --format sh');
      expect(content).toContain('test-plan --kind build --format sh');
    });

    it.each(surfaces)('%s carries no inline per-language test/build branch', (_name, content) => {
      expect(content).not.toMatch(/uv run pytest|go test|cargo test|go build|cargo build/);
    });
  });

  describe('Rule: verify resolver selects only a test-plan-capable Safeword CLI (375)', () => {
    it.each(allVerifySurfaces)('%s probes node_modules before selecting it', (_name, content) => {
      expect(content).toContain('supports_test_plan()');
      expect(content).toContain('CANDIDATE="node_modules/.bin/safeword"');
      expect(content).toContain('[ -x node_modules/.bin/safeword ] && supports_test_plan');
      expect(content).not.toMatch(
        /if \[ -x node_modules\/\.bin\/safeword \]; then\s+SW="node_modules\/\.bin\/safeword"/,
      );
    });

    it.each(allVerifySurfaces)('%s falls back to the source CLI before bunx', (_name, content) => {
      const sourceProbe = 'CANDIDATE="bun packages/cli/src/cli.ts"';
      const bunxProbe = 'CANDIDATE="bunx safeword"';

      expect(content).toContain(sourceProbe);
      expect(content.indexOf(sourceProbe)).toBeGreaterThan(-1);
      expect(content.indexOf(bunxProbe)).toBeGreaterThan(content.indexOf(sourceProbe));
      expect(content).toContain('SW="bun packages/cli/src/cli.ts"');
    });

    it.each(allVerifySurfaces)(
      '%s fails clearly when no candidate supports test-plan',
      (_name, content) => {
        expect(content).toContain('No test-plan-capable safeword CLI found');
        expect(content).toContain(
          'Tried node_modules/.bin/safeword, packages/cli/src/cli.ts, and bunx safeword.',
        );
        expect(content).toMatch(/exit 1/);
      },
    );

    it.each(allVerifySurfaces)(
      '%s executes test-plan through dispatch instead of shell word splitting',
      (_name, content) => {
        expect(content).toContain('run_safeword()');
        expect(content).toContain('bash -c "$(run_safeword test-plan --kind verify --format sh)"');
        expect(content).toContain('bash -c "$(run_safeword test-plan --kind build --format sh)"');
        expect(content).not.toContain('$($SW test-plan');
        expect(content).not.toContain('$1');
      },
    );
  });
});
