from typing import Awaitable, Callable
import asyncio


async def fetch_all(
    urls: list[str],
    fetch: Callable[[str], Awaitable[str]],
) -> list[str]:
    if not urls:
        return []

    tasks = [asyncio.ensure_future(fetch(url)) for url in urls]
    try:
        return await asyncio.gather(*tasks)
    except BaseException:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        raise
