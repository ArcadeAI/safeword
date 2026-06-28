async def fetch_all(
    urls,
    fetch,
):
    import asyncio
    from typing import Awaitable, Callable

    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch(url)) for url in urls]
    return [task.result() for task in tasks]
