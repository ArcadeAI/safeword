# Verify: generated-doc merge-union (GA7T6M / #566)

## Checklist

**Repro fixed:** ✅ The pre-fix repro (two branches each regenerating the doc) produced
a 6-marker conflict; with `merge=union` active the same merge **auto-resolves with 0
conflict markers** ("Merge made by the 'ort' strategy") — proven both ad-hoc and as a
git-level test (`gitattributes-merge-union.test.ts`).
**Setup deploys it:** ✅ `safeword setup` writes the managed `.gitattributes` block
(3 `merge=union` lines + header); idempotent on re-run (no duplication); resolves the
ticket-index paths against a custom `paths.projectRoot`; appends to (preserves) a
consumer's existing `.gitattributes`.
**Dogfood:** ✅ This repo's `.gitattributes` is **byte-identical** to setup output → no
upgrade churn.
**Tests:** ✅ 5 new tests pass; 173 reconcile/schema/owned-paths regression tests green.
**Lint:** ✅ clean. **Typecheck:** ✅ no new errors.
**`architecture --check`:** ✅ unaffected (the `.gitattributes` change does not touch the
generated docs).
**Dep drift:** ✅ zero new dependencies.

## Constraints preserved (from the figure-it-out)

- `architecture --check` still works — files stay committed; union only removes the
  manual conflict step, and `--check` remains the gate that forces a correct regen.
- Human prose preserved — union keeps both sides' lines; heal reconciles.
- Browsability preserved (still committed); `linguist-generated=true` collapses diffs.
- Deployable — `merge=union` is built-in/attribute-only, so the committed `.gitattributes`
  works on any clone/CI with no per-clone `git config`.

## Accepted trade-off (documented in ticket.md)

`**/architecture.generated.md` includes prose-bearing leaf docs; a same-section prose
collision resolves last-write-wins (rare, recoverable via history + heal). The frequent,
zero-risk wins (root index + ticket index) are fully covered. GitHub server-side PR merges
don't honor merge drivers (git limitation) — out of scope; the reported repro is the local
merge, which is fixed.
