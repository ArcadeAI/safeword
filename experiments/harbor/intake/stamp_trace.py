"""Preserve native events and record their observed arrival time by line."""

import sys
import time
from pathlib import Path

target = Path(sys.argv[1])
with (
    target.open("wb", buffering=0) as trace,
    target.with_suffix(".timings").open("w", buffering=1) as timings,
):
    timings.write(f"start {time.time_ns()}\n")
    for number, line in enumerate(sys.stdin.buffer, 1):
        timings.write(f"{number} {time.time_ns()}\n")
        trace.write(line)
        sys.stdout.buffer.write(line)
        sys.stdout.buffer.flush()
