"""Host-side relay for Claude's turn-ending messages in a Harbor trial."""

import asyncio
import json
import os
from pathlib import Path

CONTINUE_PROMPT = "Continue with your next step."


def answer_key_reply(message: str) -> str | None:
    key = os.environ.get("SAFEWORD_EVAL_ANSWER_KEY")
    if not key:
        return None
    entries = json.loads(Path(key).read_text())
    answers = entries.get(os.environ.get("SAFEWORD_EVAL_TASK"), {})
    reply = answers.get(message.strip())
    if reply is None:
        questions = [
            line.strip().rsplit("?", 1)[0] + "?" for line in message.splitlines() if "?" in line
        ]
        matched = [answers.get(question) for question in questions]
        if matched and matched[0] and all(answer == matched[0] for answer in matched):
            reply = matched[0]
    if reply is not None and (not isinstance(reply, str) or not reply.strip()):
        raise ValueError("An answer-key reply must be nonempty text")
    return reply


def read_action(response: Path) -> tuple[str, str | None]:
    data = json.loads(response.read_text())
    if not isinstance(data, dict):
        raise TypeError(f"{response} must contain a JSON object")
    if "action" not in data and "reply" in data:
        action = "finish" if data["reply"] is None else "reply"
    else:
        action = data.get("action")
    reply = data.get("reply")
    if action == "reply" and isinstance(reply, str) and reply.strip():
        return action, reply
    if action in ("continue", "finish") and reply is None:
        return action, None
    raise ValueError(f"{response} must specify reply with text, continue, or finish")


async def request_action(directory: Path, checkpoint: int, message: str) -> tuple[str, str | None]:
    directory.mkdir(parents=True, exist_ok=True)
    request = directory / f"{checkpoint:02d}-request.md"
    response = directory / f"{checkpoint:02d}-response.json"
    pending = request.with_suffix(".tmp")
    pending.write_text(message)
    pending.replace(request)
    case = os.environ.get("SAFEWORD_EVAL_TASK", "")
    from intake.decisions import operator_decision, policy, remember, route
    spec = policy(case) if os.environ.get("SAFEWORD_EVAL_DECISIONS") == "1" else None
    details = {}
    if spec:
        key = os.environ.get("SAFEWORD_EVAL_ANSWER_KEY")
        entries = json.loads(Path(key).read_text()).get(case, {}) if key else {}
        reply = entries.get(message.strip()) or remember(case, message)
        if reply is not None and (not isinstance(reply, str) or not reply.strip()):
            raise ValueError("An answer-key reply must be nonempty text")
        source = "saved-answer"
        if not reply:
            try:
                reply, kind, meter = await asyncio.to_thread(route, message, spec)
            except (ValueError, OSError, KeyError, TypeError):
                reply, kind, meter = None, "unknown", {}
            details = {"kind": kind, "interpreter": meter}
            source = "routine-approval" if kind == "approval" else "decision-key"
        if details.get("kind") == "handoff":
            (directory / f"{checkpoint:02d}-routing.json").write_text(json.dumps(
                {**details, "operator_needed": False, "source": "continue"}))
            response.write_text(json.dumps({"action": "continue", "source": "continue"}))
            return "continue", None
        if not reply:
            return await operator_decision(directory, checkpoint, case, message, response, details)
        audit = directory / f"{checkpoint:02d}-routing.json"
        audit.write_text(json.dumps({**details, "operator_needed": False, "source": source}))
    else:
        reply = answer_key_reply(message)
        source = "answer-key"
    if reply:
        pending = response.with_suffix(".tmp")
        pending.write_text(json.dumps({"action": "reply", "reply": reply, "source": source}))
        pending.replace(response)
        return "reply", reply
    print(f"Awaiting relay decision: {request}", flush=True)
    while not response.exists():
        await asyncio.sleep(1)
    return read_action(response)


def trace_events(log_path: Path):
    if not log_path.is_file():
        return
    with log_path.open() as stream:
        for line_number, line in enumerate(stream, 1):
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(event, dict):
                yield line_number, event


def unique_trace_events(paths):
    """Read overlapping trace files once per UUID, retaining unkeyed events."""
    seen = set()
    for path in paths:
        for line, event in trace_events(path):
            event_id = event.get("uuid")
            if event_id:
                if event_id in seen:
                    continue
                seen.add(event_id)
            yield event, f"{path}:{line}"


def result_events(log_path: Path):
    for _, event in trace_events(log_path):
        if event.get("type") == "result":
            yield event


def final_result(log_path: Path) -> dict:
    result = {}
    for event in result_events(log_path):
        result = event
    return result
