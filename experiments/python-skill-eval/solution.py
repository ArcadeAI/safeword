import asyncio
from typing import Any, Callable, Coroutine


async def fetch_all(
    urls: list[str],
    fetch: Callable[[str], Coroutine[Any, Any, str]],
) -> list[str]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch(url)) for url in urls]
    return [task.result() for task in tasks]
