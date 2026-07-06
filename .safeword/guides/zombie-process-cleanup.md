# Zombie Process Cleanup (Multi-Project Environments)

**When to use:** Working on multiple projects simultaneously, especially when they share tech stacks (Next.js, Playwright, etc.)

---

## Quick Start

Use the built-in cleanup script:

```bash
# Preview what would be killed (safe)
./.safeword/scripts/cleanup-zombies.sh --dry-run

# Kill zombie processes
./.safeword/scripts/cleanup-zombies.sh
```

The script auto-detects your framework (Vite, Next.js, etc.) and kills only processes belonging to this project.

For manual control or debugging, see the detailed sections below.

---

## The Problem

When running dev servers and E2E tests across multiple projects, zombie processes accumulate:

- Dev servers holding ports
- Playwright browser instances
- Test runners stuck in background
- Build processes from previous sessions

Broad kills by bare runtime name (`killall node`, `pkill -9 node`) hit ALL projects' processes — the safeword Bash gate denies them (`hooks/lib/process-kill-guard.ts`). Use the project-scoped patterns below.

---

## Port-Based Cleanup (Safest for Multi-Project)

**Prerequisite:** Each project must use a different port (e.g., Project A: 3000, Project B: 3001)

**Port convention:** Dev and test instances use different ports within the same project:

- **Dev port**: Project's configured port (e.g., 3000, 5173, 8080) - manual testing
- **Test port**: Dev port + 1000 (e.g., 4000, 6173, 9080) - Playwright managed

See `development-workflow.md` → "E2E Testing with Persistent Dev Servers" for full port isolation strategy.

**Decision rule:** If unsure which cleanup method to use → port-based first (safest), then project script, then tmux.

**Recommended cleanup pattern** (replace ports with your project's ports):

```bash
# Kill both dev server AND test server ports
# Example: Next.js (3000/4000), Vite (5173/6173), or your project's ports
lsof -ti:3000 -ti:4000 | xargs kill -9 2> /dev/null

# Kill Playwright processes launched from THIS directory
pkill -f "playwright.*$(pwd)" 2> /dev/null

# Wait for cleanup
sleep 2
```

**Why this works:**

- ✅ Dev + test ports are unique to this project → safe to kill
- ✅ `$(pwd)` ensures only THIS project's tests are killed
- ✅ Other projects completely untouched

---

## Built-in Cleanup Script

Safeword includes a cleanup script at `.safeword/scripts/cleanup-zombies.sh`:

```bash
# Auto-detect framework and clean up
./.safeword/scripts/cleanup-zombies.sh

# Preview first (recommended)
./.safeword/scripts/cleanup-zombies.sh --dry-run

# Explicit port override
./.safeword/scripts/cleanup-zombies.sh 5173

# Port + additional pattern
./.safeword/scripts/cleanup-zombies.sh 5173 "electron"
```

**Features:**

- Auto-detects port from config files (vite.config.ts, next.config.js, etc.)
- Kills dev port AND test port (port + 1000)
- Scopes all pattern matching to current project directory
- `--dry-run` shows what would be killed without killing

**Supported frameworks:** Vite, Next.js, Nuxt, SvelteKit, Astro, Angular

---

## Common Patterns by Tech Stack

### Next.js Projects

```bash
# Kill Next.js dev server (port 3000)
lsof -ti:3000 | xargs kill -9 2> /dev/null

# Kill Next.js build processes for this project
ps aux | grep "next dev" | grep "$(pwd)" | grep -v grep | awk '{print $2}' | xargs kill -9 2> /dev/null
```

### Playwright E2E Tests

```bash
# Kill Playwright browsers and test runners
pkill -f "playwright.*$(pwd)" 2> /dev/null

# Or more specific (by project name)
pkill -f "playwright.*my-project-name" 2> /dev/null
```

### Vite Projects

```bash
# Kill Vite dev server (typically port 5173)
lsof -ti:5173 | xargs kill -9 2> /dev/null
```

### React Native / Expo

```bash
# Kill Metro bundler (port 8081)
lsof -ti:8081 | xargs kill -9 2> /dev/null

# Kill Expo dev tools (port 19000-19006)
lsof -ti:19000-19006 | xargs kill -9 2> /dev/null
```

---

## Alternative: tmux/Screen Sessions

For complete isolation, run each project in its own terminal session:

```bash
# Start project in named session
tmux new -s project-name
# Run dev server here

# Kill everything in this session only
tmux kill-session -t project-name
```

**Pros:**

- ✅ Complete isolation between projects
- ✅ One command kills everything
- ✅ Can detach/reattach sessions

**Cons:**

- ⚠️ Requires learning tmux
- ⚠️ Different workflow

---

## Debugging Zombie Processes

### Find What's Using a Port

```bash
# Check what's on port 3000
lsof -i:3000

# More details
lsof -i:3000 -P -n
```

### Find All Node Processes

```bash
# List all node processes
ps aux | grep -E "(node|playwright|chromium)"

# More detailed (with working directory)
lsof -p $(pgrep node) | grep cwd
```

### Find Processes by Project Directory

```bash
# Find processes running in specific directory
ps aux | grep "/Users/alex/projects/my-project"
```

---

## Quick Reference

| Situation                                | Command                                                          |
| ---------------------------------------- | ---------------------------------------------------------------- |
| Quick cleanup (recommended)              | `./.safeword/scripts/cleanup-zombies.sh`                         |
| Preview before killing                   | `./.safeword/scripts/cleanup-zombies.sh --dry-run`               |
| Kill dev + test servers (use your ports) | `lsof -ti:$DEV_PORT -ti:$TEST_PORT \| xargs kill -9 2>/dev/null` |
| Kill Playwright (this project)           | `pkill -f "playwright.*$(pwd)"`                                  |
| Check what's on port                     | `lsof -i:3000`                                                   |
| Find zombie processes                    | `ps aux \| grep -E "(node\|playwright\|chromium)"`               |
| Preview what `pkill -f` would kill       | `pgrep -f "pattern"` (verify before running pkill)               |
| Kill by process ID                       | `kill -9 <PID>`                                                  |

---

## Advanced: Finding the Source

When zombies keep coming back, find which test is creating them.

### When to Use

| Symptom                                    | Script                       |
| ------------------------------------------ | ---------------------------- |
| Test leaves files behind (.git, temp dirs) | `bisect-test-pollution.sh`   |
| Test leaves processes behind (chromium)    | `bisect-zombie-processes.sh` |

### Find Test That Creates Files

```bash
# Usage: ./bisect-test-pollution.sh <file_to_check> <test_pattern> [search_dir]
./.safeword/scripts/bisect-test-pollution.sh '.git' '*.test.ts' src
```

Runs each test individually, checks if `<file_to_check>` appears after.

### Find Test That Leaves Processes

```bash
# Usage: ./bisect-zombie-processes.sh <process_pattern> <test_pattern> [search_dir]
./.safeword/scripts/bisect-zombie-processes.sh 'chromium' '*.test.ts' tests
```

Runs each test individually, checks if `<process_pattern>` is left running.

**Both scripts:**

- Auto-detect package manager (bun/pnpm/yarn/npm)
- Stop at first offending test
- Show investigation commands
