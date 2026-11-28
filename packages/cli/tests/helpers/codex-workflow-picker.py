"""Observe the picker; only an owned isolated folder prompt may receive approval."""

import errno
import fcntl
import hashlib
import json
import os
import pty
import re
import select
import signal
import struct
import sys
import termios
import time
from pathlib import Path

ANSI = re.compile(rb"\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)")
FRAME_START = b"\x1b[?2026h"
FRAME_END = b"\x1b[?2026l"


def picker_frame(frame, name):
    """Require the queried picker and its result in one native redraw frame."""
    text = ANSI.sub(b"", frame).decode("utf8", errors="replace")
    if not frame.startswith(FRAME_START) or not frame.endswith(FRAME_END):
        return None
    if frame.count(FRAME_START) != 1 or frame.count(FRAME_END) != 1:
        return None
    if (
        text.count("$safeword:") != 1
        or not re.search(rf"\$safeword:{re.escape(name)}(?![\w:$-])", text)
        or "insert" not in text
        or "close" not in text
    ):
        return None
    offered = re.search(
        rf"\b{re.escape(name)}\s*\(safeword\)\s*\[Skill\]",
        text,
    )
    if offered:
        return {"query": f"$safeword:{name}", "offered": True, "output": text}
    if name == "testing" and re.search(r"no\s*matches", text, re.IGNORECASE):
        return {"query": "$safeword:testing", "offered": False, "output": text}
    return None


