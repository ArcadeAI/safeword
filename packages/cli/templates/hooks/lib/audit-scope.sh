#!/usr/bin/env bash
# Shared scope contract for /audit's separate Bash blocks.
# Source this file, then call audit_scope_initialize "$PROJECT_DIR".

audit_scope_initialize() {
  local project_dir="$1"

  AUDIT_SCOPE_REQUEST="${AUDIT_SCOPE_REQUEST:-diff}"
  AUDIT_SCOPE_MODE="repository"
  AUDIT_BASE_REF=""
  AUDIT_BASE_SHA=""
  AUDIT_CHANGED_FILES=""
  AUDIT_REFERENCE_ONLY_FILES=""

  if [ "$AUDIT_SCOPE_REQUEST" != "repository" ]; then
    if git -C "$project_dir" rev-parse --verify --quiet "origin/main^{commit}" > /dev/null; then
      AUDIT_BASE_REF="origin/main"
    elif git -C "$project_dir" rev-parse --verify --quiet "main^{commit}" > /dev/null; then
      AUDIT_BASE_REF="main"
    fi
  fi

  if [ -n "$AUDIT_BASE_REF" ]; then
    AUDIT_SCOPE_MODE="diff"
    AUDIT_BASE_SHA="$(git -C "$project_dir" merge-base "$AUDIT_BASE_REF" HEAD)"
    # These are safe analyzer inputs: current paths that Git or the working tree
    # can still read. Deleted and type-changed paths are kept separately for
    # reference review because analyzers cannot safely consume them.
    AUDIT_CHANGED_FILES="$({
      git -C "$project_dir" diff --name-only --diff-filter=ACMR --find-renames --merge-base "$AUDIT_BASE_REF"
      git -C "$project_dir" ls-files --others --exclude-standard
    } | LC_ALL=C sort -u)"
    AUDIT_REFERENCE_ONLY_FILES="$(git -C "$project_dir" diff --name-only --diff-filter=DT --merge-base "$AUDIT_BASE_REF" | LC_ALL=C sort -u)"
  fi
}

audit_scope_print() {
  if [ "$AUDIT_SCOPE_MODE" = "repository" ]; then
    if [ "$AUDIT_SCOPE_REQUEST" = "repository" ]; then
      echo "Audit scope: repository (explicit user request; full audit retained)"
    else
      echo "Audit scope: repository (no origin/main or main ref; full audit retained)"
    fi
    return
  fi

  echo "Audit scope: $AUDIT_BASE_REF (merge base: $AUDIT_BASE_SHA)"
  if [ -n "$AUDIT_CHANGED_FILES" ]; then
    printf '%s\n' "$AUDIT_CHANGED_FILES" | sed 's/^/  - /'
  else
    echo "  - No added, copied, modified, renamed, or untracked files"
  fi
  if [ -n "$AUDIT_REFERENCE_ONLY_FILES" ]; then
    echo "Reference review scope:"
    printf '%s\n' "$AUDIT_REFERENCE_ONLY_FILES" | sed 's/^/  - /'
  fi
}

audit_scope_has_path_matching() {
  [ -n "$AUDIT_CHANGED_FILES" ] && printf '%s\n' "$AUDIT_CHANGED_FILES" | grep -Eq "$1"
}

audit_scope_files_matching() {
  [ -n "$AUDIT_CHANGED_FILES" ] && printf '%s\n' "$AUDIT_CHANGED_FILES" | grep -E "$1"
}

audit_scope_has_review_path_matching() {
  {
    printf '%s\n' "$AUDIT_CHANGED_FILES"
    printf '%s\n' "$AUDIT_REFERENCE_ONLY_FILES"
  } | grep -Eq "$1"
}

audit_scope_path_changed() {
  [ -n "$AUDIT_CHANGED_FILES" ] && printf '%s\n' "$AUDIT_CHANGED_FILES" | grep -qxF -- "$1"
}

audit_scope_dir_changed() {
  local scope_directory="${1#./}"
  [ "$scope_directory" = "." ] && [ -n "$AUDIT_CHANGED_FILES" ] && return 0
  while IFS= read -r scope_file; do
    case "$scope_file" in
      "$scope_directory"/*) return 0 ;;
    esac
  done << EOF
$AUDIT_CHANGED_FILES
EOF
  return 1
}

filter_audit_dirs_to_diff() {
  while IFS= read -r scope_dir; do
    [ -n "$scope_dir" ] || continue
    audit_scope_dir_changed "$scope_dir" && printf '%s\n' "$scope_dir"
  done
}
