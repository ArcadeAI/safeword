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

**NEVER use `killall node` or `pkill -9 node` when working on multiple projects — this kills processes from ALL projects.**

---

## Port-Based Cleanup (Safest for Multi-Project)

Each project should use a different port. Dev and test instances use different ports within the same project:

- **Dev port**: Project's configured port (e.g., 3000, 5173, 8080)
- **Test port**: Dev port + 1000 (e.g., 4000, 6173, 9080)

See `testing-guide.md` → "E2E Testing with Persistent Dev Servers" for full port isolation strategy.

**Recommended cleanup pattern:**

```bash
# Graceful shutdown first, then force kill
lsof -ti:3000 -ti:4000 | xargs kill -15 2> /dev/null
sleep 1
lsof -ti:3000 -ti:4000 | xargs kill -9 2> /dev/null

# Kill Playwright processes launched from THIS directory
pkill -f "playwright.*$(pwd)" 2> /dev/null
```

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

## Debugging Zombie Processes

### Find What's Using a Port

```bash
lsof -i:3000
lsof -i:3000 -P -n # more details
```

### Find All Node Processes

```bash
ps aux | grep -E "(node|playwright|chromium)"
```

### Find Processes by Project Directory

```bash
ps aux | grep "/path/to/your/project"
```

---

## Quick Reference

| Situation                            | Command                                                           |
| ------------------------------------ | ----------------------------------------------------------------- |
| Quick cleanup (recommended)          | `./.safeword/scripts/cleanup-zombies.sh`                          |
| Preview before killing               | `./.safeword/scripts/cleanup-zombies.sh --dry-run`                |
| Kill dev + test servers (your ports) | `lsof -ti:$DEV_PORT -ti:$TEST_PORT \| xargs kill -15 2>/dev/null` |
| Kill Playwright (this project)       | `pkill -f "playwright.*$(pwd)"`                                   |
| Check what's on port                 | `lsof -i:3000`                                                    |
| Find zombie processes                | `ps aux \| grep -E "(node\|playwright\|chromium)"`                |
| Preview what `pkill -f` would kill   | `pgrep -f "pattern"` (verify before running pkill)                |

---

## What NOT to Do

- `killall node` — kills all projects
- `pkill -9 node` — kills all projects
- `pkill -f "pattern"` without `pgrep -f` first — can kill unintended processes
- Kill processes without checking working directory
- Assume zombie browsers will clean themselves up (they won't)

---

## Advanced: Finding the Source

When zombies keep coming back, find which test is creating them.

| Symptom                                    | Script                       |
| ------------------------------------------ | ---------------------------- |
| Test leaves files behind (.git, temp dirs) | `bisect-test-pollution.sh`   |
| Test leaves processes behind (chromium)    | `bisect-zombie-processes.sh` |

```bash
# Find test that creates files
./.safeword/scripts/bisect-test-pollution.sh '.git' '*.test.ts' src

# Find test that leaves processes
./.safeword/scripts/bisect-zombie-processes.sh 'chromium' '*.test.ts' tests
```

Both scripts auto-detect package manager, stop at first offending test, and show investigation commands.
