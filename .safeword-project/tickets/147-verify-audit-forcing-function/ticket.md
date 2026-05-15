---
id: 147
type: feature
phase: intake
status: in_progress
related: [143, 146]
created: 2026-05-15T15:30:00Z
last_modified: 2026-05-15T15:55:00Z
scope: |
  Build a **general phase-gate infrastructure** for skill-invocation
  forcing functions. v1 enforces only /verify and /audit at the done
  phase; the infrastructure supports adding more gates as failure modes
  are empirically observed in other skills (/bdd, /tdd-review, /refactor,
  /quality-review, /debug).

  Three pieces:

  (1) **Log mechanism (general)**: skills that should be enforceable get
      a bash-injection line that appends a session-scoped entry to
      `.safeword/skill-invocations.log`. Format per line:
      `<ISO-timestamp> <session-id> <skill-name>`. v1 instruments /verify
      and /audit; future tickets can instrument others with a single-line
      change to the skill file.

  (2) **Phase-gate config (general)**: a config map in `stop-quality.ts`
      declares which skill invocations are required at which phase
      transitions. v1 config:
      ```ts
      const PHASE_GATES: Record<string, string[]> = {
        done: ['verify', 'audit'],
      };
      ```
      Future gates added by extending this map (no infra changes).

  (3) **Gate check (general)**: when a feature ticket enters the gated
      phase, the hook reads the log, validates required skills have
      current-session entries, hard-blocks with skill-specific message if
      any are missing. Single check function handles all gates.

  The log file lives in `.safeword/skill-invocations.log`, is registered
  in SAFEWORD_SCHEMA.preservedDirs (session state, not git-committed).
out_of_scope: |
  - Rewriting transcript parsing in stop-quality.ts (separate concern, ticket 037).
  - Migrating to agent-based hooks (separate concern, also 037).
  - Replacing the log mechanism with skill-scoped Stop hooks (semantics unclear
    in current docs; deferred until clearer guidance).
  - Adding markers or signatures to verify.md / audit.md (spoofable; the log
    is the load-bearing artifact).
  - Auto-rotation of the log file (not needed at v1 scale).
  - **Instrumenting /bdd, /tdd-review, /refactor, /quality-review, /debug** —
    these skills exhibit the same agent-shortcutting pattern but v1 only
    enforces verify+audit. The infrastructure is built to extend; specific
    enforcement is config-only additions in follow-up tickets.
  - **Phase-gates beyond done** (e.g., entering implement requires /bdd) —
    same reasoning: infrastructure supports it; v1 config keeps gates minimal.
