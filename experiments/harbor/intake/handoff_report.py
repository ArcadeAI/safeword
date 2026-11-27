"""Print the frozen intake comparison from local receipts. No model calls."""

import argparse
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from .handoff import (
    CASES,
    HOSTS,
    cells,
    fixture_hashes,
    sha,
    verify_group,
    verify_protocol_inputs,
)
from .run import document


@dataclass
class Attempt:
    row: dict
    status: str
    cost: float = 0
    priced: bool = False

    @property
    def product(self):
        return self.row.get("product", {})


def read_attempt(folder, lane):
    results = folder / "intake-results.json"
    row = document(results).get(lane, {}) if results.is_file() else {}
    path = folder / lane
    evidence = path / "evidence-index.json"
    if not row and not path.exists():
        return None
    spend = document(evidence)["model_spend"] if evidence.is_file() else {}
    stop = (spend.get("budget_stop") or {}).get("reason")
    outcome = row.get("outcome")
    product = row.get("product", {})
    if any(path.glob("harbor/*/exception.txt")):
        status = "runner error"
    elif not row:
        status = "unscored"
    elif not row.get("evidence") or not evidence.is_file():
        status = "missing evidence"
    elif outcome == "budget_before_gate" and stop != "combined_cap":
        status = (
            "meter interrupted"
            if stop
            in {
                "author_usage_unpriced",
                "unpriced_reviewer_usage",
                "author_model_mismatch",
            }
            else "missing evidence"
        )
    elif outcome in {
        "downstream_edit",
        "phase_without_current_approval",
        "ended_before_gate",
        "budget_before_gate",
    }:
        status = "failed"
    elif outcome == "passed" and product.get("plan_matches") in {"yes", "no"}:
        status = "passed" if product["plan_matches"] == "yes" else "failed"
    else:
        status = "incomplete"
    cost = row.get("cost_usd", spend.get("total_cost_usd"))
    if cost is not None:
        return Attempt(row, status, cost, True)
    reviewer = spend.get("reviewer") or {}
    review_cost = reviewer.get("cost_usd")
    if review_cost is None:
        review_cost = sum(
            call.get("cost_usd") or 0 for call in reviewer.get("calls", [])
        )
    return Attempt(
        row,
        status,
        (spend.get("author", {}).get("cost_usd") or 0) + review_cost,
    )


def same_inputs(original, retry):
    for name in ("comparison.json", "build.json", "bundle.tar"):
        left, right = original / name, retry / name
        if not left.is_file() or not right.is_file() or sha(left) != sha(right):
            return False
    return fixture_hashes(original / "fixture") == fixture_hashes(retry / "fixture")


def money(attempts, divisor=1):
    if not attempts or not divisor:
        return "—"
    prefix = "" if all(a.priced for a in attempts) else "≥"
    return f"{prefix}${sum(a.cost for a in attempts) / divisor:.2f}"


def tally(attempts, key):
    known = [a.product.get(key) for a in attempts]
    return (
        "?" if any(not isinstance(value, int) for value in known) else str(sum(known))
    )


def decision(groups, complete):
    if not complete or any(
        not groups.get((arm, case, host))
        for arm in ("baseline", "candidate")
        for case in CASES
        for host in HOSTS
    ):
        return (
            False,
            "Withhold the decision. Primary observations are missing, inconclusive, or have unexpected retries.",
        )

    for key, trials in groups.items():
        for trial in trials:
            grade = trial.product
            if (
                grade.get("asked") not in {"yes", "no"}
                or any(
                    type(grade.get(field)) is not int
                    for field in ("useful_asks", "repeat_asks")
                )
                or grade.get("unclear_turns") != 0
                or grade.get("unclassified_asks") != 0
            ):
                return (
                    False,
                    f"Withhold the decision. Clarification grades are missing or uncertain for {'/'.join(key)}.",
                )

    gained = 0
    for host in HOSTS:
        old, new = (groups[arm, "supplied", host] for arm in ("baseline", "candidate"))
        gain = sum(a.status == "passed" for a in new) - sum(
            a.status == "passed" for a in old
        )
        if gain < 0:
            return (
                True,
                f"Keep baseline. The candidate lost supplied-case successes on {host.title()}.",
            )
        gained += gain
        if sum(a.product["asked"] == "yes" for a in new) > sum(
            a.product["asked"] == "yes" for a in old
        ):
            return (
                True,
                f"Keep baseline. The candidate asked about the supplied choice in more {host.title()} trials.",
            )
        if any(
            a.status != "passed"
            or a.product["asked"] != "yes"
            or a.product["useful_asks"] < 1
            for a in groups["candidate", "hidden", host]
        ):
            return (
                True,
                f"Keep baseline. The candidate failed the hidden-choice control on {host.title()}.",
            )
        for case in CASES:
            old, new = (groups[arm, case, host] for arm in ("baseline", "candidate"))
            if sum(a.product["repeat_asks"] for a in new) > sum(
                a.product["repeat_asks"] for a in old
            ):
                return (
                    True,
                    f"Keep baseline. The candidate repeated more questions on the {host.title()} {case} control.",
                )
    if gained:
        return True, "Send the candidate to a fresh holdout on both hosts."
    return True, "Keep baseline. Supplied-case primary successes tied."


