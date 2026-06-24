import { describe, expect, it } from 'vitest';

import { readRepoFile as read } from './helpers';

// Cold-start executability test (3KKPWJ, epic 169). The deliverable is
// prose instruction: a guide (`cold-start-check.md`) holding the spawn +
// verdict contract, and a DISCOVERY Intake Exit rung that offers it on
// one-way-door work. Scenarios are proved by content assertions on the
// authored text (the TPP6Y2/NWFT20 pattern). A new instruction lib/skill
// would be tested-but-unused bloat — the trigger is conversational discipline.

const GUIDE = 'packages/cli/templates/guides/cold-start-check.md';
const DISCOVERY = 'packages/cli/templates/skills/bdd/DISCOVERY.md';
const SAFEWORD = 'packages/cli/templates/SAFEWORD.md';

const loadGuide = (): string => read(GUIDE).toLowerCase();
const loadDiscovery = (): string => read(DISCOVERY).toLowerCase();
const loadSafeword = (): string => read(SAFEWORD).toLowerCase();

describe('cold-start check — offered only on irreversible work (@NTB1.AC1)', () => {
  it('the DISCOVERY Intake Exit rung offers the check on one-way-door work', () => {
    const discovery = loadDiscovery();
    expect(discovery).toContain('cold-start');
    expect(discovery).toContain('one-way');
  });

  it('scopes the offer to irreversible work — only-when language, so two-way-door gets no offer', () => {
    const discovery = loadDiscovery();
    // The rung must scope the offer, not fire on every feature.
    expect(discovery).toMatch(/only (when|on|for)[^.]*one-way/);
  });

  it('names all three cross-cutting sub-classes that also trigger the offer', () => {
    const discovery = loadDiscovery();
    expect(discovery).toContain('data model');
    expect(discovery).toContain('public api');
    expect(discovery).toContain('migration');
  });

  it('a missing Reversibility field yields no offer', () => {
    const discovery = loadDiscovery();
    expect(discovery).toMatch(/missing[^.]*no offer|no offer[^.]*missing/);
  });

  it("a skip:'d Reversibility field yields no offer", () => {
    const discovery = loadDiscovery();
    expect(discovery).toContain('skip:');
    expect(discovery).toMatch(/skip[^.]*no offer|no offer[^.]*skip/);
  });

  it('reads the recorded Reversibility field and forbids re-judging it at exit', () => {
    const discovery = loadDiscovery();
    expect(discovery).toContain('recorded');
    // Anti-re-judgment prohibition — a negative directive, not just a positive read.
    expect(discovery).toMatch(
      /do not re-?(judge|assess)|never re-?(judge|assess)|without re-?(judging|assessing)/,
    );
  });
});

describe('cold-start check — behaves correctly under YOLO (@NTB1.AC1)', () => {
  it('auto-accepts the offer and logs the auto-decision under YOLO', () => {
    const discovery = loadDiscovery();
    expect(discovery).toContain('yolo');
    expect(discovery).toMatch(/auto-accept|auto-run|auto-confirm/);
    expect(discovery).toContain('work log');
  });

  it('records auto-appended gaps as defer: so the auto-confirming exit is not silently blocked', () => {
    const discovery = loadDiscovery();
    expect(discovery).toContain('defer:');
    // The guide must explain *why* defer: is the reconciliation — that the
    // auto-confirming exit treats a non-empty Open Questions list as resolved.
    const guide = loadGuide();
    expect(guide).toContain('defer:');
    expect(guide).toMatch(/auto-confirming|treats[^.]*resolved|as resolved/);
  });
});

describe('cold-start check — a context-free agent plans from spec + repo only (@TB1.AC1)', () => {
  it('spawns an isolation:worktree sub-agent with spec, ticket, and repo present', () => {
    const guide = loadGuide();
    expect(guide).toContain('isolation: worktree');
    expect(guide).toContain('spec');
    expect(guide).toContain('ticket');
    expect(guide).toContain('repo');
  });

  it('gives the sub-agent no conversation — stated positively and as an anti-pattern', () => {
    const guide = loadGuide();
    expect(guide).toContain('no conversation');
    // Anti-pattern: must explicitly forbid handing over the transcript/history.
    expect(guide).toMatch(
      /no (conversation|transcript|chat) (history|context)|without[^.]*(conversation|transcript) history/,
    );
  });

  it('defines a two-valued verdict with rubric — sufficient vs insufficient with named gaps', () => {
    const guide = loadGuide();
    expect(guide).toContain('sufficient');
    expect(guide).toContain('insufficient');
    expect(guide).toMatch(/end-to-end|end to end/);
    expect(guide).toContain('gap');
  });

  it('directs the cold agent to plan, not run a full build', () => {
    const guide = loadGuide();
    expect(guide).toContain('plan');
    expect(guide).toMatch(/not[^.]*full build|not[^.]*implement|does not build/);
  });
});

describe('cold-start check — verdict rendered in plain language (@NTB1.AC2)', () => {
  it('renders the verdict in plain language with a concrete next action and no builder-facing jargon', () => {
    const guide = loadGuide();
    expect(guide).toContain('plain language');
    expect(guide).toMatch(/next action|next step/);
    // The render instruction must warn off internal terms for the NTB.
    expect(guide).toMatch(/jargon|internal term/);
  });
});

describe('cold-start check — gaps persisted to Open Questions (@TB1.AC2)', () => {
  it('appends gaps to a non-empty Open Questions, preserving existing lines', () => {
    const guide = loadGuide();
    expect(guide).toContain('open questions');
    expect(guide).toMatch(/append|add/);
    expect(guide).toMatch(/preserve|not overwrite|without overwriting|never overwrite/);
  });

  it('handles appending to an empty Open Questions section (boundary)', () => {
    const guide = loadGuide();
    expect(guide).toContain('empty');
  });
});

describe('cold-start check — advisory, never blocks (@NTB1.AC3)', () => {
  it('an insufficient verdict does not block — the builder decides whether to proceed', () => {
    const guide = loadGuide();
    expect(guide).toMatch(/advisory|never blocks?|does not block/);
    expect(guide).toMatch(/builder decides|you decide|the user decides/);
  });

  it('on sub-agent error/timeout, notes one line and proceeds — no gaps, no block, no retry loop', () => {
    const guide = loadGuide();
    expect(guide).toMatch(/error|timeout|times out/);
    expect(guide).toMatch(/note[^.]*proceed|proceed[^.]*note/);
    expect(guide).toMatch(/no retry|don't retry|do not retry|not in a loop/);
  });
});

describe('cold-start check — invokable on demand (@TB1.AC3)', () => {
  it('SAFEWORD.md points to the check, scoped to one-way-door and runnable on demand', () => {
    const safeword = loadSafeword();
    expect(safeword).toContain('cold-start');
    // Pointer must keep its scoping, not drift to an unconditional mention.
    expect(safeword).toContain('one-way');
    expect(safeword).toMatch(/on demand|on-demand/);
  });

  it('on-demand invocation works even when the auto-offer would not fire', () => {
    const guide = loadGuide();
    expect(guide).toMatch(/on demand|on-demand|any time|anytime|explicitly/);
    // Distinguishes the on-demand path from the auto-offer (regardless of reversibility).
    expect(guide).toMatch(/regardless|even when|even if|independent of/);
  });
});
