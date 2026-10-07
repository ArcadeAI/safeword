# Scoped audit

Dedicated safeword:audit invoked through the installed invocation recorder. The
skill's code-quality, learning, principle and domain-document command blocks ran
against the PR diff, rather than the whole repository.

## Findings

- Error fixed: current-head Node 24 CI acceptance expected the old exact response
  keys. Four real CLI scenarios failed specifically on review_excluded_targets.
  Their expected key lists now include the field; strict equality remains intact.
  Genuine RED: /tmp/approval-exclusions-acceptance-red.log. GREEN: four scenarios,
  80 steps in /tmp/approval-exclusions-acceptance-green.log.
- No additional source, dependency-layer, dead-reference, scoped documentation,
  learning or principle defects found. Dependency-cruiser checked 51 modules and
  72 dependencies without violations; configuration reconciliation reported no
  drift. Logs: /tmp/approval-exclusions-audit-code.log and the adjacent audit
  learning, principles and docs logs.
- Architecture and public CLI documentation agree: authentication and current
  packet classification precede verified exclusions; the reader transports those
  exclusions and the gate grants only exact-file coverage waivers. Existing
  generated bundles carry the source through generators. No new dependency,
  persistent record, directory waiver or caller-controlled exclusion was added.

## Coverage limits

Repository-wide Knip, clone baselining and package freshness scans were skipped by
the skill's diff policy, not reported green. Manual reference tracing covered the
new reviewIdentity and verifiedExcludedTargets helpers and both receipt fields.
Installed 1.0.0 still cannot record this approval; its genuine failed stamp is an
activation limitation, not bypassed or replaced by a fabricated receipt.

## Source-map dependency security follow-up

User authorized the smallest patched source-map-js update after CI reported
GHSA-68fv-2mgg-jv7q. The advisory identifies versions before 1.2.2 as vulnerable
to event-loop denial of service through indexed source-map section offsets.
Registry latest and integrity were verified against npm; bun.lock now resolves
1.2.2 instead of 1.2.1. All existing consumer ranges accept this patch, so no
direct dependency, override, manifest change, or unrelated upgrade was added.

Pinned Bun 1.3.14 frozen installation accepted the lockfile. A force frozen
install refreshed stale local consumer links; all five installed consuming
packages (PostCSS, both css-tree versions, @eslint/css-tree and magicast) resolve
1.2.2. Unreferenced old install cache bytes are not dependency resolution.

Before/after audit is the genuine regression evidence for this dependency-only
change; no fabricated source RED test is claimed. The source-map-js advisory is
absent afterward, but audit remains non-green with two unrelated high findings:
http-cache-semantics GHSA-ch52-4w7c-c8xp and braces GHSA-vfj7-8cjw-p6xm. They
remain outside this explicitly narrow update. Logs:
/tmp/5443-source-map-audit-before.log and
/tmp/5443-source-map-audit-final.log.

Affected CLI/relay/collector source-map builds and the Astro website production
build passed after refreshing the dependency links. Release packaging passed
13 files / 81 tests. Logs: /tmp/5443-source-map-build-final.log,
/tmp/5443-source-map-website-final.log, /tmp/5443-source-map-release-final.log.
Independent dependency review approved the single lock entry, compatible ranges,
registry integrity and honest remaining audit blockers. No production source,
generated template bytes, historical scenario claims, installed approval stamp,
or release state changed. Fresh CI remains required and the PR remains Draft.

Sources: [reviewed advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [upstream patch release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2).

Final root lint, Gherkin lint and CLI typecheck passed with pinned Bun 1.3.14 and actual Node 26.8.1 (/tmp/5443-source-map-lint-node-final.log). The initial Bun-as-Node PATH failed node:sqlite resolution; no source assertions were changed. All five generated surfaces remain current (/tmp/5443-source-map-generated.log).

## CI policy and deferred advisories

Exact c6d4045c5 CI 37414245531 passed, including its configured audit. The audit
explicitly ignores the two remaining high advisories under inherited commit
541efd82a policy; the user deferred them. The raw local scan is still non-green,
while source-map-js is actually patched. No ignore was added by this PR.
The supported installed-candidate recording walkthrough and its negative
authored-file check are documented once in verify.md.
