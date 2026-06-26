---
name: human-seed-rust
description: Rust coding guidance for agent runs that edit Rust crates or workspaces, especially when correctness depends on ownership, async behavior, feature flags, public API compatibility, and Cargo-based verification.
---

# Rust Coding Guidance

Work from the crate boundary inward. Identify the package layout, feature flags,
public API surface, and the smallest focused test or compile check that exercises
the change before editing.

## Workflow

1. Inspect `Cargo.toml`, workspace members, feature flags, and the module owning
   the behavior.
2. Reproduce with the narrowest useful command first: a package test, a named
   test, or `cargo check` for the affected package.
3. Make the smallest semantic change that preserves public behavior outside the
   requested fix.
4. Run the focused command again, then expand to the relevant package or
   workspace command before finishing.
5. Keep lockfile behavior intentional. Use locked commands when a lockfile is
   present and offline commands only after dependencies have already been
   fetched.

## Ownership And Lifetimes

- Prefer moving ownership boundaries to the caller or callee over broad cloning.
- Use borrowing changes to express the real data lifetime; avoid adding lifetime
  parameters until the ownership model is clear.
- Preserve zero-copy behavior in parser, iterator, and buffer-heavy code unless
  correctness requires allocation.
- Treat `Arc`, `Mutex`, `RwLock`, and interior mutability as design decisions,
  not quick borrow-checker escape hatches.

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

## Unsafe Code

- Avoid expanding `unsafe`. If touching existing `unsafe`, state the invariant
  being preserved and add a test around the safe boundary when possible.
- Do not use `unsafe` to bypass ownership, aliasing, pinning, or thread-safety
  errors without proving the invariant in code comments and tests.

## Finishing Checks

- Run `cargo fmt` when source formatting changed.
- Run `cargo clippy` when lint-sensitive shared code changed or when the project
  already treats clippy as part of its workflow.
- Report the exact commands run and any commands intentionally skipped.
