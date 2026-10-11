# ruff: noqa: T201, S311  (CLI script prints progress; seeded sampling is not crypto)
"""Sort open Safeword retro issues into root causes and rank gates by wrong blocks (#5750).

Read-only against GitHub: issues are fetched, never edited or closed.

Passes:
  label     one structured label per issue (Opus 5.5, low effort, Batch API)
  taxonomy  merge labels into ~20 root causes (Opus 5.5, high effort, one call)
  assign    put each issue in one root cause (Opus 5.5, low effort, Batch API)
  report    deterministic counts -> report.md

Runs through OpenRouter's Batch API (/v1/messages shape, :batch pricing = half the standard rate).

Usage (from repo root; every pass except report spends tokens):
  OPENROUTER_API_KEY="$(security find-generic-password -s openrouter-api-key -w)" \
    python3 experiments/retro-root-causes/sort.py <pass> [--sample N]

Input: data/issues.jsonl (gh api --paginate .../issues?state=open&labels=retro).
"""

import argparse
import collections
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

MODEL = "anthropic/claude-opus-5.5"
API = "https://openrouter.ai/api/v1"
CHUNK = 400  # requests per submitted batch
HERE = Path(__file__).parent
DATA = HERE / "data"
# :batch variant is half the standard Opus 5.5 rate ($4 / $20 per MTok).
PRICE_IN, PRICE_OUT = 2.0 / 1e6, 10.0 / 1e6

KINDS = [
    "wrong_block",  # a gate, guard or check refused legitimate work
    "right_block_bad_message",  # the block was correct, but its message misled or confused
    "extra_toil",  # forced extra reviews, steps, re-runs or hand edits with no added value
    "bug",  # crash, wrong result, broken script or state
    "missing_capability",  # Safeword lacks something the agent needed
    "environment",  # flaky tests, timeouts, tooling or host quirks outside Safeword logic
    "other",
]

LABEL_SCHEMA = {
    "type": "object",
    "properties": {
        "mechanism": {
            "type": "string",
            "description": (
                "Canonical name of the Safeword component involved, 2-6 words, e.g. "
                "'stop-hook handoff check', 'review stamp', 'test-definitions ledger guard'."
            ),
        },
        "kind": {"type": "string", "enum": KINDS},
        "blocked_legitimate_work": {
            "type": "boolean",
            "description": (
                "True only if Safeword stopped or refused work that was correct "
                "and should have been allowed."
            ),
        },
        "root_cause": {
            "type": "string",
            "description": "One general sentence on WHY this happens, not the symptom.",
        },
        "host": {"type": "string", "enum": ["claude", "codex", "cursor", "opencode", "unknown"]},
        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
    },
    "required": [
        "mechanism",
        "kind",
        "blocked_legitimate_work",
        "root_cause",
        "host",
        "confidence",
    ],
    "additionalProperties": False,
}

LABEL_SYSTEM = f"""You label friction reports that coding agents filed about Safeword,
a CLI that installs quality gates, hooks and skills into AI coding agents
(Claude Code, Codex, Cursor, OpenCode).

Each report is one issue. Return exactly one label.

kind values:
{chr(10).join("- " + k for k in KINDS)}

Rules:
- blocked_legitimate_work is true only when a Safeword gate/guard/check stopped correct work.
  A correct block with a confusing message is right_block_bad_message and false.
- The report was written by an agent about its own session; it may be wrong or self-serving.
  Judge from the described facts, and lower confidence when the facts are thin.
- mechanism must be a stable, reusable component name: same component, same name."""


def load_issues() -> list[dict]:
    return [json.loads(line) for line in (DATA / "issues.jsonl").open()]


def issue_text(issue: dict) -> str:
    body = re.sub(r"<!--.*?-->|<sub>.*?</sub>", "", issue["body"] or "", flags=re.DOTALL).strip()
    return f"#{issue['number']} {issue['title']}\n\n{body}"


def json_params(system: str, user: str, schema: dict, effort: str, max_tokens: int) -> dict:
    return {
        "max_tokens": max_tokens,
        "output_config": {"effort": effort, "format": {"type": "json_schema", "schema": schema}},
        "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": user}],
    }