def observe(binary, output, isolated=False):
    root = Path(output)
    root.mkdir(parents=True, exist_ok=True)
    args = [
        binary,
        "--enable",
        "hooks",
        "--enable",
        "plugins",
        "--no-alt-screen",
        "-s",
        "workspace-write",
        "-a",
        "never",
    ]
    if isolated:
        args.insert(1, "--dangerously-bypass-hook-trust")
    (root / "picker-native-argv.json").write_text(json.dumps(args))
    pid, terminal = pty.fork()
    if pid == 0:
        os.environ["TERM"] = "xterm-256color"
        # Actor verifies the fixed reviewed fixture before this existing launch.
        os.execv(binary, args)  # noqa: S606, RUF100
    fcntl.ioctl(terminal, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 140, 0, 0))
    raw = bytearray()
    pending = bytearray()
    names = ["bdd", "explain", "testing"]
    observations = []
    index = -1
    awaiting_clear = False
    approval = None
    folder_pending = None
    project = (root / "project").resolve()
    deadline = time.monotonic() + 90
    try:
        while time.monotonic() < deadline:
            wait = max(0, min(1, deadline - time.monotonic()))
            if folder_pending is not None:
                wait = min(wait, max(0, folder_pending - time.monotonic()))
            ready, _, _ = select.select(
                [terminal],
                [],
                [],
                wait,
            )
            if not ready:
                if folder_pending is not None and time.monotonic() >= folder_pending:
                    if pending or index >= 0 or awaiting_clear:
                        raise RuntimeError(
                            "HOST_CONTRACT_PROOF_UNAVAILABLE: ambiguous folder prompt"
                        )
                    config = Path(os.environ["CODEX_HOME"]) / "config.toml"
                    approval = {
                        "project": str(project),
                        "beforeConfigSha256": hashlib.sha256(config.read_bytes()).hexdigest(),
                        "confirmed": False,
                    }
                    (root / "workspace-trust-action.json").write_text(json.dumps(approval))
                    folder_pending = None
                    os.write(terminal, b"\r")
                continue
            try:
                chunk = os.read(terminal, 65536)
            except OSError as error:
                if error.errno == errno.EIO:
                    break
                raise
            if not chunk:
                break
            raw.extend(chunk)
            pending.extend(chunk)
            # Answer terminal capability queries, never application prompts.
            for query, answer in [
                (b"\x1b[6n", b"\x1b[1;1R"),
                (b"\x1b[c", b"\x1b[?1;2c"),
                (b"\x1b[?u", b"\x1b[?0u"),
                (b"\x1b]10;?\x1b\\", b"\x1b]10;rgb:ffff/ffff/ffff\x1b\\"),
                (b"\x1b]11;?\x1b\\", b"\x1b]11;rgb:0000/0000/0000\x1b\\"),
            ]:
                if query in chunk:
                    os.write(terminal, answer)
            while FRAME_END in pending:
                completed, _, tail = pending.partition(FRAME_END)
                pending = bytearray(tail)
                start = completed.rfind(FRAME_START)
                if start < 0:
                    continue
                frame = completed[start:] + FRAME_END
                text = ANSI.sub(b"", frame).decode("utf8", errors="replace")
                prompt = (
                    r"\s*Folder access\s+"
                    + re.escape(str(project))
                    + r"\s+Trust this folder\? Codex can read, edit, and run files here,"
                    + r" subject to your permission settings\. Folder settings can run code\s+"
                    + r"automatically, even without a model request\. Continue only if you trust"
                    + r" these files\. Your trust decision will be saved\.\s*\u203a\s*1\."
                    + r"\s*Trust and continue\s*2\.\s*Back\s*to\s*Agent\s*Command"
                    + r"\s*Center\s*enter\s*continue\s*\u00b7\s*esc\s*back\s*"
                )
                if isolated and Path.cwd().resolve() == project and re.fullmatch(prompt, text):
                    if approval is not None or folder_pending is not None:
                        raise RuntimeError(
                            "HOST_CONTRACT_PROOF_UNAVAILABLE: repeated folder prompt"
                        )
                    if index >= 0 or awaiting_clear:
                        raise RuntimeError(
                            "HOST_CONTRACT_PROOF_UNAVAILABLE: folder prompt after picker query"
                        )
                    # Codex 0.167 draws before draining input (10ms quiet poll).
                    # Keep observing for 100ms; never send into a changed frame.
                    folder_pending = time.monotonic() + 0.1
                    continue
                if folder_pending is not None:
                    raise RuntimeError("HOST_CONTRACT_PROOF_UNAVAILABLE: unrelated native dialog")
                if re.search(
                    r"Update available|Do you trust|Trust this|trust.*(?:folder|directory)|"
                    r"approve.*hooks|Allow.*hooks",
                    text,
                    re.IGNORECASE,
                ):
                    raise RuntimeError("HOST_CONTRACT_PROOF_UNAVAILABLE: unrelated native dialog")
                if index < 0 or awaiting_clear:
                    if (
                        "\u203a Ask Codex to do anything" in text
                        and "$safeword:" not in text
                        and "insert" not in text
                        and "loading" not in text
                    ):
                        if approval is not None and not approval["confirmed"]:
                            approval.update(
                                confirmed=True,
                                afterConfigSha256=hashlib.sha256(config.read_bytes()).hexdigest(),
                            )
                            (root / "workspace-trust-action.json").write_text(json.dumps(approval))
                        index += 1
                        awaiting_clear = False
                        os.write(terminal, f"$safeword:{names[index]}".encode())
                    continue
                observation = picker_frame(frame, names[index])
                if observation is None:
                    continue
                observations.append(observation)
                if index == len(names) - 1:
                    (root / "picker-observations.json").write_text(
                        json.dumps(
                            {"method": "automated-native-tui", "queries": observations},
                            indent=2,
                        )
                    )
                    return
                # Standalone Ctrl-U clears the composer and closes its picker.
                # Wait for the empty composer redraw before sending another query.
                awaiting_clear = True
                os.write(terminal, b"\x15")
        reason = (
            "folder approval not confirmed"
            if approval is not None and not approval["confirmed"]
            else "native picker did not produce all three observations"
        )
        raise RuntimeError(f"HOST_CONTRACT_PROOF_UNAVAILABLE: {reason}")
    finally:
        (root / "picker-transcript.txt").write_bytes(raw)
        finished, _ = os.waitpid(pid, os.WNOHANG)
        if not finished:
            os.kill(pid, signal.SIGTERM)
            os.waitpid(pid, 0)
        os.close(terminal)


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[3] != "--dangerously-bypass-hook-trust":
        raise ValueError("unknown fixture mode")
    if len(sys.argv) not in (3, 4):
        raise ValueError("unexpected picker arguments")
    observe(sys.argv[1], sys.argv[2], len(sys.argv) == 4)
