# Zombie Process Cleanup (Multi-Project Environments)

**When to use:** Working on multiple projects simultaneously, especially when they share tech stacks (Next.js, Playwright, etc.)

---

## Quick Start

Use the built-in cleanup script:

```bash
# Preview what would be killed (the default — nothing dies without --yes)
./.safeword/scripts/cleanup-zombies.sh

# Kill what the preview showed
./.safeword/scripts/cleanup-zombies.sh --yes
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

## Port-Based Cleanup

**Recommended:** Give each project a different port (for example, Project A:
3000 and Project B: 3001). The built-in script still verifies process ownership
when ports overlap.

**Port convention:** Dev and test instances use different ports within the same project:

- **Dev port**: Project's configured port (e.g., 3000, 5173, 8080) - manual testing
- **Test port**: Dev port + 1000 (e.g., 4000, 6173, 9080) - Playwright managed

See `development-workflow.md` → "E2E Testing with Persistent Dev Servers" for full port isolation strategy.

**Decision rule:** Use the built-in project script first. Use raw port or pattern
commands only after inspecting their matches.

**Manual cleanup** (replace ports with your project's ports):

```bash
# Inspect both dev server AND test server ports
lsof -i:3000 -i:4000

# Inspect matching Playwright processes before signaling anything
pgrep -l -f "playwright"
```

Raw `lsof | xargs kill` and `pkill -f` commands are machine-wide. A command line
that mentions this project does not prove that the process belongs to it.

---

## Built-in Cleanup Script

Safeword includes a cleanup script at `.safeword/scripts/cleanup-zombies.sh`:

```bash
# Preview (the default — auto-detects framework; nothing dies without --yes)
./.safeword/scripts/cleanup-zombies.sh

# Kill what the preview showed
./.safeword/scripts/cleanup-zombies.sh --yes

# Explicit port override (add --yes to kill)
./.safeword/scripts/cleanup-zombies.sh 5173

# Port + additional pattern
./.safeword/scripts/cleanup-zombies.sh --yes 5173 "electron"
```

The script requires `lsof`, `pgrep`, and `ps` to discover processes, verify
working directories, and exclude its invoking process tree. If any is
unavailable, it exits without inspecting or signaling processes and explains
how to recover. Kill mode also uses PATH-resolved `xargs` and `kill`; if either
cannot signal a selected process, the summary reports a failed signal instead
of claiming a successful kill.

**Features:**

- Auto-detects port from config files (vite.config.ts, next.config.js, etc.)
- Checks dev port AND test port (port + 1000), then keeps only processes whose
  working directory belongs to the current project
- Finds pattern candidates by command line, then applies the same working-directory
  ownership check
- Reports port owners it skipped because project ownership could not be verified
- `--dry-run` shows what would be killed without killing

**Supported frameworks:** Vite, Next.js, Nuxt, SvelteKit, Astro, Angular

---

## Common Patterns by Tech Stack

### Next.js Projects

```bash
# Preview project-owned Next.js processes (auto-detects port 3000)
./.safeword/scripts/cleanup-zombies.sh
```

### Playwright E2E Tests

```bash
# Preview project-owned Playwright browsers and test runners
./.safeword/scripts/cleanup-zombies.sh
```

### Vite Projects

```bash
# Preview project-owned Vite processes (auto-detects port 5173)
./.safeword/scripts/cleanup-zombies.sh
```

### React Native / Expo

```bash
# Preview a project-owned Metro bundler on port 8081
./.safeword/scripts/cleanup-zombies.sh 8081 "metro"

# Preview project-owned Expo tools on a known port
./.safeword/scripts/cleanup-zombies.sh 19000 "expo"
```

Port ranges are not supported. To inspect ports `19000` through `19006`, run
the command once per port; a value such as `19000-19006` is treated as a
process pattern, not a port.

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

# Print each Node process working directory (safe for zero or many matches)
while IFS= read -r pid; do
  lsof -a -p "$pid" -d cwd -Fn
done < <(pgrep node)
```

### Find Processes by Project Directory

```bash
# Find processes running in specific directory
ps aux | grep "/Users/alex/projects/my-project"
```

---

## Quick Reference

| Situation                                | Command                                            |
| ---------------------------------------- | -------------------------------------------------- |
| Preview zombies (recommended first step) | `./.safeword/scripts/cleanup-zombies.sh`           |
| Kill what the preview showed             | `./.safeword/scripts/cleanup-zombies.sh --yes`     |
| Inspect dev + test servers               | `lsof -i:$DEV_PORT -i:$TEST_PORT`                  |
| Inspect Playwright processes             | `pgrep -l -f "playwright"`                         |
| Check what's on port                     | `lsof -i:3000`                                     |
| Find zombie processes                    | `ps aux \| grep -E "(node\|playwright\|chromium)"` |
| Preview what `pkill -f` would kill       | `pgrep -f "pattern"` (verify before running pkill) |
| Kill by process ID                       | `kill -9 <PID>`                                    |

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
