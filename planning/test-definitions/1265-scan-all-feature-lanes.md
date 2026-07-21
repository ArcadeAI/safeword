# Test definitions: Issue 1265

## E008 workspace-lane coverage

Given a populated surface inventory and an undefined surface tag in `packages/cli/features/`, when the audit domain-documentation check runs, then it reports E008 and the undefined slug.

## Shared directory resolution

Given a project with root, workspace, and configured feature lanes, when `safeword feature-directories` runs, then it prints the directory set used by executable feature discovery.
