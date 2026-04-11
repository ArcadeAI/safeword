# E2E Test Zombie Processes

Covers: zombie process prevention in E2E tests, sequential execution enforcement, cleanup scripts.

**Principle:** E2E tests that spawn dev servers can create zombie processes if run in parallel. Always enforce sequential execution and provide clear cleanup instructions.

## The Gotcha

When E2E test frameworks (Playwright, Cypress) start dev servers via `webServer` config, running multiple test commands in parallel creates competing server instances that fight for the same port. This leads to:

- Port conflicts (EADDRINUSE)
- Orphaned processes that never terminate
- Tests hanging indefinitely during retry phase
- Accumulating zombie processes across multiple test runs

❌ **Bad:** Running multiple test commands simultaneously

```bash
# Terminal 1
pnpm test &

# Terminal 2 (before Terminal 1 completes)
pnpm test &

# Result: 2 webServers competing for port 3000
# Both hang, neither completes, processes accumulate
```

✅ **Good:** Enforce sequential execution

```bash
# Terminal 1
pnpm test

# Wait for completion...

# Terminal 2 (only after Terminal 1 finishes)
pnpm test
```

**Why it matters:**

- Users don't realize background processes are still running
- Each retry attempt doubles the problem (retry #1 spawns another webServer)
- Can accumulate 8+ zombie processes across a debugging session
- Port conflicts make ALL subsequent tests fail

## Prevention

### 1. Document Sequential Execution Requirement

In your testing docs (e.g., `tests/SAFEWORD.md`), add prominent warning:

```markdown
### Zombie processes / Port already in use

**NEVER run multiple `pnpm test` commands simultaneously**

- Only run ONE test command at a time
- Wait for previous test run to complete before starting another

Why: Each test run spawns its own webServer. Multiple parallel runs
fight for same port, creating zombie processes.
```

### 2. Configure playwright.config.ts for Safety

```typescript
export default defineConfig({
  // In CI: workers=1 (sequential)
  // Locally: workers=undefined (allows parallelism within single run)
  workers: process.env.CI ? 1 : undefined,

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    timeout: 120000,
    reuseExistingServer: !process.env.CI, // Reuse locally, fresh in CI
    stdout: 'pipe', // Capture output for debugging hangs
    stderr: 'pipe', // Capture errors
  },
});
```

**Key settings:**

- `reuseExistingServer: !process.env.CI` - Reuse server locally (faster), fresh in CI (reliable)
- `stdout: 'pipe'` / `stderr: 'pipe'` - Capture output to debug when webServer hangs
- `workers: 1` in CI - Forces sequential execution where parallelism is most dangerous

### 3. Provide Clear Cleanup Instructions

```bash
# Kill all processes on test ports
lsof -ti:3000 | xargs kill -9 2> /dev/null
lsof -ti:3001 | xargs kill -9 2> /dev/null

# Or kill by process name pattern
pkill -9 -f "playwright.*test-name"
pkill -9 -f "next dev"

# Wait before starting tests again
sleep 5
```

## Debugging Zombie Processes

### Symptoms

- Error: `Port 3000 is in use`
- Error: `Timed out waiting 120000ms from config.webServer`
- Tests hang during retry phase
- `ps aux | grep test` shows multiple test processes

### Root Cause Investigation

```bash
# Check for background test processes
ps aux | grep -E "(playwright|next dev|pnpm test)"

# Check what's using the port
lsof -i:3000

# Check for orphaned Node processes
pgrep -fl node
```

### Fix

1. **Kill all test-related processes**

   ```bash
   pkill -9 -f "pnpm test"
   pkill -9 -f "next dev"
   pkill -9 -f "playwright"
   ```

2. **Verify ports are clear**

   ```bash
   lsof -i:3000 # Should return nothing
   ```

3. **Wait before restarting**

   ```bash
   sleep 5 # Give processes time to fully terminate
   ```

4. **Review process management**
   - Check if any terminals have background jobs (`jobs` command)
   - Check if any tests are running in other terminal windows
   - Restart terminal session if processes won't die

## Testing Trap

**Tests pass locally but fail in CI:**

- **Cause:** Local machine has `reuseExistingServer: true`, so dev server stays running across test runs
- **In CI:** Fresh server every time, exposes timing/startup issues
- **Fix:** Occasionally test locally with `reuseExistingServer: false` to catch CI-only failures

**Tests hang during retry phase:**

- **Cause:** Retry spawns another webServer while first is still running
- **Amplification:** Each retry doubles the zombie processes (1 → 2 → 4 → 8)
- **Fix:**
  - Reduce retries: `retries: process.env.CI ? 2 : 1`
  - Fix flaky tests so retries aren't needed
  - Add debugging output to understand why tests are failing

## Examples

### ✅ Good: Sequential Execution in Documentation

````markdown
## Running Tests

```bash
# Run all tests (ONE command at a time)
pnpm test

# Run specific test file
pnpm test -- path/to/file.test.ts

# IMPORTANT: Wait for test run to complete before starting another
```
````

### ✅ Good: Clear Warning in CI/CD Setup

```yaml
# .github/workflows/test.yml
- name: Run E2E tests
  run: pnpm test
  # NOTE: Do not run multiple test commands in parallel
  # Each spawns a webServer competing for ports
```

### ❌ Bad: No Warning About Parallel Execution

````markdown
## Running Tests

```bash
pnpm test # Run all tests
```
````

**Problem:** Developers don't know that running `pnpm test` in multiple terminals simultaneously will cause zombie processes.

## Key Principles

1. **Educate developers** - Most don't realize background processes are still running
2. **Enforce sequential execution** - Document it prominently in testing guides
3. **Add debugging visibility** - Use `stdout: 'pipe'` to capture webServer output
4. **Provide cleanup scripts** - Make it easy to kill zombie processes when they happen
5. **Test locally like CI** - Occasionally disable `reuseExistingServer` to catch CI-only issues

## Related Patterns

- **Test retry amplification** - Each retry doubles zombie processes
- **Port conflict cascades** - One zombie process blocks all future test runs
- **Silent background jobs** - Users don't notice processes still running after terminal close

## Reference

Discovered during demo mode E2E testing implementation (2025-11-01). See project-specific learning for demo mode testing patterns.
