# Behavioral Dimensions: Keep reviews focused on authored changes

The review result changes only at the boundary where an individual target
exceeds the existing per-file packet limit. These independent dimensions select
the smallest set of representative behavioral scenarios.

| Dimension | Partitions | Boundary / edge | Covered by scenario |
| --- | --- | --- | --- |
| Target size | below limit · exactly 262144 bytes · **one byte over** | multibyte UTF-8 character counts differ from raw byte counts; generated status does not alter an in-limit target | generated below-boundary; multibyte boundary; oversized scenarios |
| Generated classification | literal `true` · unset / false / set / `TRUE` / `True` / `yes` / whitespace-padded value / malformed output / command failure | only Git's literal lower-case `true` in one valid record is an exception; malformed lookup has its own recovery code | generated oversized target; non-true outline; malformed and lookup-failure rejections |
| Multiple generated candidates | every lookup valid · **one malformed lookup in either order** | discovery is atomic; no early exclusion leaks from a partial batch | multi-target lookup-failure outline |
| Preflight precedence | one failure · unmarked oversized plus attribute-resolution failure in either order | unavailable classification wins so the outcome cannot vary by iteration order | precedence outline |
| Eligible target set | authored target remains · **none remains** | every supplied target is omitted | generated target leaves authored input; all targets excluded |
| Result scope | no reduction · named generated exclusions | `excluded_targets` has exact duplicate-free canonical project-relative membership in supplied-target order after packet finalization; preflight failures omit it | multiple generated oversized targets; repeated path; alias paths; post-launch failure; special paths |
| Input validity | every oversize target marked · **one unmarked target** | mixed input must fail atomically before reviewer launch | mixed generated and unmarked input |
| Aggregate bound | four individually valid 262144-byte multibyte UTF-8 files · **the same four plus one byte** | generated omission cannot reset the pre-existing aggregate cap, count characters instead of bytes, or mask individual-limit precedence | aggregate boundary success; aggregate overflow rejection |
| Failure result | target-too-large · packet-too-large · no-eligible-targets | nonzero JSON envelope contains the exact `errors[0].code` and no successful-scope field | all rejection scenarios |
| Target path syntax | ordinary · nested with spaces · option-like · **outside project** | Git receives every project-relative path as one literal NUL-delimited stdin value, never shell or pathspec syntax; outside targets never reach it | special-path and outside-project outlines |
| Capture stability | captured target unchanged · **replaced before attribute lookup** | a changed target fails before either classification or review | target-changed rejection |
| Submitted target set | eligible target exists · **empty input** · all targets omitted | every no-eligible path reports the same no-review failure | empty targets; all generated oversized targets |
| Existing target validity | regular UTF-8 file · **directory / invalid UTF-8** | generated classification never bypasses earlier containment or text validation | generated-marker validation outline |
| Repository metadata | runtime artifact marked · marker absent | Safeword dogfood path is classified by the same mechanism | generated runtime metadata |

## Partitioning notes

- The normal bounded-file path is unchanged and covered by the existing packet
  suite; this ticket focuses on the new over-limit boundary.
- Valid unset, false, set-without-value, and other values are deliberately
  treated like unmarked input. A Git command failure, an incomplete record, a
  duplicate record, or delimiter-breaking output is not an attribute value: it
  fails with `REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE`, so recovery does not
  misdiagnose the repository toolchain. The packet seam forces both cases
  without depending on a machine's Git installation.
- The aggregate packet limit remains unchanged. Combining it with generated
  omission would test an existing invariant rather than the new decision, so a
  focused unit regression retains coverage at the packet boundary.
- Existing `packet.test.ts` coverage continues to reject missing, non-regular,
  symlink-escaping, non-UTF-8, and read-racing targets. This ticket adds the
  new capture-to-attribute race because generated classification introduces the
  only new preflight boundary after capture.
- A classification response is valid only when it carries exactly one record
  that names the requested canonical path. Multiple, foreign, missing, or
  delimiter-corrupt records are attribute-resolution failures, not a generated
  declaration.
- Every generated classification uses one process contract: `git -C
  project-root check-attr -z --stdin linguist-generated`, with exactly one
  NUL-terminated canonical project-relative path in stdin and exactly one
  matching UTF-8 response tuple: canonical path, `linguist-generated`, value,
  each NUL-terminated with no trailing bytes. No target path is placed in argv
  or a shell string.
- The content digest captured for each target is compared immediately before
  Git classification and immediately before reviewer launch. Post-launch route
  failures retain finalized scope for auditability; only failed preflight has
  no trustworthy scope to report.
- Preflight first captures and validates every target, then resolves every
  needed generated attribute. `REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE` takes
  precedence over `REVIEW_TARGET_TOO_LARGE` in a mixed batch because Safeword
  cannot safely complete classification; the rule is independent of input order.

## Test layers

- **Unit:** real temporary Git repositories exercise attribute lookup and
  packet selection without mocking its filesystem or Git boundary.
- **Command / acceptance:** a fake reviewer process verifies that the public
  command receives exactly the eligible files with their raw contents intact,
  reports an exact ordered exclusion list, and never launches on
  aggregate-overflow, all-excluded, or unmarked oversized input. A fake Git
  executable proves that special paths cross as literal NUL-delimited stdin
  values, while outside and symlink-escaping or newly changed paths are
  rejected before attribute lookup. The asserted JSON
  envelope is the CLI's user-visible contract.
- **Metadata:** `git check-attr` against the dogfood artifact proves the
  shipped repository declaration is present; the command-level arbitrary-path
  fixture proves packet selection actually follows the Git attribute rather
  than a hard-coded runtime path.
