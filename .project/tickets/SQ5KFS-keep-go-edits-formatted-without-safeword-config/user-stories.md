# User stories — SQ5KFS

## Keep a Go edit responsive when optional Safe Word configuration is missing

As a developer editing a Go project, I want the post-edit hook to format my file
without waiting for a configuration repair, so that a missing optional Safe Word
config does not make the edit appear to fail.

### Acceptance criteria

- Given `golangci-lint` is installed and `.safeword/.golangci.yml` is absent,
  when the post-edit hook receives a Go file, then the file is formatted.
- The hook does not invoke `bunx safeword@latest upgrade` before that fallback.
- Projects that still have `.safeword/.golangci.yml` retain the existing strict
  config-backed behavior.
