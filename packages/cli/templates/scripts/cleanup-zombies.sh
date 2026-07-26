#!/bin/bash
# Cleanup zombie processes: Kill dev servers and test processes for THIS project
#
# Use when: Port in use after tests, dev server won't start, zombie node/playwright
# processes, need to clean up before running tests, switching between projects
#
# Auto-detection: Checks root, packages/*/, apps/*/ for framework configs (monorepo support)
#
# Deny-by-default (#773 rung 4): a bare invocation PREVIEWS what would be
# killed; nothing dies without an explicit --yes. The preview-first ritual is
# script-enforced, not a guide instruction.
#
# Usage: ./cleanup-zombies.sh [--yes] [port] [pattern]
# Example: ./cleanup-zombies.sh                    # preview (auto-detect from config files)
# Example: ./cleanup-zombies.sh --yes              # kill what the preview shows
# Example: ./cleanup-zombies.sh --yes 5173         # kill on explicit port
# Example: ./cleanup-zombies.sh --yes 5173 "vite"  # kill on port + pattern

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Parse arguments
DRY_RUN=true
DRY_RUN_EXPLICIT=false
PORT=""
PATTERN=""

for arg in "$@"; do
  case "$arg" in
    --yes | -y)
      DRY_RUN=false
      ;;
    --dry-run)
      # Explicit alias for the default; kept so existing invocations stay valid.
      # Sticky: in a contradictory `--dry-run --yes` mix, preview wins.
      DRY_RUN=true
      DRY_RUN_EXPLICIT=true
      ;;
    --help | -h)
      echo "Usage: $0 [--yes] [port] [pattern]"
      echo ""
      echo "Cleanup zombie processes for the current project."
      echo "Previews by default; killing requires --yes."
      echo ""
      echo "Options:"
      echo "  --yes, -y    Kill the processes the preview shows"
      echo "  --dry-run    Explicit preview (the default behavior)"
      echo "  --help       Show this help message"
      echo ""
      echo "Arguments:"
      echo "  port         Port number (auto-detected if not provided)"
      echo "  pattern      Additional process pattern to match"
      echo ""
      echo "Examples:"
      echo "  $0                     # Preview (auto-detect port from config files)"
      echo "  $0 --yes               # Kill what the preview shows"
      echo "  $0 --yes 5173          # Kill processes on port 5173"
      echo "  $0 --yes 5173 electron # Port 5173 + electron processes"
      exit 0
      ;;
    *)
      if [ -z "$PORT" ] && [[ "$arg" =~ ^[0-9]+$ ]]; then
        PORT="$arg"
      elif [ -z "$PATTERN" ]; then
        PATTERN="$arg"
      fi
      ;;
  esac
done

# A contradictory `--dry-run --yes` mix resolves to preview regardless of flag
# order — the safest reading of an ambiguous request.
[ "$DRY_RUN_EXPLICIT" = true ] && DRY_RUN=true

# Check if any file matching pattern exists (supports globs)
has_config() {
  local pattern=$1
  # Check root first, then common monorepo locations
  compgen -G "$pattern" > /dev/null 2>&1 && return 0
  compgen -G "packages/*/$pattern" > /dev/null 2>&1 && return 0
  compgen -G "apps/*/$pattern" > /dev/null 2>&1 && return 0
  return 1
}

# Auto-detect port from framework config files
detect_port() {
  if has_config "vite.config.*"; then
    echo "5173"
  elif has_config "next.config.*"; then
    echo "3000"
  elif has_config "nuxt.config.*"; then
    echo "3000"
  elif has_config "svelte.config.js"; then
    echo "5173"
  elif has_config "astro.config.*"; then
    echo "4321"
  elif has_config "angular.json"; then
    echo "4200"
  else
    echo ""
  fi
}

# Auto-detect framework pattern
detect_pattern() {
  if has_config "vite.config.*"; then
    echo "vite"
  elif has_config "next.config.*"; then
    echo "next"
  elif has_config "nuxt.config.*"; then
    echo "nuxt"
  else
    echo ""
  fi
}

# Use auto-detection if not provided
if [ -z "$PORT" ]; then
  PORT=$(detect_port)
fi

if [ -z "$PATTERN" ]; then
  PATTERN=$(detect_pattern)
fi

