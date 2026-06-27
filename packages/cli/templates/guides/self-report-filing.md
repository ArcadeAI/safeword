# Self-Report Filing

**Triggered playbook.** Follow this when the Stop surfacing says _"Filing is enabled
(`selfReport.file`)"_ — i.e. safeword captured its own internal signals this session
and the project opted into filing. If filing is not enabled, do nothing here.

Safeword records its **own** runtime failures (non-zero CLI exits + uncaught hook
exceptions) to a sanitized, zero-egress spool. This playbook turns those into
GitHub issues on the safeword repo. You only do **transport** — the records and the
issue drafts are already sanitized at capture (allowlist-only; no customer data).

## Procedure

1. **Get the drafts.** Run:

   ```bash
   safeword self-report --format issue
   ```

   This prints a JSON array; each element is `{ signature, title, body, labels }`,
   one per distinct failure signature, already sanitized.

2. **Dedup, then file — one issue per signature.** For each draft:
   - Search the safeword repo's issues for the draft's exact `title`
     (e.g. GitHub MCP `search_issues` with `repo:<owner>/safeword "<title>"`, or
     `gh issue list --search "<title>"`). Transport is your choice — MCP or `gh`.
   - **If an open issue with that title exists** → add a brief comment noting it
     recurred (include the occurrence count from the draft body). Do **not** open a
     duplicate.
   - **If none exists** → open a new issue with the draft's `title`, `body`, and
     `labels` verbatim. Don't edit the body to add detail you didn't capture.

3. **Respect the cap.** File at most **one issue per signature per session**, and
   no more than **5 new issues in a single session** — if there are more distinct
   signatures than that, file the top 5 by occurrence count and note in your reply
   that the rest were left for a later session. This prevents a crash-loop from
   flooding the tracker.

## Rules

- **Never** add anything to the issue beyond what the draft contains. The draft is
  the sanitized surface; hand-adding context (paths, code, command output) defeats
  the whole point and can leak customer data.
- **Never** file in a customer repo unless `selfReport.file` is `true` in their
  `.safeword/config.json`. The default is off; surfacing without filing is the
  norm.
- If you're unsure whether a signal is worth filing, prefer **commenting on an
  existing issue** over opening a new one.

## Config

`.safeword/config.json` → `selfReport`:

```json
{ "selfReport": { "capture": true, "surface": true, "file": false } }
```

- `capture` (default `true`) — record signals to the local spool.
- `surface` (default `true`) — mention captured signals at the end of a turn.
- `file` (default `false`) — opt in to this filing playbook.
