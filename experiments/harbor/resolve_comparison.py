"""Resolve signed-in models and freeze their rates for one Harbor comparison."""

import argparse
import json
import os
import re
import select
import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parent


def latest_codex(models, family):
    def version(entry):
        name = entry.get("model", "")
        match = re.fullmatch(rf"gpt-(\d+(?:\.\d+)*)-{re.escape(family)}", name)
        return (
            tuple(map(int, match[1].split(".")))
            if match and not entry.get("hidden")
            else ()
        )

    visible = [entry for entry in models if version(entry)]
    if not visible:
        raise ValueError(f"The signed-in Codex catalog has no {family} model")
    return max(visible, key=version)["model"]


def codex_catalog():
    with TemporaryDirectory(prefix="harbor-model-catalog-") as directory:
        env = os.environ.copy()
        auth = env.get("SAFEWORD_EVAL_CODEX_REVIEW_AUTH")
        if auth:
            target = Path(directory) / "auth.json"
            shutil.copyfile(Path(auth).expanduser(), target)
            target.chmod(0o600)
            env["CODEX_HOME"] = directory
            env.pop("OPENAI_API_KEY", None)
            env.pop("CODEX_API_KEY", None)
        with subprocess.Popen(
            ["codex", "app-server", "--stdio"],
            env=env,
            cwd=directory,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            bufsize=0,
        ) as process:

            def send(method, params=None, request_id=None):
                payload = {"method": method}
                if params is not None:
                    payload["params"] = params
                if request_id is not None:
                    payload["id"] = request_id
                process.stdin.write(json.dumps(payload).encode() + b"\n")

            def result(request_id):
                while select.select([process.stdout], [], [], 15)[0]:
                    line = process.stdout.readline()
                    if not line:
                        break
                    response = json.loads(line)
                    if response.get("id") == request_id:
                        if "result" not in response:
                            raise RuntimeError(
                                "Codex rejected the model-catalog preflight"
                            )
                        return response["result"]
                raise RuntimeError("Codex did not return its model catalog")

            try:
                send(
                    "initialize",
                    {"clientInfo": {"name": "safeword_harbor", "version": "1"}},
                    1,
                )
                result(1)
                send("initialized")
                models = []
                cursor = None
                for request_id in range(2, 102):
                    params = {"limit": 100, **({"cursor": cursor} if cursor else {})}
                    send("model/list", params, request_id)
                    page = result(request_id)
                    models.extend(page["data"])
                    cursor = page.get("nextCursor")
                    if not cursor:
                        return models
                raise RuntimeError("Codex returned too many model catalog pages")
            finally:
                process.terminate()


def resolve_claude(family):
    with TemporaryDirectory(prefix="harbor-model-probe-") as directory:
        result = subprocess.run(
            [
                "claude",
                "-p",
                "--model",
                family,
                "--no-session-persistence",
                "--setting-sources",
                "",
                "--tools",
                "",
                "--strict-mcp-config",
                "--output-format",
                "json",
                "--max-budget-usd",
                "0.08",
            ],
            input="Reply OK.",
            text=True,
            capture_output=True,
            cwd=directory,
            check=False,
        )
    try:
        response = json.loads(result.stdout)
        models = list(response.get("modelUsage", {}))
    except (ValueError, AttributeError):
        models = []
    if result.returncode or len(models) != 1:
        raise RuntimeError(f"Could not resolve Claude {family} to one runnable model")
    return {"model": models[0], "preflight_cost_usd": response.get("total_cost_usd")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--rates",
        type=Path,
        default=os.getenv("SAFEWORD_EVAL_PROVIDER_RATES")
        or ROOT / "provider-rates.json",
    )
    parser.add_argument(
        "--author", default=os.getenv("SAFEWORD_EVAL_CLAUDE_FAMILY") or "haiku"
    )
    parser.add_argument(
        "--claude-reviewer",
        default=os.getenv("SAFEWORD_EVAL_CLAUDE_REVIEWER_FAMILY") or "opus",
    )
    parser.add_argument(
        "--codex-family", default=os.getenv("SAFEWORD_EVAL_CODEX_FAMILY") or "sol"
    )
    args = parser.parse_args()
    pricing = json.loads(args.rates.read_text())
    claude = {
        family: resolve_claude(family)
        for family in dict.fromkeys((args.author, args.claude_reviewer))
    }
    models = {
        "author": claude[args.author]["model"],
        "claude": claude[args.claude_reviewer]["model"],
    }
    if os.environ.get("SAFEWORD_EVAL_CODEX_REVIEW_AUTH"):
        models["codex"] = latest_codex(codex_catalog(), args.codex_family)
    missing = set(models.values()) - pricing["models"].keys()
    if missing:
        raise RuntimeError(
            f"Verify and enter provider rates for {', '.join(sorted(missing))} in {args.rates}"
        )
    versions = {
        "claude": subprocess.check_output(["claude", "--version"], text=True).split()[0]
    }
    if "codex" in models:
        versions["codex"] = subprocess.check_output(
            ["codex", "--version"], text=True
        ).split()[-1]
    if any(
        not re.fullmatch(r"\d+\.\d+\.\d+", version) for version in versions.values()
    ):
        raise RuntimeError("Could not determine the pinned Harbor CLI versions")
    snapshot = {
        "models": models,
        "pricing": pricing,
        "versions": versions,
        "preflight": claude,
    }
    args.output.write_text(json.dumps(snapshot, indent=2) + "\n")


if __name__ == "__main__":
    main()
