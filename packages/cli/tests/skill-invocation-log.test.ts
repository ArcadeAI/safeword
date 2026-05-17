import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

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
          />>\s*"\$(\{?CLAUDE_)?PROJECT_DIR\}?\/\.safeword-project\/skill-invocations\.log/,
        );
      },
    );

    it.each([...verifyForms, ...auditForms])(
      '%s bash injection ensures .safeword-project/ directory exists (mkdir -p)',
      (_name, content) => {
        expect(content).toMatch(/mkdir\s+-p\s+"\$(\{?CLAUDE_)?PROJECT_DIR\}?\/\.safeword-project/);
      },
    );

    it.each([...verifyForms, ...auditForms])(
      '%s bash injection references $CLAUDE_PROJECT_DIR (directly or via PROJECT_DIR fallback)',
      (_name, content) => {
        // Accepts bare ${CLAUDE_PROJECT_DIR} or the defensive ${CLAUDE_PROJECT_DIR:-$(pwd)} fallback.
        expect(content).toMatch(/\$\{CLAUDE_PROJECT_DIR(:-\$\(pwd\))?\}/);
      },
    );
  });
});
