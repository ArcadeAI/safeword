---
name: distilled-rust-ownership-v1
description: Rust coding guidance for agent runs that edit Rust crates or workspaces, with extra focus on ownership diagnostics, async boundaries, feature flags, public API compatibility, and Cargo-based verification.
---

# Rust Coding Guidance

Work from the crate boundary inward. Identify the package layout, feature flags,
public API surface, and the smallest focused test or compile check that
exercises the change before editing. Prefer a small, local semantic change over
large rewrites.

## Workflow

1. Inspect `Cargo.toml`, workspace members, feature flags, and the module owning
   the behavior.
2. Reproduce with the narrowest useful command first: a named test, a package
   test, or `cargo check` for the affected package.
3. Make the smallest change that preserves behavior outside the requested fix.
4. Run the focused command again, then expand to the relevant package or
   workspace command before finishing.
5. Keep lockfile behavior intentional. Use `--locked` when a lockfile is
   present, and use offline commands only after dependencies have already been
   fetched.

## Resolving Borrow-Checker Errors

Read the compiler diagnostic and its help text before restructuring code. Rust
borrow-checker errors often point to a smaller fix than the first design you may
reach for.

- For `E0382` moved-value errors, find the move and the later use. Prefer
  passing `&value` or `&mut value` when the callee does not need ownership.
- Move ownership only at a real API boundary. Avoid broad cloning inside loops,
  iterators, traversal helpers, or parser code unless the data must outlive the
  current owner.
- For conflicting-borrow errors such as `E0499` or `E0502`, shorten the borrow
  scope. Compute small owned facts, such as indexes or lengths, before taking a
  mutable borrow.
- For move-or-assign-while-borrowed errors such as `E0505` or `E0506`, end the
  outstanding borrow first. A local block or intermediate binding is often
  clearer than changing lifetimes.
- Treat `Arc`, `Rc`, `Mutex`, `RwLock`, and interior mutability as architecture
  choices. Do not add them just to silence an ownership diagnostic.

The goal is not to silence the compiler; it is to express the data lifetime that
the code actually needs.

## Ownership And Lifetimes

- Prefer borrowing over allocation when a reference communicates the intended
  lifetime.
- Move ownership boundaries to the caller or callee rather than cloning broadly.
- Add explicit lifetime parameters only after the ownership model is clear.
- Preserve zero-copy behavior in parser, iterator, and buffer-heavy code unless
  correctness requires allocation.

## Async Rust

- Do not hold synchronous locks or borrowed mutable state across `.await`.
- Preserve cancellation behavior: dropping a future should not leak tasks,
  permits, file descriptors, or partially committed state.
- Check `Send`, `Sync`, and `'static` requirements at spawn boundaries.
- Prefer deterministic async tests with controlled time, explicit notifications,
  or bounded channels instead of sleeps.

## Error Handling

- Keep error types and messages compatible when they are part of the public
  surface.
- Propagate context at IO, parsing, network, and concurrency boundaries.
- Do not replace recoverable errors with panics in library code.

## Macros, Features, And Public API

- For macro changes, verify both generated code behavior and diagnostics.
- Keep optional dependencies behind the same feature gates unless the task
  explicitly changes the feature contract.
- Avoid public API churn. If an API change is unavoidable, update call sites,
  docs, and tests together.
- Build and test the feature combinations touched by the change, not only the
  default feature set.

## Unsafe Code

- Avoid expanding `unsafe`. If touching existing `unsafe`, state the invariant
  being preserved and add a test around the safe boundary when possible.
- Never use `unsafe` to bypass ownership, aliasing, pinning, or thread-safety
  errors without proving the invariant in comments and tests.

## Finishing Checks

- Run the focused test or compile command first, then run the relevant package
  or workspace command.
- Run `cargo fmt` when source formatting changed.
- Run `cargo clippy` when lint-sensitive shared code changed or when the project
  already treats clippy as part of its workflow.
- Report the exact commands run and any commands intentionally skipped.
