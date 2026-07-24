import { execSync } from 'node:child_process';
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
const codexPluginSkillContent = readFileSync(
  nodePath.join(repoRoot, 'packages/cli/codex-plugin/skills/verify/SKILL.md'),
  'utf8',
);
const dogfoodCursorCommandContent = readFileSync(
  nodePath.join(repoRoot, '.cursor/commands/verify.md'),
  'utf8',
);

// These template surfaces are the source files shipped to installed projects.
// The command template is a thin pointer to the canonical skill (like audit's,
// ticket C7PXFR) — it carries no verify content of its own, so the content
// contracts below apply to the skill copies only.
const templateFiles: [string, string][] = [['skill', skillContent]];

const allVerifySurfaces: [string, string][] = [
  ['template skill', skillContent],
  ['dogfood agents skill', dogfoodAgentsSkillContent],
  ['dogfood claude skill', dogfoodClaudeSkillContent],
  ['Codex plugin skill', codexPluginSkillContent],
];

describe('verify command pointer (7PG694)', () => {
  it.each([
    ['template command', commandContent],
    ['dogfood cursor command', dogfoodCursorCommandContent],
  ])('%s is a thin pointer to the canonical skill', (_name, content) => {
    expect(content).toContain('Read and follow the instructions in');
    expect(content).toContain('.claude/skills/verify/SKILL.md');
    expect(content.split('\n').length).toBeLessThan(10);
  });
});

describe('verify.md artifact step (7PG694)', () => {
  // The done gate blocks on the verify.md artifact; the skill must keep
  // instructing agents to write it (the missing step was this refactor's
  // top critical — pin it so a future cut can't silently regress).
  it.each(allVerifySurfaces)('%s instructs writing the verify.md artifact', (_name, content) => {
    expect(content).toContain('### 7. Write verify.md');
    expect(content).toContain(
      'The all-green collapse in step 8 applies to the **chat report only**',
    );
  });
});

