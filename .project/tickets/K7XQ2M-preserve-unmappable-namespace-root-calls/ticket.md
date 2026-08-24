---
id: K7XQ2M
slug: preserve-unmappable-namespace-root-calls
type: task
phase: intake
status: todo
related: [KEQQGN]
scope:
  - preserve a namespace-root invocation whenever the rewrite cannot map its arguments
  - apply the trailing-operand guard on the key-matched branch, not only the no-key branch
  - cover key-plus-unmappable-operand with a regression test
out_of_scope:
  - reference-path rewrite boundaries (KEQQGN owns that)
  - changing the namespace-root subcommand's own flag surface
done_when:
  - an invocation whose arguments the rewrite cannot map is emitted unchanged
  - a test fails if such an invocation is rewritten into a no-operand subcommand
---

# Keep unmappable namespace-root calls working in generated Codex skills

**Goal:** Make the namespace-root rewrite honour preserve-on-anything-unrecognised on every branch.

**Why:** A generated Codex skill that resolves a namespace root through an unmapped argument silently resolves an empty path instead of failing, so the skill reads the wrong file with no error anyone can see.

## The mechanism

Two related gaps in `adaptNamespaceRootInvocations` / `rewriteNamespaceRootTail`
(`packages/cli/src/codex-plugin/catalogue.ts`):

1. **On main**, the prefix is replaced even when `NAMESPACE_ROOT_ARGUMENTS` does
   not match, so a malformed or unsupported call loses its positional arguments
   and may resolve a different namespace root.
2. **In PR #3262's proposed fix**, `TRAILING_OPERAND` is applied only on the
   no-key branch. With a key present and an unmappable operand following:

   ```
    personas "$FILE")"
   ```

   `NAMESPACE_ROOT_BASENAME` returns undefined, `consumed` becomes
   `key.length + 1`, and the operand is re-emitted after the rewritten command:

   ```
   project namespace-root --cwd "$PROJECT_DIR" --key personas "$FILE")"
   ```

`namespace-root` takes no operands, so this exits 1. Under the
`NS_ROOT="$(… 2> /dev/null)"` capture shape the module documents, that failure
degrades to a silent empty path.

## Direction

Apply the trailing-operand guard after the key/basename match as well, so every
unmapped form is preserved verbatim. Add a case for a key followed by an
unmappable operand: PR #3262's `OPAQUE` test covers only the no-key branch, so
it reads as proof of an invariant it does not exercise.

## Provenance

Finding 2 of an independent cross-agent Codex review of `catalogue.ts` on main,
plus a review of PR #3262; both confirmed by hand-tracing the regex.
