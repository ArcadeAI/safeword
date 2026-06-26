# User Stories: Rust language skill optimization

## rust-language-skill-optimization.TB1 — Get Rust-aware agent behavior that transfers

As a Technical Builder, I want safeword's Rust language guidance to be validated
on held-out Rust repositories across Claude Opus and GPT/Codex, so I can trust
that the guidance helps real Rust work rather than one repository or one model.

### Acceptance Criteria

```gherkin
Given a Rust project with a detected Cargo.toml
When safeword installs language-pack guidance after the Rust eval gates pass
Then the project receives the rust skill
And non-Rust projects do not receive the rust skill
```

```gherkin
Given no-skill, human seed skill, and optimized skill candidates
When the Rust held-out evaluation completes on Claude Opus and GPT/Codex
Then each model family has a visible held-out score
And no accepted candidate regresses either model family
```

```gherkin
Given an optimized candidate includes repository names, hard-coded commands, or
eval-specific vocabulary
When candidate review runs
Then the candidate is blocked from shipping as the rust skill
```

## rust-language-skill-optimization.SM1 — Optimize Rust guidance safely

As a Safeword Maintainer, I want the Rust optimization loop to run in a sandboxed
experiment with executable oracles and whole-repository splits, so I can tell
real Rust transfer apart from overfitting before changing shipped templates.

### Acceptance Criteria

```gherkin
Given a Rust task in the pilot dataset
When the dataset loader validates it
Then the task declares a repository, checkout ref, split, sandbox policy,
timeout, resource limits, mount policy, allowed commands, and executable oracle
And the sandbox policy forbids Docker socket access and privileged mode
```

```gherkin
Given a candidate succeeds on secondary metrics but fails a required oracle
When the evaluator scores the task
Then correctness failure dominates the score
And the candidate cannot pass the gate for that task
```

```gherkin
Given a repository appears in the train split
When the dataset loader builds validation and held-out splits
Then that repository is rejected from every non-train split
```
