---
id: 012
type: feature
phase: intake
status: superseded
parent: null
created: 2026-01-07T23:11:00Z
last_modified: 2026-06-03T19:05:00.000Z
---

# Auto-Update Notifications

**Goal:** Notify users when safeword updates are available without requiring manual `safeword check`.

## Background

Currently users must manually run `safeword check` to discover updates. The version-checking infrastructure exists (`checkLatestVersion()` in check.ts) but only runs on explicit command.

## Scope

**In Scope:**

1. **Startup update check** - Non-blocking background check on CLI commands
2. **Result caching** - Avoid repeated network calls (check once per 24h)
3. **End-of-output notification** - Subtle message when update available
4. **Offline handling** - Respect `--offline` flag, fail silently on network errors

**Out of Scope:**

- Auto-upgrade config option (future enhancement)
- CLI binary self-update (complex, platform-specific)
- Breaking change detection / changelog integration

## Implementation Notes

### Notification Display

```
✓ Setup complete

💡 Update available: v0.15.6 → v0.16.0
   Run `safeword upgrade` to update project configuration
```

### Cache Location

Store in `.safeword/.update-cache.json` (gitignored):

```json
{
  "lastCheck": "2026-01-07T23:00:00Z",
  "latestVersion": "0.16.0"
}
```

### Key Files

- `packages/cli/src/commands/check.ts:78-98` - existing `checkLatestVersion()`
- `packages/cli/src/utils/version.ts` - version comparison utilities
- `packages/cli/src/cli.ts` - CLI entry point

## Acceptance Criteria

- [ ] Update check runs async on CLI startup (non-blocking)
- [ ] Results cached for 24 hours
- [ ] Notification displayed after command output completes
- [ ] Silent failure on network errors
- [ ] Respects `--offline` flag
- [ ] CLI auto-adds cache file to project's `.gitignore` when creating it

## Work Log

- 2026-06-03T19:05:00.000Z Closed (superseded) via ticket-triage: superseded by 081 (session-start auto-upgrade absorbs the notification).