def report(root):
    """Return Markdown and whether there is enough evidence for a decision."""
    lock = root / "protocol.json"
    if lock.is_file():
        manifest = document(lock)
        verify_protocol_inputs(root, manifest)
        groups = {f"{arm}-{case}-{rep}" for arm, case, rep, _ in cells()}
        if set(manifest["groups"]) != groups:
            raise ValueError(
                "Frozen comparison groups differ from the handoff protocol"
            )
        for name in groups:
            verify_group(root, manifest, name)
    lines = [
        "# Intake handoff comparison",
        "",
        "| Template | Case | Author | Correct and approved / planned | Incomplete | Useful asks | Repeat asks |",
        "| --- | --- | --- | ---: | ---: | ---: | ---: |",
    ]
    groups, by_arm = defaultdict(list), defaultdict(list)
    detail, complete = [], True
    for arm, fixture, repetition, host in cells():
        name = f"{arm}-{fixture}-{repetition}"
        original = root / name
        lane = f"trials/{CASES[fixture]}/{host}"
        folders = [original, *sorted((root / "retries").glob(f"**/{name}"))]
        selected = None
        for folder in folders:
            attempt = read_attempt(folder, lane)
            if attempt is None:
                continue
            by_arm[arm].append(attempt)
            if folder != original and (
                not selected
                or selected.status not in {"meter interrupted", "runner error"}
                or not same_inputs(original, folder)
            ):
                complete = False
                note = "unexpected retry; excluded"
            else:
                selected = attempt
                note = attempt.status
            product = attempt.product
            detail.append(
                f"| [{folder.relative_to(root)}/{host}]({(folder.relative_to(root) / 'intake-results.md').as_posix()}) | {note} | {attempt.row.get('outcome', '?')} | {product.get('plan_matches', '?')} | {product.get('operator_interruptions', '?')} | {money([attempt])} |"
            )
        if selected is None:
            detail.append(f"| {name}/{host} | missing | — | — | — | — |")
        if not selected or selected.status not in {"passed", "failed"}:
            complete = False
        groups[arm, fixture, host].append(selected)

    if lock.is_file():
        complete, verdict = decision(groups, complete)
    else:
        complete, verdict = (
            False,
            "Withhold the decision. The frozen protocol is missing.",
        )
    lines[2:2] = [f"**{verdict}**", ""]
    for (arm, fixture, host), planned in sorted(groups.items()):
        valid = [a for a in planned if a and a.status in {"passed", "failed"}]
        wins = sum(a.status == "passed" for a in valid)
        lines.append(
            f"| {arm} | {fixture} | {host} | {wins}/{len(planned)} | {len(planned) - len(valid)} | {tally(valid, 'useful_asks')} | {tally(valid, 'repeat_asks')} |"
        )
    lines += [
        "",
        "| Template | Primary successes / planned | Attempts | Author + reviewer | Per primary success | Grading and routing |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for arm in sorted({key[0] for key in groups}):
        planned = [a for key, group in groups.items() if key[0] == arm for a in group]
        attempts = by_arm[arm]
        wins = sum(bool(a and a.status == "passed") for a in planned)
        grades = [a.product.get("evaluation_cost_usd") for a in attempts]
        grading = (
            ("≥" if None in grades else "")
            + f"${sum(g for g in grades if g is not None):.2f}"
            if grades
            else "—"
        )
        lines.append(
            f"| {arm} | {wins}/{len(planned)} | {len(attempts)} | {money(attempts)} | {money(attempts, wins)} | {grading} |"
        )

    lines += [
        "",
        "Spend includes all observed attempts. ≥ means receipts are incomplete. Ask counts cover conclusive primary observations. An early scenario edit fails the handoff even if the plan grade is unclear.",
        "",
        "| Attempt | Primary status | Workflow | Product grade | Operator notices | Author + reviewer |",
        "| --- | --- | --- | --- | ---: | ---: |",
        *detail,
        "",
        "## Holdout",
        "",
    ]
    holdouts = sorted((root / "holdout").glob("*/intake-results.json"))
    if not holdouts:
        lines.append("No scored holdout.")
    for path in holdouts:
        for lane, row in sorted(document(path).items()):
            plan_file = row.get("plan")
            plan = (
                f" · [plan]({path.parent.relative_to(root) / lane / plan_file})"
                if plan_file
                else ""
            )
            lines.append(
                f"- {path.parent.name}/{Path(lane).name} · workflow {row.get('outcome', 'unknown')} · product grade {row.get('product', {}).get('plan_matches', 'unrecorded')}{plan}"
            )
    return "\n".join(lines) + "\n", complete


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    try:
        markdown, complete = report(args.directory)
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, f"{error}\n")
    print(markdown, end="")
    raise SystemExit(0 if complete else 1)
