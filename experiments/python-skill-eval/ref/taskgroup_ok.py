"""Reference: structured concurrency via TaskGroup — must PASS the grader."""

import asyncio
from typing import Awaitable, Callable


async def fetch_all(
    urls: list[str],
    fetch: Callable[[str], Awaitable[str]],
) -> list[str]:
    results: list[str | None] = [None] * len(urls)

    async def run(index: int, url: str) -> None:
        results[index] = await fetch(url)

    async with asyncio.TaskGroup() as group:
        for index, url in enumerate(urls):
            group.create_task(run(index, url))

    return [value for value in results if value is not None]
