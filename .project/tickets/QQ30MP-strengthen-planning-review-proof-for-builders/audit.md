# Diff-scoped audit

Scope: main merge-base e7b1f9f9c39da46f954d244d2371aa279ae96c1e
through cccae7bcc plus the final proof-hardening worktree. This is not a
repository-wide dead-code, clone or dependency-upgrade audit.

## Errors

None in the bounded production/test delivery diff. Two outstanding broad
scenario errors remain explicitly request-changes in
[review dispositions](review-dispositions.md); no feature closure is claimed.

## Architecture and references

The executable audit block reports no dependency violations: 155 modules and
300 dependencies cruised. Configuration freshness is healthy. Learning,
principle-reference and domain-reference checks emit no findings. The audit's
diff mode reports no Go/Python/Rust source changes; the formal verifier still
checks the Go experiment and configured Python project independently.

Fresh source review covered every changed production hunk: command registration
and dispatch, authenticated disposition write/confirmation, public target
normalization, typed recovery, Product/scenario role admission and nested-list
inventory validation. No second identity scheme, fallback route or copy gate
was added. Same-filesystem rename serializes cooperating disposition writers;
unrelated concurrent writers remain outside that lock's guarantee.

README/CLI reference, architecture prose and schema/configuration references
were reconciled with the implemented public command and existing path
resolvers. No manifest, dependency or template changed in this hardening pass.
The earlier generated runtime carriers remain fresh by the static five-surface
check; generated minified bundles were checked through generation, not manually
reviewed as source.

## Dead code, duplication and dependencies

Knip, whole-repository clone totals and upgrade discovery are explicitly skipped
by diff mode; there is no new clone-count baseline or invented delta. The
actionable duplicate installed setup was extracted in cccae7bcc with assertions
preserved and 16/16 protection tests. No further abstraction is warranted.
The formal supply-chain lane finds eight JavaScript advisories in the unchanged
dependency graph; see verify.md and the raw log. Dependency upgrades are excluded.

## Test quality

Twenty test/support files differ from main. Earlier residual-delivery and
nested-repair reviews remain applicable to unchanged production/test portions;
this pass freshly reviewed the shared fixture, its two consuming extraction
diffs, the three hardened test files and the corrected scenario matrix.
Independent Claude reviews 8b1fa2eb and 44238cc8 approve the hardening; remaining
warnings have written dispositions rather than implied fixes.

Useful improvements now present: differential configured-namespace bytes and
exact inventory membership; alias ownership rejection before reviewer launch;
explicit pending-state assertions with deterministic cleanup; real PTY
confirmation-time context edits preserving ticket bytes; supported kind/severity
coverage; existing numeric spelling characterization. The fake reviewer is the
process boundary; packet assembly, authenticated review storage and public
command routing remain real collaborators. Final targeted run: 173/173 passed.

The new tests are characterization/proof hardening, not invented RED history.
The earlier nested-inventory product RED and separate original disposition RED
remain retained with their real commits. Broad scenarios still lack executable
bindings and independent host/human judgment proof. No test tag or green
package lane substitutes for that evidence.

## Summary

Errors: 0 in bounded diff | Warnings: dependency advisories, broad scenario gaps,
human/host confidence limits, and scoped tooling exclusions as recorded above.

Audit passed with warnings.

**Next:** Review Draft PR #5980 with the bounded verification and broad-feature
limitations kept visible; do not merge or promote it.
