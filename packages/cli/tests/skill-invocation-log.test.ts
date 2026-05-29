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

// Bash-injection log surfaces. /verify and /audit each have skill + command form.
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

describe('skill-invocation log: bash injection in /verify and /audit (147)', () => {
  describe('Rule: Log gets written on skill invocation, scoped to session', () => {
    it.each(verifyForms)(
      '%s contains bash injection with CLAUDE_SESSION_ID and verify token',
      (_name, content) => {
        // Looking for the inline bash injection block — pattern starts with `!` then backtick or fenced
        expect(content).toMatch(/\$\{CLAUDE_SESSION_ID\}/);
        expect(content).toMatch(/skill-invocations\.log/);
        expect(content).toMatch(/\bverify\b/);
      },
    );

    it.each(auditForms)(
      '%s contains bash injection with CLAUDE_SESSION_ID and audit token',
      (_name, content) => {
        expect(content).toMatch(/\$\{CLAUDE_SESSION_ID\}/);
        expect(content).toMatch(/skill-invocations\.log/);
        expect(content).toMatch(/\baudit\b/);
      },
    );

    it.each([...verifyForms, ...auditForms])(
      '%s bash injection uses append (>>), not overwrite (>)',
      (_name, content) => {
        // The injection must use `>>` to preserve prior entries.
        // Accepts ${CLAUDE_PROJECT_DIR}/ (older form) or $PROJECT_DIR/ (after PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}" indirection).
        expect(content).toMatch(
          />>\s{0,4}"\$\{?(?:CLAUDE_)?PROJECT_DIR\}?\/\.safeword-project\/skill-invocations\.log/,
        );
      },
    );

    it.each([...verifyForms, ...auditForms])(
      '%s bash injection ensures .safeword-project/ directory exists (mkdir -p)',
      (_name, content) => {
        expect(content).toMatch(
          /mkdir\s{1,4}-p\s{1,4}"\$\{?(?:CLAUDE_)?PROJECT_DIR\}?\/\.safeword-project/,
        );
      },
    );

    it.each([...verifyForms, ...auditForms])(
      '%s bash injection references $CLAUDE_PROJECT_DIR (directly or via PROJECT_DIR fallback)',
      (_name, content) => {
        // Accepts bare ${CLAUDE_PROJECT_DIR} (command forms) or any
        // ${CLAUDE_PROJECT_DIR:-<fallback>} (skill forms).
        expect(content).toMatch(/\$\{CLAUDE_PROJECT_DIR(:-[^}]*)?\}/);
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