def api(method: str, path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(  # noqa: S310 (fixed https URL)
        f"{API}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=300) as resp:  # noqa: S310 (fixed https URL)
        return json.loads(resp.read())


def submit_and_wait(chunk: dict[str, dict]) -> list[dict]:
    batch = api(
        "POST",
        "/batches",
        {
            "endpoint": "/v1/messages",
            "model": MODEL,
            "completion_window": "24h",
            "requests": [{"custom_id": cid, "body": body} for cid, body in chunk.items()],
        },
    )
    print(f"  batch {batch['id']}: {len(chunk)} requests", flush=True)
    return wait(batch["id"])


def wait(batch_id: str) -> list[dict]:
    misses = 0
    while True:
        try:
            batch = api("GET", f"/batches/{batch_id}")
        except urllib.error.HTTPError as e:
            # A just-submitted batch can 404 for a short while before it is visible.
            if e.code != 404 or (misses := misses + 1) > 20:
                raise
            time.sleep(15)
            continue
        if batch["status"] in TERMINAL:
            break
        c = batch.get("request_counts") or {}
        print(
            f"  {batch['status']} completed={c.get('completed')} failed={c.get('failed')}",
            flush=True,
        )
        time.sleep(30)
    if batch["status"] != "completed":
        sys.exit(f"batch {batch['id']} ended {batch['status']}")
    return batch["results"]


TERMINAL = {"completed", "failed", "expired", "cancelled"}


def run_batch(name: str, params_by_id: dict[str, dict]) -> dict[str, dict]:
    """Submit in chunks, wait, save parsed JSON outputs to data/<name>.json."""
    out: dict[str, dict] = {}
    tokens_in = tokens_out = 0
    ids = list(params_by_id)
    print(f"{name}: {len(ids)} requests", flush=True)
    for i in range(0, len(ids), CHUNK):
        for r in submit_and_wait({cid: params_by_id[cid] for cid in ids[i : i + CHUNK]}):
            resp = r.get("response") or {}
            msg = resp.get("body") or {}
            if r.get("error") or resp.get("status_code") != 200:
                print(
                    f"  {r['custom_id']}: {r.get('error') or resp.get('status_code')}",
                    file=sys.stderr,
                )
                continue
            u = msg.get("usage", {})
            tokens_in += sum(
                u.get(k) or 0
                for k in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")
            )
            tokens_out += u.get("output_tokens") or 0
            if msg.get("stop_reason") != "end_turn":
                print(f"  {r['custom_id']}: stop_reason={msg.get('stop_reason')}", file=sys.stderr)
                continue
            text = next(b["text"] for b in msg["content"] if b["type"] == "text")
            out[r["custom_id"]] = json.loads(text)
    cost = tokens_in * PRICE_IN + tokens_out * PRICE_OUT
    print(
        f"{name}: {len(out)}/{len(ids)} ok, in={tokens_in} out={tokens_out}, "
        f"~${cost:.2f} (upper bound, ignores cache discount)"
    )
    (DATA / f"{name}.json").write_text(json.dumps(out, indent=1))
    return out


def cmd_label(sample: int | None) -> None:
    issues = load_issues()
    if sample:
        issues = random.Random(5750).sample(issues, sample)
    name = f"labels-sample{sample}" if sample else "labels"
    params = {
        str(i["number"]): json_params(LABEL_SYSTEM, issue_text(i), LABEL_SCHEMA, "low", 4096)
        for i in issues
    }
    run_batch(name, params)
    if sample:
        print(
            f"full run is {len(load_issues())} issues: x{len(load_issues()) / sample:.0f} this cost"
        )


TAXONOMY_SCHEMA = {
    "type": "object",
    "properties": {
        "causes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "short kebab-case id"},
                    "name": {"type": "string"},
                    "description": {
                        "type": "string",
                        "description": "2 sentences: the shared cause, and what fixing it changes",
                    },
                    "mechanisms": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["id", "name", "description", "mechanisms"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["causes"],
    "additionalProperties": False,
}


def compact_labels(labels: dict[str, dict]) -> str:
    return "\n".join(
        f"#{n} | {lab['mechanism']} | {lab['kind']} | "
        f"blocked={lab['blocked_legitimate_work']} | {lab['root_cause']}"
        for n, lab in sorted(labels.items(), key=lambda kv: int(kv[0]))
    )


def cmd_taxonomy() -> None:
    labels = json.loads((DATA / "labels.json").read_text())
    system = """You build a root-cause taxonomy for Safeword maintainers from per-issue labels.
Produce 15-25 root causes that together cover nearly every label. Merge causes a single fix
would address; split causes that need different fixes. Prefer causes named by the underlying
design problem (e.g. 'review stamps invalidated by their own bookkeeping edits'),
not by file name. Include one 'other' cause for the long tail."""
    params = json_params(system, compact_labels(labels), TAXONOMY_SCHEMA, "high", 64000)
    result = run_batch("taxonomy-raw", {"taxonomy": params})
    (DATA / "taxonomy.json").write_text(json.dumps(result["taxonomy"], indent=1))


def cmd_assign() -> None:
    labels = json.loads((DATA / "labels.json").read_text())
    causes = json.loads((DATA / "taxonomy.json").read_text())["causes"]
    ids = [c["id"] for c in causes]
    schema = {
        "type": "object",
        "properties": {"cause": {"type": "string", "enum": ids}},
        "required": ["cause"],
        "additionalProperties": False,
    }
    system = "Assign the issue to exactly one root cause. Root causes:\n\n" + "\n\n".join(
        f"{c['id']}: {c['name']}\n{c['description']}\n"
        f"Typical mechanisms: {', '.join(c['mechanisms'])}"
        for c in causes
    )
    by_number = {str(i["number"]): i for i in load_issues()}
    params = {
        n: json_params(
            system, f"{issue_text(by_number[n])}\n\nLabel: {json.dumps(lab)}", schema, "low", 2048
        )
        for n, lab in labels.items()
    }
    run_batch("assignments", params)


def cmd_report() -> None:
    issues = {str(i["number"]): i for i in load_issues()}
    labels = json.loads((DATA / "labels.json").read_text())
    causes = {c["id"]: c for c in json.loads((DATA / "taxonomy.json").read_text())["causes"]}
    assignments = json.loads((DATA / "assignments.json").read_text())
    assign = {n: a["cause"] for n, a in assignments.items()}

    lines = [
        "# Retro root causes (#5750)",
        "",
        (
            f"{len(labels)} of {len(issues)} open retro issues labelled; "
            f"{len(assign)} assigned to a root cause."
        ),
        (
            "Labels are Opus 5.5 judgments over agent-written reports; "
            "read the spot check before trusting counts."
        ),
        "",
        "## Root causes, by issue count",
        "",
        "| # | Root cause | Issues | Wrong blocks | Share | Top mechanisms | Examples |",
        "|---|---|---|---|---|---|---|",
    ]
    members = collections.defaultdict(list)
    for n, cid in assign.items():
        members[cid].append(n)
    ranked = sorted(members.items(), key=lambda kv: -len(kv[1]))
    for rank, (cid, ns) in enumerate(ranked, 1):
        wrong = sum(labels[n]["blocked_legitimate_work"] for n in ns)
        mechs = collections.Counter(labels[n]["mechanism"].lower() for n in ns).most_common(3)
        ex = ", ".join(f"#{n}" for n in sorted(ns, key=int)[-3:])
        lines.append(
            f"| {rank} | **{causes[cid]['name']}** | {len(ns)} | {wrong} | {wrong / len(ns):.0%} | "
            f"{'; '.join(f'{m} ({c})' for m, c in mechs)} | {ex} |"
        )

    lines += [
        "",
        "## Gates ranked by wrong blocks",
        "",
        "| Mechanism | Wrong blocks | All reports |",
        "|---|---|---|",
    ]
    by_mech = collections.defaultdict(list)
    for lab in labels.values():
        by_mech[lab["mechanism"].lower()].append(lab)
    gate_rows = sorted(
        by_mech.items(), key=lambda kv: -sum(lab["blocked_legitimate_work"] for lab in kv[1])
    )
    for mech, ls in gate_rows[:25]:
        lines.append(
            f"| {mech} | {sum(lab['blocked_legitimate_work'] for lab in ls)} | {len(ls)} |"
        )

    kinds = collections.Counter(lab["kind"] for lab in labels.values())
    hosts = collections.Counter(lab["host"] for lab in labels.values())
    conf = collections.Counter(lab["confidence"] for lab in labels.values())
    lines += [
        "",
        "## Mix",
        "",
        "- Kind: " + ", ".join(f"{k} {v}" for k, v in kinds.most_common()),
        "- Host: " + ", ".join(f"{k} {v}" for k, v in hosts.most_common()),
        "- Label confidence: " + ", ".join(f"{k} {v}" for k, v in conf.most_common()),
        "",
        "## Root cause descriptions",
        "",
    ]
    for cid, _ in ranked:
        lines.append(f"- **{causes[cid]['name']}** — {causes[cid]['description']}")

    rng = random.Random(30)
    check = rng.sample(sorted(labels), min(30, len(labels)))
    (DATA / "spot-check.json").write_text(
        json.dumps([{"issue": issues[n], "label": labels[n]} for n in check], indent=1)
    )
    (HERE / "report.md").write_text("\n".join(lines) + "\n")
    print(f"wrote {HERE / 'report.md'}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["label", "taxonomy", "assign", "report"])
    ap.add_argument("--sample", type=int)
    args = ap.parse_args()
    if args.cmd == "report":
        cmd_report()
        return
    {
        "label": lambda: cmd_label(args.sample),
        "taxonomy": cmd_taxonomy,
        "assign": cmd_assign,
    }[args.cmd]()


if __name__ == "__main__":
    main()
