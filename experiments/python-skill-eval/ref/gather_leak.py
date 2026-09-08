"""Reference: the default mistake — bare gather leaks siblings. Must FAIL the grader."""

import asyncio
from typing import Any, Callable, Coroutine


async def fetch_all(
    urls: list[str],
    fetch: Callable[[str], Coroutine[Any, Any, str]],
) -> list[str]:
    tasks = [asyncio.create_task(fetch(url)) for url in urls]
    # gather propagates the first exception but does NOT cancel the other tasks —
    # they keep running, orphaned.
    return list(await asyncio.gather(*tasks))