done_when: |
  - `.safeword/skill-invocations.log` is created on first invocation in a
    fresh session; subsequent invocations append.
  - /verify and /audit skill content (canonical templates and runtime copies)
    each contain the bash-injection line using `${CLAUDE_SESSION_ID}`.
  - `stop-quality.ts` has a `PHASE_GATES` config map and a generic check
    function that consults it.
  - When a feature ticket enters `phase: done` (transition detected via
    quality-state.ts's `lastKnownPhase`), the gate check fires.
  - When /verify is skipped, hard-block with: "No /verify invocation
    recorded in this session. Run /verify first."
  - When /audit is skipped, hard-block with: "No /audit invocation
    recorded in this session. Run /audit first."
  - When both are present, existing verify.md presence check still gates
    (log doesn't replace verify.md; both required).
  - test-definitions.md scenarios cover: log creation, log append,
    skipped-skill block (both /verify and /audit branches), both-present
    pass, log corruption handled gracefully, phase-transition detection
    (re-entering done doesn't re-block when already done).
  - Log file registered in SAFEWORD_SCHEMA so install/reset behaves correctly.
  - /verify and /audit skill parity preserved across all four surfaces
    (144's parity check still passes).
  - Memory entry written capturing the discipline lesson (DONE — written
    alongside this ticket's creation).
  - All scenarios marked complete; /verify passes; /audit passes.
adding_new_gates: |
  Documentation of how to add future gates (consumed by follow-up tickets):

  1. Add bash-injection line to the target skill's content using
     `${CLAUDE_SESSION_ID}` and the skill's name.
  2. Add the phase → required-skills entry to PHASE_GATES in stop-quality.ts.
  3. Write a unit test exercising the new gate's skipped-skill branch.

  No infrastructure changes needed.
---

# Skill-invocation phase-gate infrastructure (v1: /verify + /audit at done)

**Goal:** Build a general phase-gate infrastructure so that when a ticket enters a gated phase, the agent must have invoked the required skills in the current session. v1 enforces /verify and /audit at the done phase; future gates added by config.

**Why:** This session's debrief surfaced the exact failure mode the gate prevents. When asked "did we verify and audit our work?" the honest answer was "partially." I shortcut /verify and /audit invocations across 143's iterations and 146 entirely, substituting targeted vitest runs and hand-written verify.md. The user then asked: _does this problem persist beyond /verify?_ I looked — yes. Seven skills exhibit the same shortcuts in this session alone: /verify, /audit, /tdd-review, /quality-review, /refactor, /debug, /bdd.

**Why a general infrastructure (not just verify+audit fix):** the failure mode isn't /verify-specific — it's a skills-in-general pattern. Building the gate as one-off code for verify+audit would force a rebuild when we extend to /bdd or /tdd-review. Building it as config-driven infrastructure costs marginal extra work now and ~zero future work to extend.

**Why config + log (not other mechanisms):** evaluated marker-text, skill-scoped Stop hooks, transcript grep, agent-based hooks, frontmatter markers. Bash-injection log is the only one that's tamper-resistant (bash runs on invocation, not on agent typing), forward-compatible (independent of transcript format that ticket 037 wants to deprecate), and works with current Claude Code primitives.

## Adjacent tickets

- **143** (done) — universal binary terminal stop-hook prompt. Surfaced the failure mode mid-session debrief.
- **146** (done) — /verify three-section output. Applied 143's contract to /verify but didn't fix invocation-skipping.
- **037** (planning) — replace transcript parsing in stop-quality.ts with agent-based hooks. 147's approach is forward-compatible (the log is independent of transcript format).

## v1 scope and future v2+ gates

**v1 enforces (this ticket):**

| Phase  | Required skills   | Rationale                                                                                                                      |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `done` | `verify`, `audit` | Strongest empirical evidence from this session; clear "done-gate" semantics; existing verify.md presence check pairs naturally |

**v2+ candidates (follow-up tickets, not this ticket):**

| Phase / event                              | Candidate required skills          | Rationale                                        |
| ------------------------------------------ | ---------------------------------- | ------------------------------------------------ |
| `implement` (entry from decomposition)     | `bdd` (at feature start)           | Feature work bypasses BDD if /bdd wasn't invoked |
| TDD-step transitions                       | `tdd-review` (after each step)     | Test quality checks routinely shortcut           |
| `verify` (entry)                           | `verify` (separate from done gate) | Forces verify invocation at phase entry          |
| Refactor commits (heuristic)               | `refactor`                         | "One change → test → commit" iron law shortcut   |
| Claims invoking "research" / "latest docs" | `quality-review`                   | Citation theater catch                           |
| Debugging sessions                         | `debug`                            | Investigate-first discipline shortcut            |

v1 ships only the done gate; v2+ adds gates incrementally as empirical evidence justifies each.

## Design notes

**Bash injection line** (added to /verify and /audit skill content):

```
!`mkdir -p .safeword && echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ${CLAUDE_SESSION_ID} <skill-name>" >> .safeword/skill-invocations.log`
```

Substitute `<skill-name>` with `verify` for /verify, `audit` for /audit. Each new gate adds the same line to its skill with its own name.

**Gate check** (in stop-quality.ts):

```ts
const PHASE_GATES: Record<string, string[]> = {
  done: ['verify', 'audit'],
};

function getRequiredSkillsForPhase(phase: string): string[] {
  return PHASE_GATES[phase] ?? [];
}

function checkSkillInvocations(
  sessionId: string,
  required: string[],
): { ok: boolean; missing: string[] } {
  const logPath = nodePath.join(projectDir, '.safeword/skill-invocations.log');
  if (!existsSync(logPath)) return { ok: false, missing: required };
  const lines = readFileSync(logPath, 'utf8').split('\n');
  const sessionLines = lines.filter(l => l.includes(sessionId));
  const invoked = new Set(
    sessionLines.map(l => l.split(' ').pop()).filter((s): s is string => !!s),
  );
  const missing = required.filter(s => !invoked.has(s));
  return { ok: missing.length === 0, missing };
}
```

Wired into done-phase hard-block path alongside existing verify.md presence check.

## Open Questions (resolve in define-behavior)

- **Patch and task tickets — gated or not?** Currently done-gate only applies to features. v1 lean: only features (matches existing behavior; consistent with verify.md gate).
- **`--no-verify` / stop-hook-active bypass** — should the gate honor the same bypass as the existing done-block? Lean: yes (consistency).
- **Phase-transition detection** — currently the hook sees current phase; needs to distinguish "entering done" from "already in done" to avoid re-blocking. quality-state.ts has `lastKnownPhase` — use that. Lean: gate fires only on transition (lastKnownPhase ≠ done AND current = done).
