# Focused verification — OpenCode catalogue timeout

Base: main `e49310a749b89cccc73faeeb843273bb05c95f08`.
User explicitly approved this existing-test setup edit on November 11 Pacific.

Only `tests/opencode/catalogue.test.ts` changes: use `offline:true` with a
comment. The real lifecycle installer, isolated filesystem profile, all
catalogue assertions and the existing timeout remain unchanged. No production,
generated, dependency or review-policy change.

- Unchanged baseline: catalogue file passes 5/5 locally, 8.45s.
- Changed candidate: catalogue and profile files pass 28/28, 15.41s combined.
- Direct offline lifecycle probe: all 50 catalogue assets match their expected
  bytes, no npm invocation, 667ms overall. This is a local observation, not a
  CI performance bound or native-host activation proof.
- Changed-file ESLint passes; `git diff --check` passes. Test wrapper builds
  the CLI and declarations successfully.
- Independent cross-agent Claude quality review `21cd5c4d` approves with no
  errors. Its warnings concern existing assertion specificity/self-comparison
  and breadth, not this setup flag. No wider test-hardening work was added.
- Historical main CI `43090952840` failed both Node jobs at 60s in this test;
  its log and job metadata remain preserved. Exact historical subprocess
  timing is unknown; no local timeout reproduction or fabricated RED claimed.

Limits: no full local suite, smoke lane, remote CI or completed verification
gate is claimed. Ticket remains in progress; nothing is pushed, published or
merged. The unrelated native converter audit failure and all 33 deferred cases
remain unchanged (MCWV4B 18, FC33HK 12, KKP2R3 2, DRD65E 1).
