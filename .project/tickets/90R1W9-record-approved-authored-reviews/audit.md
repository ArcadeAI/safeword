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
