#!/usr/bin/env python3
"""Deterministic grader for the structured-concurrency (fail-fast) trap.

Grades BEHAVIOR, not API choice. The discriminating question: when one fetch
fails, does `fetch_all` CANCEL the other in-flight fetches, or do they leak and
keep running? `asyncio.TaskGroup` cancels siblings on failure; a bare
`asyncio.gather(*tasks)` propagates the first exception but leaves siblings
running (orphaned). A correct MANUAL cancellation solution also PASSES — we grade
the observable effect (was the sibling cancelled?), never the vocabulary. This is
the grader-independence discipline: no grep for skill terms, no LLM judge.

Usage:  python grade.py path/to/solution.py   -> prints PASS/FAIL, exits 0/1
"""

import asyncio
import importlib.util
import pathlib
import sys
import time


def load(path: str):
    spec = importlib.util.spec_from_file_location("candidate", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def detect_api(src: str) -> str:
    """Informational only — NOT part of the grade. Records which API was reached for."""
    markers = {
        "TaskGroup": "TaskGroup",
        "gather": ".gather(",
        "wait": "asyncio.wait(",  # not bare "wait" — that matches "await"
        "as_completed": "as_completed",
    }
    apis = [name for name, needle in markers.items() if needle in src]
    return "+".join(apis) if apis else "?"


async def run_checks(fetch_all) -> tuple[bool, str]:
    # --- success path: all succeed, results returned in input order ---
    async def ok_fetch(url: str) -> str:
        await asyncio.sleep(0.01)
        return url.upper()

    result = await fetch_all(["a", "b", "c"], ok_fetch)
    if list(result) != ["A", "B", "C"]:
        return False, f"success-path wrong or unordered: {result!r}"

    # --- fail-fast path: one fetch fails fast, the slow sibling must be cancelled ---
    completed: list[str] = []

    async def trap_fetch(url: str) -> str:
        if url == "boom":
            await asyncio.sleep(0.01)
            raise ValueError("boom")
        await asyncio.sleep(1.0)  # the slow sibling
        completed.append(url)  # only runs if it was NOT cancelled
        return url

    start = time.monotonic()
    raised: BaseException | None = None
    try:
        await fetch_all(["boom", "slow"], trap_fetch)
    except BaseException as error:  # ValueError, or ExceptionGroup from TaskGroup
        raised = error
    elapsed = time.monotonic() - start

    # Let any ORPHANED (uncancelled) sibling run to completion so the leak is
    # observable — a bare-gather solution returns at ~0.01s but its sibling lives on.
    await asyncio.sleep(1.3)

    if raised is None:
        return False, "no exception propagated when a fetch failed (e.g. gather(return_exceptions=True))"
    if completed:
        return False, "sibling NOT cancelled — it leaked to completion (bare-gather bug)"
    if elapsed > 0.5:
        return False, f"did not fail fast (elapsed {elapsed:.2f}s)"
    return True, "siblings cancelled + failed fast"


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: python grade.py <solution.py>")
        sys.exit(2)
    path = sys.argv[1]
    src = pathlib.Path(path).read_text()
    try:
        module = load(path)
    except Exception as error:  # noqa: BLE001 — a broken candidate is a FAIL, not a crash
        print(f"FAIL [load-error] {path}: {error!r}")
        sys.exit(1)
    if not hasattr(module, "fetch_all"):
        print(f"FAIL [no-fetch_all] {path}: module defines no `fetch_all`")
        sys.exit(1)
    try:
        ok, reason = asyncio.run(run_checks(module.fetch_all))
    except Exception as error:  # noqa: BLE001
        print(f"FAIL [runtime-error] [{detect_api(src)}] {path}: {error!r}")
        sys.exit(1)
    print(f"{'PASS' if ok else 'FAIL'} [{detect_api(src)}] {path}: {reason}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
