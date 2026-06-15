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
        expect(content).toContain('other clients may treat it as Markdown instructions only');
        expect(content).toContain(
          `If no \`[skill-invocation-log] ${skill} ✓\` line appears above, run this fallback before continuing:`,
        );
        expect(content).toContain(
          `bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" ${skill}`,
        );
        expect(content).toContain('Missing CLAUDE_SESSION_ID');
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
