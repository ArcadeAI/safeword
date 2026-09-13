# Figure It Out: Review-stamp helper help behavior

- [x] Phase 1: Frame the decision in one sentence
- [x] Phase 2: Generate 2-3 concrete options
- [x] Phase 3a: Enumerate relevant research domains (multiple)
- [x] Phase 3b: Research each named domain
- [x] Phase 4: Debate, steelman both sides, commit to one

## Decision

Decide where `-h` and `--help` should be recognized so help succeeds without
changing review-stamp argument semantics or consuming operational state.

## Options

1. **Parser-aware help mode.** Add a boolean help option to the existing parser,
   print a usage block, and exit before run-identity and ticket resolution.
   Smallest viable form: two recognized boolean tokens and one early return.
2. **Raw argv pre-scan.** Search argv for help before parsing and exit. Smallest
   viable form: one `includes` condition, but it cannot distinguish an option
   token from a value consumed by `--skip` or another value flag.
3. **CLI-wrapper-only help.** Add help to `safeword project runtime` and leave the
   script unchanged. Smallest viable form: Commander metadata, but it does not
   repair the direct helper command named in issue #4521.

## Research domains

- **CLI help semantics:** GNU's current command-line convention says `--help`
  prints usage and exits successfully. The issue additionally requires no
  artifact lookup.
- **Argument parsing boundaries:** Bun's current guidance recommends structured
  parsing that distinguishes boolean options, string options, and positionals.
  The existing handwritten parser can preserve that distinction without adding
  a dependency.
- **Operational side effects:** `readBridgedRunIdentity()` consumes a short-lived
  Codex/Cursor bridge identity. Help must return before calling it, not merely
  before artifact lookup.
- **Repository contract:** Existing integration tests execute the real helper at
  the subprocess boundary, so they can prove exit status, output, and absence of
  stamp writes without testing parser internals.

## Debate

**Raw pre-scan, steelmanned:** it is the fewest lines and guarantees help wins
before every operational prerequisite. It loses correctness because `-h` can be
a legitimate value to a value-taking option, so token position matters.

**CLI-wrapper-only, steelmanned:** it centralizes user-facing CLI behavior in the
Commander program. It loses coverage because installed skills and the reported
reproduction invoke the helper directly.

**Parser-aware mode:** it solves the exact surface, follows standard successful
help behavior, preserves option-value boundaries, and needs no new abstraction or
dependency. Its cost is a small parser field plus moving identity resolution
after the help branch.

> Recommend **parser-aware help mode** because it is the only option that fixes
> the direct helper while preserving value-token semantics. Raw pre-scan was
> close on size but loses on correctness when a help-looking token is a value.
> Cite: [GNU Coreutils common options](https://www.gnu.org/software/coreutils/manual/html_node/Common-options.html)
> and [Bun's argument-parsing guide](https://bun.sh/guides/process/argv).
>
> **Premortem:** assume this failed in six months—the likely cause is a new
> value-taking option whose value is accidentally reinterpreted as help; keep
> help recognition inside sequential parsing and protect the boundary with a
> regression test.
>
> **Next:** add the failing integration tests in
> `packages/cli/tests/integration/review-stamp.test.ts`.