describe('verify report structure (146)', () => {
  describe('Rule: Status section preserves existing checklist + done-gate evidence patterns', () => {
    it.each(templateFiles)(
      '%s specifies Status section uses existing Verify Checklist',
      (_name, content) => {
        expect(content).toMatch(
          /Status section.*Verify Checklist|Verify Checklist.*Status section/s,
        );
      },
    );

    it.each(templateFiles)('%s lists the required evidence patterns', (_name, content) => {
      expect(content).toContain('✓ X/X tests pass');
      expect(content).toContain('**Gherkin:**');
      expect(content).toContain('All N scenarios marked complete');
      expect(content).toContain('**PR Scope:**');
      expect(content).toContain('Audit passed');
      expect(content).not.toContain('Without all three patterns');
    });
  });

  describe('Rule: Decisions section contains only spec/scope/value questions', () => {
    it.each(templateFiles)(
      '%s names Decisions section "Decisions needed (spec / scope / value)"',
      (_name, content) => {
        expect(content).toMatch(/Decisions needed \(spec \/ scope \/ value\)/);
      },
    );

    it.each(templateFiles)(
      '%s explicitly states implementation-path questions go in Actions, not Decisions',
      (_name, content) => {
        expect(content.toLowerCase()).toMatch(/implementation.*(go|belong).*actions/);
      },
    );

    it.each(templateFiles)(
      '%s specifies Decisions section is hidden when empty (no None placeholder)',
      (_name, content) => {
        expect(content.toLowerCase()).toMatch(/decisions section is hidden when empty/);
      },
    );

    it.each(templateFiles)(
      '%s includes at least one concrete spec-vs-impl borderline example',
      (_name, content) => {
        expect(content.toLowerCase()).toContain('borderline classification example');
        // At least one example must mention "implementation-path"
        expect(content.toLowerCase()).toContain('implementation-path');
      },
    );
  });

  describe('Rule: Actions section commits to concrete forward motion', () => {
    it.each(templateFiles)('%s names Actions section "Agent\'s next actions"', (_name, content) => {
      expect(content).toMatch(/Agent's next actions/);
    });

    it.each(templateFiles)(
      '%s specifies each action must be concrete and falsifiable',
      (_name, content) => {
        expect(content.toLowerCase()).toMatch(/concrete.*falsifiable|falsifiable.*concrete/);
      },
    );

    it.each(templateFiles)(
      '%s specifies Actions section is hidden when empty',
      (_name, content) => {
        expect(content.toLowerCase()).toMatch(/actions.*hidden when empty|hidden.*actions.*empty/);
      },
    );
  });

  describe('Rule: Hard cap N=5 per section; aggregate rest', () => {
    it.each(templateFiles)('%s specifies a hard cap of N=5 items per section', (_name, content) => {
      expect(content).toMatch(/cap of \d+|N=5|max(?:imum)? of 5|hard cap.*5/i);
    });

    it.each(templateFiles)(
      '%s specifies the aggregation format when items exceed cap',
      (_name, content) => {
        expect(content).toMatch(/N others, see test-definitions\.md/);
      },
    );
  });

  describe('Rule: All-green collapse to single-line verdict', () => {
    it.each(templateFiles)(
      '%s specifies single-line "Ready to mark done" when all green and no decisions/actions',
      (_name, content) => {
        // The skill must specify that under all-pass + zero-items, the report
        // collapses to a single-line verdict.
        expect(content.toLowerCase()).toContain('single-line verdict');
        expect(content).toContain('Ready to mark done.');
      },
    );

    it.each(templateFiles)('%s explicitly states empty sections are hidden', (_name, content) => {
      expect(content.toLowerCase()).toContain('empty sections are hidden');
    });
  });

  describe('Rule: PR scope prevents piggybacked changes', () => {
    it.each(templateFiles)('%s includes PR Scope in the Verify Checklist', (_name, content) => {
      expect(content).toContain('**PR Scope:**');
      expect(content).toContain('Diff matches ticket scope');
      expect(content).toContain('Piggybacked changes');
    });

    it.each(templateFiles)('%s blocks all-green collapse when PR scope fails', (_name, content) => {
      expect(content).toMatch(/PR Scope[\s\S]*one purpose/);
      expect(content).toMatch(/PR scope fails[\s\S]*do not collapse/);
      expect(content).toContain('Ready to mark done');
    });

    it.each(templateFiles)(
      '%s routes unrelated work to split, revert, or scope decision',
      (_name, content) => {
        expect(content).toContain('Nice-to-have refactors');
        expect(content).toContain('opportunistic fixes');
        expect(content).toContain('separate tickets/PRs');
        expect(content).toContain('split/revert/follow-up action');
      },
    );
  });

  describe('Rule: section 2 consumes safeword test-plan (5FF0ZD)', () => {
    it.each(templateFiles)('%s evals the test and build plans from test-plan', (_name, content) => {
      // Generation goes through run_plan; the single generator call lives in the
      // helper (#487), keyed by $plan_kind set at each call site (not a `$1`
      // positional, which Claude Code would substitute in a command file).
      expect(content).toContain('test-plan --kind "$plan_kind" --format sh');
      expect(content).toContain('plan_kind=verify');
      expect(content).toContain('plan_kind=build');
      // Typecheck is part of the ready path — CI's lint job runs it (#436).
      expect(content).toContain('plan_kind=typecheck');
      // Dependency-policy gate (cargo deny check) runs for Rust projects.
      expect(content).toContain('plan_kind=deps');
    });

    it.each(templateFiles)(
      '%s carries no inline per-language test/build branch',
      (_name, content) => {
        expect(content).not.toMatch(/uv run pytest|go test|cargo test|go build|cargo build/);
      },
    );
  });

  describe('Rule: local verify classifies environment limits (469)', () => {
    it.each(allVerifySurfaces)('%s preflights temporary git repo creation', (_name, content) => {
      expect(content).toContain('LOCAL_EVIDENCE_LIMITS');
      expect(content).toContain('git init "$GIT_PROBE_DIR"');
      expect(content).toContain('Local evidence limits detected:');
      expect(content).toContain('Temporary git repos');
      expect(content).toContain('.git/hooks/: Operation not permitted');
    });

    it.each(allVerifySurfaces)(
      '%s cleans up the probe without blocked rm -rf syntax',
      (_name, content) => {
        expect(content).toContain('find "$GIT_PROBE_DIR" -depth -delete');
        expect(content).not.toContain('rm -rf "$GIT_PROBE_DIR"');
      },
    );

    it.each(allVerifySurfaces)(
      '%s reports environment limits separately from product failures',
      (_name, content) => {
        expect(content).toContain('Local environment limitation');
        expect(content).toContain('Evidence limits');
        expect(content).toContain('not proof of product failure');
        expect(content).toContain('affected failures are not product evidence');
      },
    );

    it.each(allVerifySurfaces)(
      '%s routes local Cucumber wrapper timeouts to isolated evidence',
      (_name, content) => {
        expect(content).toContain('packages/cli/tests/integration/cucumber-bdd.test.ts');
        expect(content).toContain('bun run --cwd packages/cli test:bdd');
        expect(content).toContain('Cucumber wrapper timed out under full-suite load');
        expect(content).toContain('CI reproduces it');
      },
    );
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
        // #487: generation is captured + exit-checked via run_plan before its
        // output runs, replacing the false-green `bash -c "$(...)"` pattern.
        expect(content).toContain('run_plan()');
        expect(content).toContain('rc=$?');
        expect(content).toMatch(/Evidence generation failed/);
        expect(content).not.toContain('bash -c "$(run_safeword test-plan');
        // #375 word-splitting guard stays: never re-expand $SW via substitution.
        expect(content).not.toContain('$($SW test-plan');
        // #487: no `$1`/`$2` positionals — Claude Code substitutes them with
        // slash-command args in command files (the run_plan kind uses $plan_kind).
        expect(content).not.toContain('$1');
        expect(content).not.toContain('$2');
      },
    );
  });

  describe('Rule: verify fails loudly when plan generation fails (487)', () => {
    // Extract the sentinel-delimited run_plan helper and run it under bash with a
    // stubbed run_safeword — a behavioral check that the generator's exit code is
    // gated before its output runs. String presence alone can't prove that: the
    // bug was `bash -c "$(...)"` discarding the substitution's exit code.
    const helperMatch = /# >>> run_plan[\s\S]*?# <<< run_plan/.exec(skillContent);
    const runPlanHelper = helperMatch?.[0] ?? '';

    function runHelper(
      stub: string,
      call: string,
    ): { code: number; stderr: string; stdout: string } {
      const script = `${stub}\n${runPlanHelper}\n${call}\n`;
      try {
        const stdout = execSync('bash', {
          input: script,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { code: 0, stderr: '', stdout };
      } catch (error) {
        const err = error as { status?: number; stderr?: string; stdout?: string };
        return { code: err.status ?? 1, stderr: err.stderr ?? '', stdout: err.stdout ?? '' };
      }
    }

    it('embeds an extractable run_plan helper', () => {
      expect(runPlanHelper).toContain('run_plan()');
    });

    // AC1 + AC3: a non-zero generator exit must fail loudly for both kinds.
    it.each(['verify', 'build'])('fails loudly when %s plan generation exits non-zero', kind => {
      const { code, stderr } = runHelper(
        'run_safeword() { echo boom >&2; return 3; }',
        `plan_kind=${kind}\nrun_plan`,
      );
      expect(code).not.toBe(0);
      expect(stderr).toContain('Evidence generation failed');
    });

    // The original false-green: generator fails but prints no shell.
    it('reports an empty failed plan as a failure, not a green check', () => {
      const { code } = runHelper('run_safeword() { return 4; }', 'plan_kind=verify\nrun_plan');
      expect(code).not.toBe(0);
    });

    // AC2 (reconciled): a successful empty plan stays a clean no-op.
    it('stays a clean no-op (exit 0) for a successful empty plan', () => {
      const { code } = runHelper('run_safeword() { return 0; }', 'plan_kind=verify\nrun_plan');
      expect(code).toBe(0);
    });

    it('runs the generated plan when generation succeeds', () => {
      const { code, stdout } = runHelper(
        `run_safeword() { printf 'echo RAN_PLAN'; }`,
        'plan_kind=build\nrun_plan',
      );
      expect(code).toBe(0);
      expect(stdout).toContain('RAN_PLAN');
    });
  });
});
