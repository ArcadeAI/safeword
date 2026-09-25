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

# Auto-detect the framework once so its port and process pattern cannot drift.
# Output is `<port>|<pattern>`; frameworks without a dedicated process pattern
# leave the second field empty.
detect_framework() {
  if has_config "vite.config.*"; then
    echo "5173|vite"
  elif has_config "next.config.*"; then
    echo "3000|next"
  elif has_config "nuxt.config.*"; then
    echo "3000|nuxt"
  elif has_config "svelte.config.js"; then
    echo "5173|"
  elif has_config "astro.config.*"; then
    echo "4321|"
  elif has_config "angular.json"; then
    echo "4200|"
  else
    echo "|"
  fi
}

# Use auto-detection if not provided
DETECTED_FRAMEWORK=""
if [ -z "$PORT" ] || [ -z "$PATTERN" ]; then
  DETECTED_FRAMEWORK=$(detect_framework)
fi

DETECTED_PORT=${DETECTED_FRAMEWORK%%|*}
DETECTED_PATTERN=${DETECTED_FRAMEWORK#*|}

if [ -z "$PORT" ]; then
  PORT=$DETECTED_PORT
fi
if [ -z "$PATTERN" ]; then
  PATTERN=$DETECTED_PATTERN
fi

normalize_port() {
  local normalized=$1

  while [[ "$normalized" == 0* ]] && [ "${#normalized}" -gt 1 ]; do
    normalized=${normalized#0}
  done

  if [ "$normalized" = "0" ] \
    || [ "${#normalized}" -gt 5 ] \
    || [ "$normalized" -gt 65535 ]; then
    echo "Error: port must be between 1 and 65535." >&2
    return 1
  fi

  printf '%s\n' "$normalized"
}

TEST_PORT=""
if [ -n "$PORT" ]; then
  if ! PORT=$(normalize_port "$PORT"); then
    exit 2
  fi
  if [ "$PORT" -le 64535 ]; then
    TEST_PORT=$((PORT + 1000))
  fi
fi

PROJECT_DIR="$(pwd -P)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"

for required_tool in lsof pgrep ps; do
  if ! command -v "$required_tool" > /dev/null 2>&1; then
    echo "Error: $required_tool is required for safe project-scoped cleanup; no processes were inspected or signaled." >&2
    echo "Install $required_tool and retry." >&2
    exit 1
  fi
done

echo "Cleanup zombies for: $PROJECT_NAME"
echo "   Directory: $PROJECT_DIR"
if [ -n "$TEST_PORT" ]; then
  echo "   Port: $PORT (+ test port $TEST_PORT)"
elif [ -n "$PORT" ]; then
  echo "   Port: $PORT"
fi
[ -n "$PATTERN" ] && echo "   Pattern: $PATTERN"
$DRY_RUN && echo -e "   ${YELLOW}DRY RUN (default) - no processes will be killed; pass --yes to kill${NC}"
echo ""

# Track what we find/kill
FOUND_COUNT=0
KILLED_COUNT=0
FAILED_KILL_COUNT=0
SKIPPED_PORT_COUNT=0
DISCOVERY_ERROR_STATUS=0

# A user-supplied pattern can appear in the argv of the cleanup process and any
# shell or task runner that invoked it. Exclude the whole ancestor chain.
CLEANUP_ANCESTOR_PIDS=("$$" "$PPID")
collect_cleanup_ancestors() {
  local current_pid=$PPID
  local parent_pid

  while [[ "$current_pid" =~ ^[0-9]+$ ]] && [ "$current_pid" -gt 1 ]; do
    parent_pid=$(ps -p "$current_pid" -o ppid= 2> /dev/null)
    parent_pid=${parent_pid//[[:space:]]/}
    if ! [[ "$parent_pid" =~ ^[0-9]+$ ]] || [ "$parent_pid" -le 1 ] || [ "$parent_pid" = "$current_pid" ]; then
      break
    fi
    CLEANUP_ANCESTOR_PIDS+=("$parent_pid")
    current_pid=$parent_pid
  done
}

process_is_cleanup_ancestor() {
  local candidate=$1
  local ancestor_pid
  for ancestor_pid in "${CLEANUP_ANCESTOR_PIDS[@]}"; do
    [ "$candidate" = "$ancestor_pid" ] && return 0
  done
  return 1
}

collect_cleanup_ancestors

# Return success only when a path is the project root or one of its descendants.
path_belongs_to_project() {
  local candidate=$1
  case "$candidate" in
    "$PROJECT_DIR" | "$PROJECT_DIR"/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Verify each matching process belongs to this project before presenting it as a
# cleanup candidate. Deny by default when its working directory does not
# establish ownership.
process_belongs_to_project() {
  local pid=$1
  local owned_pid

  while IFS= read -r owned_pid; do
    [ "$owned_pid" = "$pid" ] && return 0
  done < <(project_owned_pids "$pid")
  return 1
}

# Print the project-owned subset of a PID list, one PID per line. Batch the cwd
# lookup so broad patterns such as "chrome" do not fork lsof once per match.
project_owned_pids() {
  [ "$#" -gt 0 ] || return

  local current_pid=""
  local field
  local pid_list
  local IFS=,
  pid_list="$*"

  while IFS= read -r -d '' field; do
    # lsof terminates each process field set with a newline even in NUL mode.
    field=${field#$'\n'}
    case "$field" in
      p*) current_pid=${field#p} ;;
      n*)
        if [ -n "$current_pid" ] && path_belongs_to_project "${field#n}"; then
          printf '%s\n' "$current_pid"
        fi
        ;;
    esac
  done < <(lsof -a -p "$pid_list" -d cwd -Fpn0 2> /dev/null || true)
}

# Use xargs so kill is PATH-resolved instead of invoking Bash's kill builtin.
# Besides being portable, this preserves the subprocess seam used by tests.
signal_process() {
  local pid=$1
  printf '%s\n' "$pid" | xargs -n 1 kill -9 2> /dev/null
}

print_process_details() {
  local pid
  local cmd
  for pid in "$@"; do
    cmd=$(ps -p "$pid" -o command= 2> /dev/null | head -c 80)
    [ -n "$cmd" ] || cmd="unknown"
    echo "  PID $pid: $cmd"
  done
}

signal_project_processes() {
  local cleanup_source=$1
  shift
  local pid
  for pid in "$@"; do
    if process_belongs_to_project "$pid"; then
      if signal_process "$pid"; then
        KILLED_COUNT=$((KILLED_COUNT + 1))
      else
        FAILED_KILL_COUNT=$((FAILED_KILL_COUNT + 1))
      fi
    elif [ "$cleanup_source" = "port" ]; then
      SKIPPED_PORT_COUNT=$((SKIPPED_PORT_COUNT + 1))
    fi
  done
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
    else
      SKIPPED_PORT_COUNT=$((SKIPPED_PORT_COUNT + 1))
    fi
  done

  if [ "${#project_pids[@]}" -eq 0 ]; then
    return
  fi

  local count
  count=${#project_pids[@]}
  FOUND_COUNT=$((FOUND_COUNT + count))

  echo "Port $port: $count process(es)"
  print_process_details "${project_pids[@]}"

  if [ "$DRY_RUN" = false ]; then
    signal_project_processes "port" "${project_pids[@]}"
  fi
}

# Function to find and optionally kill processes by pattern (scoped to project)
cleanup_pattern() {
  local pattern=$1
  local pids
  local pgrep_status
  local candidate_pids=()
  local project_pids=()

  # A previous pattern-discovery error makes later sweeps unsafe. Preserve any
  # work already completed, then report it before exiting nonzero.
  if [ "$DISCOVERY_ERROR_STATUS" -ne 0 ]; then
    return 0
  fi

  if pids=$(pgrep -f -- "$pattern" 2> /dev/null); then
    :
  else
    pgrep_status=$?
    if [ "$pgrep_status" -eq 1 ]; then
      pids=""
    else
      echo "Error: pgrep failed for pattern '$pattern' (exit $pgrep_status); no matching processes were inspected or signaled for this pattern." >&2
      DISCOVERY_ERROR_STATUS=$pgrep_status
      return 0
    fi
  fi

  for pid in $pids; do
    if process_is_cleanup_ancestor "$pid"; then
      continue
    fi
    candidate_pids+=("$pid")
  done

  if [ "${#candidate_pids[@]}" -gt 0 ]; then
    while IFS= read -r pid; do
      [ -n "$pid" ] && project_pids+=("$pid")
    done < <(project_owned_pids "${candidate_pids[@]}")
  fi

  if [ "${#project_pids[@]}" -eq 0 ]; then
    return
  fi

  local count
  count=${#project_pids[@]}
  FOUND_COUNT=$((FOUND_COUNT + count))

  echo "Pattern '$pattern' (project-scoped): $count process(es)"
  print_process_details "${project_pids[@]}"

  if [ "$DRY_RUN" = false ]; then
    signal_project_processes "pattern" "${project_pids[@]}"
  fi
}

report_skipped_processes() {
  if [ "$SKIPPED_PORT_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}Skipped $SKIPPED_PORT_COUNT process(es) on detected ports; ownership was not verified for this project${NC}"
    echo "   A detected port may still be in use by another project"
  fi
}

# 1. Kill by port (dev server)
if [ -n "$PORT" ]; then
  cleanup_port "$PORT"

  # Also kill test port (dev port + 1000) when it remains in range.
  if [ -n "$TEST_PORT" ]; then
    cleanup_port "$TEST_PORT"
  fi
fi

# 2. Kill Playwright/test processes scoped to this project
cleanup_pattern "playwright"
cleanup_pattern "chromium"
cleanup_pattern "electron"

# 3. Kill framework-specific processes scoped to this project
case "$PATTERN" in
  "" | playwright | chromium | electron) ;;
  *) cleanup_pattern "$PATTERN" ;;
esac

# 4. Wait for cleanup
if [ "$DRY_RUN" = false ] && [ "$KILLED_COUNT" -gt 0 ]; then
  sleep 2
fi

# 5. Summary
echo ""
if [ "$FOUND_COUNT" -eq 0 ]; then
  if [ "$DISCOVERY_ERROR_STATUS" -ne 0 ]; then
    echo -e "${YELLOW}Cleanup incomplete: process discovery failed before any project-owned zombies were found${NC}"
    report_skipped_processes
  elif [ "$SKIPPED_PORT_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}No project-owned zombie processes found${NC}"
    report_skipped_processes
  else
    echo -e "${GREEN}No zombie processes found - already clean!${NC}"
  fi
elif [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}Found $FOUND_COUNT process(es) that would be killed${NC}"
  echo "   Re-run with --yes to kill them"
  report_skipped_processes
else
  echo -e "${GREEN}Killed $KILLED_COUNT process(es)${NC}"
  if [ "$FAILED_KILL_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}Failed to kill $FAILED_KILL_COUNT process(es)${NC}"
  fi
  report_skipped_processes

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

if [ "$DISCOVERY_ERROR_STATUS" -ne 0 ]; then
  exit "$DISCOVERY_ERROR_STATUS"
fi