PROJECT_DIR="$(pwd -P)"
# macOS exposes its temporary directory through both /var and /private/var.
# A process may carry either spelling in its argv, so keep the equivalent alias
# for the project-scoped match without broadening the directory boundary.
PROJECT_DIR_ALIASES=("$PROJECT_DIR")
if [[ "$PROJECT_DIR" == /private/var/* ]]; then
  PROJECT_DIR_ALIASES+=("/var/${PROJECT_DIR#/private/var/}")
fi
PROJECT_NAME="$(basename "$PROJECT_DIR")"

echo "Cleanup zombies for: $PROJECT_NAME"
echo "   Directory: $PROJECT_DIR"
[ -n "$PORT" ] && echo "   Port: $PORT (+ test port $((PORT + 1000)))"
[ -n "$PATTERN" ] && echo "   Pattern: $PATTERN"
$DRY_RUN && echo -e "   ${YELLOW}DRY RUN (default) - no processes will be killed; pass --yes to kill${NC}"
echo ""

# Track what we find/kill
FOUND_COUNT=0
KILLED_COUNT=0

# Return success only when a path is the project root or one of its descendants.
path_belongs_to_project() {
  local candidate=$1
  local project_dir
  for project_dir in "${PROJECT_DIR_ALIASES[@]}"; do
    case "$candidate" in
      "$project_dir" | "$project_dir"/*) return 0 ;;
    esac
  done
  return 1
}

# Port ownership is machine-wide, so verify each matching process belongs to this
# project before presenting it as a cleanup candidate. Deny by default when
# its working directory does not establish ownership.
process_belongs_to_project() {
  local pid=$1
  local field
  local process_cwd

  process_cwd=""
  while IFS= read -r -d '' field; do
    case "$field" in
      n*)
        process_cwd=${field#n}
        break
        ;;
    esac
  done < <(lsof -a -p "$pid" -d cwd -Fn0 2> /dev/null || true)

  if [ -n "$process_cwd" ] && path_belongs_to_project "$process_cwd"; then
    return 0
  fi
  return 1
}

# Function to find and optionally kill processes by port
cleanup_port() {
  local port=$1
  local pids
  local project_pids=()
  pids=$(lsof -ti:"$port" 2> /dev/null || true)

  for pid in $pids; do
    if process_belongs_to_project "$pid"; then
      project_pids+=("$pid")
    fi
  done

  if [ "${#project_pids[@]}" -eq 0 ]; then
    return
  fi

  local count
  count=${#project_pids[@]}
  FOUND_COUNT=$((FOUND_COUNT + count))

  echo "Port $port: $count process(es)"
  for pid in "${project_pids[@]}"; do
    local cmd
    cmd=$(ps -p "$pid" -o command= 2> /dev/null | head -c 80 || echo "unknown")
    echo "  PID $pid: $cmd"
  done

  if [ "$DRY_RUN" = false ]; then
    for pid in "${project_pids[@]}"; do
      if process_belongs_to_project "$pid"; then
        printf '%s\n' "$pid" | xargs -n 1 kill -9 2> /dev/null || true
        KILLED_COUNT=$((KILLED_COUNT + 1))
      fi
    done
  fi
}

# Function to find and optionally kill processes by pattern (scoped to project)
cleanup_pattern() {
  local pattern=$1
  local pids
  local project_dir
  # Match pattern AND project directory for safety
  for project_dir in "${PROJECT_DIR_ALIASES[@]}"; do
    pids=$(pgrep -f "$pattern.*$project_dir" 2> /dev/null || pgrep -f "$project_dir.*$pattern" 2> /dev/null || true)
    [ -n "$pids" ] && break
  done

  if [ -n "$pids" ]; then
    local count
    count=$(echo "$pids" | wc -l | tr -d ' ')
    FOUND_COUNT=$((FOUND_COUNT + count))

    echo "Pattern '$pattern' (project-scoped): $count process(es)"
    for pid in $pids; do
      local cmd
      cmd=$(ps -p "$pid" -o command= 2> /dev/null | head -c 80 || echo "unknown")
      echo "  PID $pid: $cmd"
    done

    if [ "$DRY_RUN" = false ]; then
      echo "$pids" | xargs kill -9 2> /dev/null || true
      KILLED_COUNT=$((KILLED_COUNT + count))
    fi
  fi
}

# 1. Kill by port (dev server)
if [ -n "$PORT" ]; then
  cleanup_port "$PORT"

  # Also kill test port (dev port + 1000, common convention)
  TEST_PORT=$((PORT + 1000))
  cleanup_port "$TEST_PORT"
fi

# 2. Kill Playwright/test processes scoped to this project
cleanup_pattern "playwright"
cleanup_pattern "chromium"
cleanup_pattern "electron"

# 3. Kill framework-specific processes scoped to this project
if [ -n "$PATTERN" ]; then
  cleanup_pattern "$PATTERN"
fi

# 4. Wait for cleanup
if [ "$DRY_RUN" = false ] && [ "$KILLED_COUNT" -gt 0 ]; then
  sleep 2
fi

# 5. Summary
echo ""
if [ "$FOUND_COUNT" -eq 0 ]; then
  echo -e "${GREEN}No zombie processes found - already clean!${NC}"
elif [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}Found $FOUND_COUNT process(es) that would be killed${NC}"
  echo "   Re-run with --yes to kill them"
else
  echo -e "${GREEN}Killed $KILLED_COUNT process(es)${NC}"

  # Verify port is free
  if [ -n "$PORT" ]; then
    if lsof -i:"$PORT" > /dev/null 2>&1; then
      echo -e "${YELLOW}Warning: Port $PORT still in use${NC}"
      lsof -i:"$PORT"
    else
      echo "   Port $PORT is now free"
    fi
  fi
fi
