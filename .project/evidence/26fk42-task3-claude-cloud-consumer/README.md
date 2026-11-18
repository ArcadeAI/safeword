# 26FK42 Task 3: Claude Cloud consumer handoff

Consumer half of the execution-plan Task 3 checkpoint for
`resolve-disputed-plan-findings (26FK42)`, run in a separate, fresh Claude Code
Cloud VM. The producer half is on branch
`claude/26fk42-task3-producer-fixture-j6s1vk` at `0680150e4`.

**Result:** the consumer recovered the same pending question from the handed-off
ticket alone. It held no producer key and no review job, and approval did not
change.

**Simulation:** the reviewer was simulated in the producer only. The cloud
hosts, the branch handoff and this consumer run are real.

## Identity

| | Producer | Consumer |
| --- | --- | --- |
| Session | `session_01ES15yUL83q2HYXYcvyibyD` | `session_01ES15yWX896qjmZSgdKpJf8` |
| Container | `container_01SennFwQx5qnp8EVbQBrKTm` | `container_01MnNWeUBkpQjFmTCjmQ4TKB` |
| Boot ID | `52cccf7b-8770-45e8-bff3-14a84ebcb13d` | `78bd0baa-5180-4ed5-aa45-74ab3612e11c` |
| Kernel | `6.18.44-fc-v553` | `6.18.44-fc-v595` |

Both used environment `env_012M8RUtKt8w3FpdxLiJUSyA`.

## What ran

1. A normal fetch of the producer branch. The archive SHA-256 matched
   `76d96a90…f0ea7a`, and all 14 `SHA256SUMS` entries passed.
2. The four files in `fixture_path_map` were copied into an empty disposable
   directory. Nothing else was seeded: no `.safeword` state, no job and no key.
3. The CLI was built at `dc5033ddd`, which descends from GREEN `032f5525b`,
   using `scripts/dev` (Bun 1.4.4, Node 24.18.1). Its `dist/cli.js` SHA-256 is
   `91c9810b…af43b`, identical to the producer's.
4. The following command ran with cwd set to the fixture, empty stdin and a
   5000 ms timeout:

   ```text
   node packages/cli/dist/cli.js ticket record-review-disposition PEN123 \
     c3a6e35a-738e-441e-9492-a1519f74f66d 1 \
     --reason "The accepted Product Plan says: No optional audit export." \
     --cwd <fixture-root> --json --no-input
   ```

   The environment was `NODE_ENV=test`, `SAFEWORD_AGENT_RUNTIME=codex` and
   `SAFEWORD_REVIEW_KEY_ROOT=<fresh empty dir>`, the same variables the producer
   used.

## Outcome

- The command exited 2 in 146 ms with `action_required`, `pending` and
  `pending-user-decision`.
- The question, reason, action, finding and review ID are byte-identical to the
  producer's. The only stdout differences are `changed: false` and no file write
  (`raw/producer-vs-consumer.stdout.diff`).
- The ticket (`422fda95…`) and plan (`2430088b…`) are unchanged.
  `design_approval` is absent.
- No integrity key or review job existed before or after the run. A
  filesystem-wide search found 0 `review-integrity.key` files both times. No
  terminal approval was attempted.

## Files

- `MANIFEST.json`: identity, hashes, command and result.
- `raw/consumer-run.json`: timestamps, probes taken before and after, and 19
  checks.
- `raw/consumer.stdout.json` and `raw/consumer.stderr.txt` (empty): the
  command's output.
- `driver/consumer.mjs.txt`: the disposable driver. It is not a committed test.
- `logs/provisioning-failures.txt`: the mise install workarounds.
- `SHA256SUMS`: hashes for every file above.

## Not proven

- Destruction of the original runner is untested. On 2026-11-17 the user
  accepted a separate fresh-VM recovery instead.
- Cursor Cloud Agents, native-local hosts and the NTB evidence are not covered.
  Tasks 4–8 remain.
- Historical failures, the missing RED records and the 33 deferred cases are
  unchanged.
- This run does not show that the wider feature is complete.
