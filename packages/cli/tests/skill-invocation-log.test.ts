import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const templatesDirectory = nodePath.join(repoRoot, 'packages/cli/templates');

const verifyCommand = readFileSync(nodePath.join(templatesDirectory, 'commands/verify.md'), 'utf8');
const verifySkill = readFileSync(
  nodePath.join(templatesDirectory, 'skills/verify/SKILL.md'),
  'utf8',
);
const auditCommand = readFileSync(nodePath.join(templatesDirectory, 'commands/audit.md'), 'utf8');
const auditSkill = readFileSync(nodePath.join(templatesDirectory, 'skills/audit/SKILL.md'), 'utf8');
const readme = readFileSync(nodePath.join(repoRoot, 'README.md'), 'utf8');

// Invocation-log surfaces. /verify and /audit each have skill + command form.
const verifyForms: [string, string][] = [
  ['verify-command', verifyCommand],
  ['verify-skill', verifySkill],
];
const auditForms: [string, string][] = [
  ['audit-command', auditCommand],
  ['audit-skill', auditSkill],
];

// Skill forms only — they own the `${CLAUDE_PROJECT_DIR:-…}` fallback that the
// git-root fix (ticket 04HK04) hardens. (Command forms use a bare reference.)
const skillForms: [string, string][] = [
  ['verify-skill', verifySkill],
  ['audit-skill', auditSkill],
];

const selfReviewForms: [string, string][] = [
  [
    'template self-review command',
    readFileSync(nodePath.join(templatesDirectory, 'commands/self-review.md'), 'utf8'),
  ],
  [
    'template self-review skill',
    readFileSync(nodePath.join(templatesDirectory, 'skills/self-review/SKILL.md'), 'utf8'),
  ],
  [
    'dogfood codex self-review skill',
    readFileSync(nodePath.join(repoRoot, '.agents/skills/self-review/SKILL.md'), 'utf8'),
  ],
  [
    'dogfood claude self-review skill',
    readFileSync(nodePath.join(repoRoot, '.claude/skills/self-review/SKILL.md'), 'utf8'),
  ],
  [
    'dogfood cursor self-review command',
    readFileSync(nodePath.join(repoRoot, '.cursor/commands/self-review.md'), 'utf8'),
  ],
];

describe('skill-invocation log: helper invocation in /verify and /audit (147)', () => {
  describe('Rule: Log gets written on skill invocation, scoped to session', () => {
    it.each(verifyForms)(
      '%s calls the reusable invocation helper with the verify token',
      (_name, content) => {
        expect(content).toContain(
          'bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" verify',
        );
      },
    );

    it.each(auditForms)(
      '%s calls the reusable invocation helper with the audit token',
      (_name, content) => {
        expect(content).toContain(
          'bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" audit',
        );
      },
    );

    it.each([...verifyForms, ...auditForms])(
      '%s no longer duplicates namespace-root parsing or log writes inline',
      (_name, content) => {
        expect(content).not.toContain('parsed.paths&&parsed.paths.projectRoot');
        expect(content).not.toContain('directory(".project")');
        expect(content).not.toContain('directory(".safeword-project")');
        expect(content).not.toContain('>> "$NS_ROOT/skill-invocations.log"');
        expect(content).not.toMatch(/mkdir\s{1,4}-p\s{1,4}"\$NS_ROOT"/);
      },
    );

    it.each([...verifyForms, ...auditForms])(
      '%s helper invocation references $CLAUDE_PROJECT_DIR (directly or via PROJECT_DIR fallback)',
      (_name, content) => {
        // Accepts bare ${CLAUDE_PROJECT_DIR} (command forms) or any
        // ${CLAUDE_PROJECT_DIR:-<fallback>} (skill forms).
        expect(content).toMatch(/\$\{CLAUDE_PROJECT_DIR(:-[^}]*)?\}/);
      },
    );

    it.each([
      ...verifyForms.map(([name, content]) => [name, content, 'verify'] as const),
      ...auditForms.map(([name, content]) => [name, content, 'audit'] as const),
    ])(
      '%s documents the fallback when inline shell execution does not run',
      (_name, content, skill) => {
        expect(content).toContain(
          'Claude Code expands the `!` line automatically and substitutes `${CLAUDE_SESSION_ID}` for session binding',
        );
        expect(content).toContain(
          'Codex and Cursor docs do not document Claude-style `!` expansion or `${CLAUDE_SESSION_ID}` substitution',
        );
        expect(content).toContain(
          'Feature tickets must fail closed if no real current-session proof can be logged.',
        );
        expect(content).toContain(
          `Task, patch, and no-ticket ${skill} work may continue after recording that session-scoped proof was unavailable and not required by the gate.`,
        );
        expect(content).toContain(
          `If no \`[skill-invocation-log] ${skill} ✓\` line appears above, run this fallback before continuing:`,
        );
        expect(content).toContain(
          `bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" ${skill} "\${CLAUDE_SESSION_ID}"`,
        );
        expect(content).toContain(
          `bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" ${skill} "\${CLAUDE_SESSION_ID:-}"`,
        );
        expect(content).toContain('no session id');
        expect(content).not.toContain('reports `Missing CLAUDE_SESSION_ID`');
        expect(content).not.toContain('Bash injection runs at render time');
      },
    );
  });

  describe('Rule: skill-form fallback resolves to the project root from a subdir (04HK04)', () => {
    it.each(skillForms)('%s uses the git-root fallback, not bare $(pwd)', (_name, content) => {
      // The harness does not always set CLAUDE_PROJECT_DIR; when unset, a bare
      // $(pwd) fallback wrote the log to a stray <cwd>/.safeword-project. The
      // fix falls back to the git toplevel instead.
      expect(content).toMatch(/CLAUDE_PROJECT_DIR:-\$\(git rev-parse --show-toplevel/);
      expect(content).not.toMatch(/CLAUDE_PROJECT_DIR:-\$\(pwd\)/);
    });

    it('the fallback expression resolves to the git root when run from a subdirectory', () => {
      // Isolated temp git repo — the assertion must not depend on the live
      // repo's git state (a worktree whose core.bare/GIT_WORK_TREE parallel
      // sessions can disrupt mid-run; see pre-commit#2295). Deterministic.
      const repo = mkdtempSync(nodePath.join(tmpdir(), 'tcroot-'));
      execSync('git init -q && git config user.email t@e && git config user.name t', { cwd: repo });
      const subdirectory = nodePath.join(repo, 'packages/cli');
      mkdirSync(subdirectory, { recursive: true });

      // The exact fallback expression with CLAUDE_PROJECT_DIR unset, cwd a
      // subdir. It must resolve to the repo root, not the subdir.
      const resolved = execSync(
        'echo "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"',
        { cwd: subdirectory, env: { ...process.env, CLAUDE_PROJECT_DIR: '' }, encoding: 'utf8' },
      ).trim();
      expect(realpathSync(resolved)).toBe(realpathSync(repo));
    });
  });
});

