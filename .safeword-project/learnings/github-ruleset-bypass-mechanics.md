# GitHub Ruleset Bypass: How to Actually Invoke It

Covers: GitHub rulesets, `bypass_mode: "pull_request"`, gh CLI pre-flight check, REST merge endpoint, bypass-vs-admin-override.

> Extracted from May 2026 merge-control hardening on `ArcadeAI/safeword`.

---

## The setup

`main` is protected by a single repository ruleset (id `16731324`) with:

- Rules: `deletion`, `non_fast_forward`, `update`, `pull_request` (1 review + code-owner required).
- Bypass actors: `@TheMostlyGreat` and `@nbarbettini`, both with `bypass_mode: "pull_request"`.

Goal: Alex and Nate can merge their own PRs without satisfying code-owner-review, but nothing else changes (no direct push, no force push, no delete, others still need a code owner approval).

---

## The problem

After the ruleset was in place, `gh pr merge 126 --squash --delete-branch` refused:

```
X Pull request ArcadeAI/safeword#126 is not mergeable: the base branch policy prohibits the merge.
To use administrator privileges to immediately merge the pull request, add the `--admin` flag.
```

The user was a bypass actor with `pull_request` bypass mode and CI was green — gh CLI still refused.

---

## Root cause

`gh pr merge` does a client-side mergeability check via GraphQL (`mergeStateStatus: BLOCKED`) and short-circuits before ever calling the merge API. It does not know about — or attempt to invoke — the ruleset bypass. It only offers `--admin`, which is a separate **admin-override** mechanism, not the bypass-actor path.

The bypass is a **server-side decision** made when the merge endpoint is called. The web UI surfaces this as a "Merge without waiting for requirements to be met (bypass branch protections)" checkbox that the actor consciously ticks. There is no equivalent flag in `gh pr merge`.

---

## The fix

Skip gh CLI's pre-flight; call the merge endpoint directly. The bypass kicks in because GitHub evaluates ruleset bypass at the merge endpoint, not in client mergeability state.

```bash
# Merge via the REST endpoint (bypass applies automatically for the actor).
gh api -X PUT repos/ArcadeAI/safeword/pulls/<N>/merge -f merge_method=squash

# REST merge does NOT auto-delete the head branch — do it explicitly.
gh api -X DELETE repos/ArcadeAI/safeword/git/refs/heads/<branch-name>
```

Confirmed: PR #126 merged this way produced `mergedBy: TheMostlyGreat` with no admin-override audit signal, exactly as a bypass-actor merge should look.

---

## Why not `gh pr merge --admin`?

`--admin` works but uses **admin privileges to override branch protection**, which is a different audit story than "this user is an approved bypass actor invoking their bypass." If the team ever audits bypass usage vs admin overrides, the two paths land in different log entries. Prefer the bypass path when the user is in fact a bypass actor.

---

## Gotchas

- **`gh pr merge` will keep refusing forever** even when bypass is wired correctly. Don't waste time toggling ruleset config — go straight to `gh api -X PUT`.
- **Branch cleanup is manual** when using the REST endpoint. `gh pr merge` would delete it for you; the API call won't.
- **Web UI shows a "Bypass and merge" checkbox** for bypass actors. If you forget the API incantation, the UI works.
- **`bypass_mode: "always"` would let bypass actors push directly to `main`**, defeating the PR workflow. `"pull_request"` is the correct mode for "must open a PR but can merge own PRs without approval."

---

## Decision rule

| You are                                | Use                                                 |
| -------------------------------------- | --------------------------------------------------- |
| A bypass actor merging your own PR     | `gh api -X PUT .../pulls/N/merge -f merge_method=…` |
| An admin doing a one-off emergency fix | `gh pr merge --admin` (and document why)            |
| Neither                                | Get a code owner to approve, then `gh pr merge`     |

---

_Last updated: May 22, 2026_
