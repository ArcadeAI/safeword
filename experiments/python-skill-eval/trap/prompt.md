Implement `fetch_all` in Python (3.11+).

Signature:

    from typing import Awaitable, Callable

    async def fetch_all(
        urls: list[str],
        fetch: Callable[[str], Awaitable[str]],
    ) -> list[str]:
        ...

Behavior:

- Fetch all `urls` concurrently by awaiting `fetch(url)` for each url.
- Return the results as a list, in the SAME ORDER as `urls`.
- Fail-fast: if any `fetch(url)` raises, stop immediately — cancel the other
  in-flight fetches (do not leave them running) and propagate the failure to the
  caller. No fetch should still be running after `fetch_all` has returned.

Return ONLY the contents of a single file `solution.py` (imports + the function
definition). No prose, no explanation, no markdown fences.