describe('skill-invocation log: README guidance (HMZSCD)', () => {
  it('does not claim the entire done-gate is inoperable without bash injection', () => {
    expect(readme).not.toContain('the done-gate is currently inoperable');
    expect(readme).toContain('Feature-ticket done gates require this session-scoped proof');
    expect(readme).toContain(
      'Task and patch tickets can still use `verify.md` when session-scoped invocation proof is unavailable and not required by the gate.',
    );
  });

  it('documents the current Bun helper permission instead of stale inline shell fragments', () => {
    expect(readme).toContain(
      '"allow": ["Bash(bun */.safeword/hooks/record-skill-invocation.ts*)"]',
    );
    expect(readme).toContain('record-skill-invocation.ts');
    expect(readme).toContain('Claude Code evaluates compound bash commands per subcommand');
    expect(readme).not.toContain('Bash(node -e:*)');
    expect(readme).not.toContain('Bash(mkdir -p:*)');
    expect(readme).not.toContain('Bash(echo:*)');
  });
});

// /quality-review carries an invocation-log line (W610WW) — the review half of
// the whole-ticket cross-scenario pass, required at done for >=2-loop tickets.
const qualityReviewForms: [string, string][] = [
  [
    'quality-review template skill',
    readFileSync(nodePath.join(templatesDirectory, 'skills/quality-review/SKILL.md'), 'utf8'),
  ],
  [
    'quality-review dogfood claude skill',
    readFileSync(nodePath.join(repoRoot, '.claude/skills/quality-review/SKILL.md'), 'utf8'),
  ],
  [
    'quality-review dogfood agents skill',
    readFileSync(nodePath.join(repoRoot, '.agents/skills/quality-review/SKILL.md'), 'utf8'),
  ],
];

describe('skill-invocation log: /quality-review carries its invocation line (W610WW)', () => {
  it.each(qualityReviewForms)(
    '%s calls the reusable invocation helper with the quality-review token',
    (_name, content) => {
      expect(content).toContain(
        'bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" quality-review',
      );
    },
  );

  it.each(qualityReviewForms)(
    '%s scopes the requirement to tickets with two or more RGR loops',
    (_name, content) => {
      expect(content).toContain('two or more RGR loops');
    },
  );

  it.each(qualityReviewForms)(
    '%s references $CLAUDE_PROJECT_DIR via the PROJECT_DIR fallback',
    (_name, content) => {
      expect(content).toMatch(/\$\{CLAUDE_PROJECT_DIR(:-[^}]*)?\}/);
    },
  );
});

describe('self-review stamp fallback surfaces (K2ZP40)', () => {
  it.each(selfReviewForms)(
    '%s documents a manual write-review-stamp fallback for non-Claude render contexts',
    (_name, content) => {
      expect(content).toContain('If no `[skill-invocation-log]');
      expect(content).toContain('run this fallback before stopping:');
      expect(content).toContain(
        'CLAUDE_PROJECT_DIR="$PROJECT_DIR" bun "$PROJECT_DIR/.safeword/hooks/write-review-stamp.ts" spec',
      );
      expect(content).toContain(
        'The review stamp is content-bound and does not require `CLAUDE_SESSION_ID`.',
      );
      expect(content).not.toContain('no `✓` line at all**: STOP');
    },
  );
});
