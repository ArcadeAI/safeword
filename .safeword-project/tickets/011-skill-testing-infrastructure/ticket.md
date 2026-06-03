---
id: 011
type: feature
phase: intake
status: cancelled
parent: null
created: 2026-01-07T19:53:00Z
last_modified: 2026-06-03T19:05:00.000Z
---

# Skill Testing Infrastructure

**Goal:** Enable automated testing of LLM skill behavior using Claude Code headless mode + Vitest.

## Background

Skills define LLM agent behavior through prompts. Currently we test:

- ✅ Skill file structure (frontmatter, naming, format)
- ✅ Hook execution (file creation, exit codes)
- ❌ Skill classification behavior ("does debugging skill trigger for errors?")
- ❌ Skill decision logic ("does BDD skill suggest split at >15 scenarios?")
- ❌ Skill artifact creation ("does split create correct tickets?")

## Scope

**In Scope:**

1. **Claude Headless test harness** - wrapper for `claude -p` with JSON parsing
2. **Classification tests** - test skill auto-invocation decisions
3. **Threshold unit tests** - deterministic tests for numeric triggers
4. **Artifact integration tests** - test file creation from skill actions

**Out of Scope:**

- Full E2E testing of entire BDD workflow
- Visual/screenshot testing
- Production monitoring

## Test Strategy (From Research)

| Scenario Type                 | Test Approach      | Location                                    | Cost        |
| ----------------------------- | ------------------ | ------------------------------------------- | ----------- |
| Classification (LLM judgment) | Claude Headless    | `tests/skills/classification.test.ts`       | ~$0.05/test |
| Threshold triggers            | Vitest unit        | `tests/skills/thresholds.test.ts`           | Free        |
| Artifact creation             | Vitest integration | `tests/integration/skill-artifacts.test.ts` | Free        |

## Technical Design

### Claude Headless Harness

```typescript
// packages/cli/src/test-utils/claude-headless.ts
export async function runClaudeHeadless(
  prompt: string,
  options?: {
    systemPromptFile?: string;
    allowedTools?: string[];
    maxTurns?: number;
  },
): Promise<{ result: string; cost: number }> {
  const cmd = [
    'claude',
    '-p',
    JSON.stringify(prompt),
    '--output-format',
    'json',
    '--max-turns',
    String(options?.maxTurns ?? 1),
  ];
  if (options?.systemPromptFile) {
    cmd.push('--system-prompt-file', options.systemPromptFile);
  }
  if (options?.allowedTools) {
    cmd.push('--allowedTools', options.allowedTools.join(','));
  }
  // Execute and parse JSON response
}
```

### Classification Test Example

```typescript
describe('BDD Skill Entry Checkpoint', () => {
  it('classifies single user story as feature', async () => {
    const result = await runClaudeHeadless(
      'Classify: "Add password reset". Options: patch, task, feature, epic.',
      {
        systemPromptFile: '.claude/skills/safeword-bdd-orchestrating/SKILL.md',
      },
    );
    expect(result.result).toMatch(/feature/i);
  });

  it('suggests split for two parallel stories', async () => {
    const result = await runClaudeHeadless(
      'Classify: "Add password reset and email verification". Should this be one feature or split?',
    );
    expect(result.result).toMatch(/split|two/i);
  });
});
```

### Threshold Unit Test Example

```typescript
// packages/cli/tests/skills/thresholds.test.ts
import { shouldSuggestSplit } from '../../src/skills/decomposition';

describe('Decomposition Thresholds', () => {
  it('triggers Phase 3 split at >15 scenarios', () => {
    expect(shouldSuggestSplit('phase3', 15)).toBe(false);
    expect(shouldSuggestSplit('phase3', 16)).toBe(true);
  });

  it('triggers Phase 5 split at >20 tasks', () => {
    expect(shouldSuggestSplit('phase5-tasks', 20)).toBe(false);
    expect(shouldSuggestSplit('phase5-tasks', 21)).toBe(true);
  });
});
```

### Artifact Integration Test Example

```typescript
// packages/cli/tests/integration/skill-artifacts.test.ts
describe('Split Artifact Creation', () => {
  it('promotes existing ticket to epic on split', async () => {
    const projectDir = createTemporaryDirectory();
    await createTicket(projectDir, { id: '015', type: 'feature' });

    await simulateSplitAcceptance(projectDir, '015', ['016', '017']);

    const ticket = readTicket(projectDir, '015');
    expect(ticket.type).toBe('epic');
    expect(ticket.children).toEqual(['016', '017']);
  });
});
```

## Task Breakdown

| #   | Task                                         | Estimate | Status |
| --- | -------------------------------------------- | -------- | ------ |
| 1   | Create Claude Headless harness               | 1 hour   | [ ]    |
| 2   | Add classification tests (8 scenarios)       | 1 hour   | [ ]    |
| 3   | Extract threshold logic to testable function | 30 min   | [ ]    |
| 4   | Add threshold unit tests (9 scenarios)       | 30 min   | [ ]    |
| 5   | Add artifact integration tests (8 scenarios) | 1 hour   | [ ]    |
| 6   | Add to CI pipeline                           | 30 min   | [ ]    |
| 7   | Document testing patterns in testing-guide   | 30 min   | [ ]    |

## Success Criteria

- [ ] `bun run test:skills` runs all skill behavior tests
- [ ] Classification tests pass with >80% consistency (LLM variance acceptable)
- [ ] Threshold tests are 100% deterministic
- [ ] Artifact tests verify file creation and content
- [ ] Total test cost <$1 per full run
- [ ] Tests complete in <2 minutes

## Dependencies

- Claude Code CLI installed and authenticated
- API credits for classification tests (~$0.40 per full run)

## Work Log

- 2026-06-03T19:05:00.000Z Closed (cancelled) via ticket-triage: stale — aspirational skill-behavior harness, never built.

---

- 2026-01-07T19:53:00Z Created: Ticket for skill testing infrastructure
