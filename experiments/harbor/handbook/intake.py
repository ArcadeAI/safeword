"""Compare the intake gate for a one-file CLI. Inspect preference handling manually."""

import argparse
import hashlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from intake.run import launch, prepare, resolve_revision, write_json
from intake.score import score

STARTER = """#!/usr/bin/env node
if (process.argv[2] === 'version') {
  console.log('1.0.0');
} else {
  console.error('Unknown command');
  process.exitCode = 1;
}
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ("base", "candidate"):
        parser.add_argument("--" + key, required=True)
    for key in ("comparison", "out"):
        parser.add_argument("--" + key, required=True, type=Path)
    args = parser.parse_args()
    args.out = args.out.resolve()
    args.out.mkdir(mode=0o700, parents=True, exist_ok=False)
    revisions = {
        arm: resolve_revision(getattr(args, arm)) for arm in ("base", "candidate")
    }
    futures = []
    with ThreadPoolExecutor(4) as pool:
        for arm, revision in revisions.items():
            for task, policy in (
                ("bookmark", "intake-bookmark-duplicate"),
                ("bookmark-specified", "intake-bookmark-specified"),
            ):
                lane = args.out / arm / task
                prepare(lane, args.comparison, revision, task)
                fixture = lane / "fixture"
                prompt = fixture / "instruction.md"
                text = prompt.read_text()
                original = "Build a single-user CLI"
                if text.count(original) != 1:
                    raise ValueError(
                        f"Expected one bookmark build instruction in {prompt}"
                    )
                prompt.write_text(
                    text.replace(original, "Extend the existing single-file CLI")
                )
                environment = fixture / "environment"
                (environment / "bookmarks.mjs").write_text(STARTER)
                with (environment / "Dockerfile").open("a") as dock:
                    dock.write(
                        "\nCOPY bookmarks.mjs ./\nRUN git add bookmarks.mjs && GIT_AUTHOR_DATE=2026-11-24T00:00:00Z GIT_COMMITTER_DATE=2026-11-24T00:00:00Z git -c user.name=Harbor -c user.email=fixture@example.invalid commit -qm 'Add version command'\n"
                    )
                write_json(
                    lane / "fixture-hashes.json",
                    {
                        str(p.relative_to(fixture)): hashlib.sha256(
                            p.read_bytes()
                        ).hexdigest()
                        for p in (
                            prompt,
                            environment / "bookmarks.mjs",
                            environment / "Dockerfile",
                        )
                    },
                )
                futures.extend(
                    (pool.submit(launch, lane, host, policy, 3), lane, policy)
                    for host in ("claude", "codex")
                )
        for future, lane, policy in futures:
            future.result()
    for lane, policy in {(lane, policy) for _, lane, policy in futures}:
        score(lane, [policy], product=False)


if __name__ == "__main__":
    main()
