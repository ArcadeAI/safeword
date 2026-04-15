# Instruction Attention Hierarchy: Where to Put Critical Rules

**Finding:** Instructions have different compliance rates depending on where they live. Empirically verified across tickets #124 and #124b:

1. **Prompt hook reminder** (~95% compliance) — fires every turn, short, high-attention position. Agent followed "Present scenarios to user" and "AODI validation + adversarial pass" after we added them.
2. **Skill file entry/exit sections** (~80%) — loaded on trigger, read at start/end. Agent followed DISCOVERY.md exit checklist but skipped mid-file content.
3. **Skill file middle sections** (~50%) — lost-in-the-middle effect. Agent read DISCOVERY.md but skipped the self-test because it was buried between the header and the exit checklist.
4. **Cross-file delegation** (~20%) — "follow the pattern from X.md" almost never works. Agent read DISCOVERY.md which said "including the specificity self-test" referencing SAFEWORD.md. Skipped it every time.

**Key insight:** The prompt hook is the only enforcement point that fires regardless of which skill file is loaded. If the user scopes work conversationally without invoking a skill, skill file instructions never load at all. Critical rules must be in the prompt hook (compressed) AND in the skill file (detailed).

**Design rule:** For any instruction that must happen:

- Can it be a natural gate (file existence, hook exit code)? → Hook enforcement. 100% reliable.
- If not, put it in the prompt hook reminder (compressed, ~15 words max). ~95% reliable.
- Also put the detailed version in the skill file exit checklist (numbered, imperative). ~80% reliable.
- Never rely on cross-file delegation alone. ~20% reliable.

**Applied in:** Tickets #124, #124b — self-test added to prompt hook + DISCOVERY.md exit checklist. Scenario presentation instruction added to define-behavior prompt hook. Adversarial pass loop-back added to scenario-gate prompt hook.

**Source:** Anthropic long-context prompting docs (verified: "lost in the middle" problem, up to 30% improvement when critical info at top); empirical testing in this codebase across 2 tickets.
