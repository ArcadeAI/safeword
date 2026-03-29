# Task: CI hardening — concurrency, timeouts, caching, golangci-lint binary

**Type:** Improvement

**Scope:** Add missing CI safety nets (concurrency control, job timeouts) and optimize the slowest non-test step (golangci-lint compile from source → pre-built binary). Also regenerate stale lockfile and enable pip caching.

**Out of Scope:** TypeScript errors (ticket 077), Bun version bump (Dependabot), `deploy-pages` v4→v5 (Dependabot PR #47), Node.js 20→24 migration, matrix builds, new workflows, Rust caching (`Swatinem/rust-cache` — no cargo builds in CI).

**Done When:**

- [ ] `bun.lock` regenerated and committed — `--frozen-lockfile` passes in CI
- [ ] Concurrency added to CI workflow — cancel superseded PR runs, queue main pushes
- [ ] Job timeouts added — `timeout-minutes: 20` (test), `timeout-minutes: 5` (lint)
- [ ] golangci-lint installed via pre-built binary instead of `go install` (~55s → ~3s)
- [ ] pip caching enabled on `setup-python` (`cache: 'pip'`)
- [ ] CI install step passes (blocked on 077 for full green)

**Tests:**

- [ ] `bun install --frozen-lockfile` passes locally
- [ ] CI install step passes after push (verify via `gh run list`)

## Implementation

**Concurrency** (ci.yml):

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: true
```

`head_ref` is only set on PRs → PR runs cancel per-branch. On main, `run_id` makes each group unique → main runs queue, never cancel each other.

**golangci-lint** (ci.yml, test job):

```yaml
# Before: go install ... @v2.10.1  (~55s, compiles from source)
# After:
- name: Install golangci-lint v2
  run: curl -sSfL https://golangci-lint.run/install.sh | sh -s -- -b $(go env GOPATH)/bin v2.10.1
```

**pip caching** (ci.yml, test job):

```yaml
- uses: actions/setup-python@v6
  with:
    python-version: '3.12'
    cache: 'pip'
    cache-dependency-path: '.github/requirements-ci.txt'
```

## Files

- `.github/workflows/ci.yml` — concurrency, timeouts, golangci-lint binary, pip cache
- `bun.lock` — regenerate

## Research Notes

Investigated 2026-03-28/29. Dead ends documented to prevent re-investigation:

- ~~`cache: true` on setup-bun~~ — already cached by default, `no-cache: true` is the opt-out
- ~~Remove `cache: false` from setup-go~~ — correct as-is, no go.mod/go.sum to cache
- ~~Remove explicit bun-version pin~~ — no `packageManager` field in package.json
- ~~`Swatinem/rust-cache@v2`~~ — caches cargo build artifacts, CI only runs clippy/rustfmt on fixtures
- ~~`deploy-pages` v4→v5~~ — already handled by Dependabot PR #47
- ~~`golangci-lint-action@v9`~~ — designed to run+report linting, overkill when you just need the binary on PATH

## Timing Baseline (run 23688560635)

| Step (test job)       | Duration    | After fix            |
| --------------------- | ----------- | -------------------- |
| Install golangci-lint | ~55s        | ~3s (binary)         |
| Install Python tools  | ~5s         | ~3s (cached)         |
| Install deps (bun)    | ~8s         | ~8s (already cached) |
| Test CLI              | ~15min      | unchanged            |
| **Total test job**    | **~16m30s** | **~15m38s**          |

| Step (lint job) | Duration |
| --------------- | -------- |
| Full job        | ~51s     |

## Work Log

- 2026-03-29 Created. All 15 recent CI runs failing (stale lockfile). Workflow lacks concurrency, timeouts, and golangci-lint is compiled from source every run (~55s). Split TS errors to ticket 077.
