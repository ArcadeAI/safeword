# Apply the independent test-review suggestions

The user requested formal verify/audit and the edits suggested by independent
Claude review `0ff245cd-b099-4213-a5fc-581703b62734`. This slice changes only tests
and evidence; the #5041 production contract, qualification descriptor, corpus,
prompt, and #5051 exclusions are unchanged.

- Both refusal matrices now require the exact changed canonical clause in every
  regenerated template and its absence from every installed snapshot. File
  transformations cannot satisfy that pending-update precondition by themselves.
- Native fixtures now use their matching author runtime and an opposite-agent
  simulated reviewer. The Claude Execution layout is the sole explicit exception:
  the current Execution admission accepts only Claude reviewers, so this asset
  integrity check retains a Codex author. This does not prove Claude-author
  Execution dispatch or native UI parity, and admission is not widened.
- The native bundle identity oracle reads a static object through TypeScript's
  JavaScript syntax parser. It permits quoted keys and multiline formatting,
  independently derives all expected phase paths and file hashes, and still
  compares the remaining shared runtime bytes exactly. Nonliteral, missing or
  duplicate identity declarations fail loudly.
- The earlier proof-wording correction remains: direct review dispatch is only
  supporting evidence for the stored-receipt/local-hook transition scenario.
  That scenario's historical ledger is still unchecked.

These are stronger characterizations of existing behavior, not newly invented
product REDs. The first focused attempt passed 47 and failed one: matching the
Claude Execution author exposed zero admitted independent routes. Retain that
failure; the explicit exception preserves existing admission rather than changing
production to make a fixture pass. The six-case corrected native run passed.

Review the three changed test files for oracle independence, fixture isolation,
phase/host claims and accidental assertion weakening. The full verification and
diff-scoped factual audit are separate closing evidence. No live semantic
qualification is requested; prior semantic failures and deferrals remain open.
