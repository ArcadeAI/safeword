"""Pair supplied and hidden preferences when extending an existing one-file CLI."""

import argparse
import hashlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from intake.run import launch, prepare, write_json
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
    futures = []
    with ThreadPoolExecutor(4) as pool:
        for arm in ("base", "candidate"):
            for task, policy in (
                ("bookmark", "intake-bookmark-duplicate"),
                ("bookmark-specified", "intake-bookmark-specified"),
            ):
                lane = args.out / arm / task
                prepare(lane, args.comparison, getattr(args, arm), task)
                fixture = lane / "fixture"
                prompt = fixture / "instruction.md"
                prompt.write_text(
                    prompt.read_text().replace(
                        "Build a single-user CLI", "Extend the existing single-file CLI"
                    )
                )
                environment = fixture / "environment"
                (environment / "bookmarks.mjs").write_text(STARTER)
                with (environment / "Dockerfile").open("a") as dock:
                    dock.write(
                        "\nCOPY bookmarks.mjs ./\nRUN git add bookmarks.mjs && git -c user.name=Harbor -c user.email=fixture@example.invalid commit -qm 'Add version command'\n"
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
        score(lane, [policy], False)


if __name__ == "__main__":
    main()
