# Killer Demo reviewer smoke results

## Live smoke result — 2026-09-10 UTC

**4/4 expected decisions and defect reasons observed.** One independent Claude
review per case through Safeword 0.83.1's shared coordinator; reported model
alias `opus`, independence `cross-agent`. The alias is recorded as reported,
not claimed to identify a pinned model version. No expected labels or other
cases were included in a review packet.

| Case | Review ID                              | Actual decision | Observed reason                                                                                           |
| ---- | -------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| a    | `664e456e-d846-418d-9410-7678e8c0b3ae` | approve         | Concrete, source-linked matches, unresolved ambiguity, and the five-minute outcome form a falsifiable bet |
| b    | `f988183e-be3f-470c-97bf-a8d671f1289b` | request_changes | Every slot remains a placeholder, so the sentence asserts no persona-facing payoff                        |
| c    | `70e9efde-d10b-4908-9680-adb81a95bd79` | request_changes | Upload and row count leave the reconciliation work and correctness claim unproven                         |
| d    | `7ccd7998-09bc-4f10-a77e-80d9df51b7f1` | request_changes | Tax certification, universal bank coverage, and automatic ambiguity resolution exceed the stated scope    |

The reviewer noted two non-blocking refinements for case a: name the timing
observation explicitly and expand the `BK` persona code. These do not change
the expected acceptance decision.

### Input SHA-256

```text
DISCOVERY.md c88ae677ac877afca87745f13403f06e7c2dab86efc7934979d430e03837bf76
context.md   056d85c828fc422171ca9368e7b96d071df84cef34c6eca3b605109a80853d0d
cases/a.md   1e9163af4b597d941ccc5343a1a5adeb71f8c22da169d02729d60181fb8511e2
cases/b.md   972e5e006ed5bf94e669223b61b59c1fc59626001d0dbe917d14442d38bc28c0
cases/c.md   d934327bef0d177dd862010e25c7dd7ee8b4af5bb49fd9b328ed74470ed1ea15
cases/d.md   1a469432e36af273cfe7f237d36444b3e6d631fa3df1cbd59951e1ef08a88f6d
```

## Historical live smoke result — 2026-09-03 UTC

**4/4 expected decisions and defect reasons observed.** One independent Claude
review per case through Safeword 0.83.1's shared coordinator; reported model
`opus`, independence `cross-agent`. No expected labels or other cases were
included in a review packet. The model alias is recorded as reported, not
claimed to identify a pinned model version.

| Case | Review ID                              | Actual decision | Observed reason                                                                                                                        |
| ---- | -------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| a    | `7a5c1868-1986-4524-8da2-cd703aef5614` | approve         | 47 checkable matches plus three unresolved rows make the time-saving claim concrete and falsifiable within the stated capabilities     |
| b    | `a12d2981-e8d8-4419-a957-9ce33c29ceba` | request_changes | Every slot is an unsubstituted placeholder; there is no decision-bearing payoff                                                        |
| c    | `6a1b6b6b-9693-4311-80fc-8372dad6fe7c` | request_changes | The upload leaves the full reconciliation pain intact; row count cannot prove matching value                                           |
| d    | `444a7d95-929a-48a1-94d8-61810ae36e12` | request_changes | Tax certification, all-bank coverage and automatic ambiguity resolution contradict capability; a green badge cannot verify correctness |

Case a also received optional precision suggestions: explicitly rule out extra
incorrect matches, clarify timing endpoints, and expand the persona code. These
do not invalidate its payoff or evidence, so the fixture remains frozen.
Negative-case findings are expected test outcomes, not defects to fix in the
fixtures. Some incidental suggestions were overly prescriptive; only the
seeded defect and readiness decision were scored.

### Input SHA-256

```text
DISCOVERY.md c317894d75ed665f0cd082ee3a8306a0d25b47b700fdb733b94cfc55d9092aca
context.md   056d85c828fc422171ca9368e7b96d071df84cef34c6eca3b605109a80853d0d
cases/a.md   1e9163af4b597d941ccc5343a1a5adeb71f8c22da169d02729d60181fb8511e2
cases/b.md   972e5e006ed5bf94e669223b61b59c1fc59626001d0dbe917d14442d38bc28c0
cases/c.md   d934327bef0d177dd862010e25c7dd7ee8b4af5bb49fd9b328ed74470ed1ea15
cases/d.md   1a469432e36af273cfe7f237d36444b3e6d631fa3df1cbd59951e1ef08a88f6d
```

Scope: independent review of the demo fragment with the real intake standard
and shared epic/standalone product context. This is not separate execution of
each plan-owner path, automatic skill loading, or all four tagged agent hosts.
Those remain coverage intent; this smoke evidence must not be presented as
full end-to-end proof of the manual scenarios.
