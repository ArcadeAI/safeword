import json
import os
import re
import shlex
import tarfile
from contextlib import asynccontextmanager
from decimal import Decimal, InvalidOperation
from itertools import count
from pathlib import Path, PurePosixPath

from harbor.agents.installed.claude_code import ClaudeCode
from harbor.models.agent.context import ModelUsage
from human_relay import (
    CONTINUE_PROMPT,
    final_result,
    request_action,
    result_events,
)
from model_spend import METER_LOG

CODEX_REVIEWER_VERSION = "0.171.0"
CODEX_REVIEWER_MODEL = "gpt-6.1-sol"
CODEX_REVIEWER_PREFIX = "/opt/safeword-reviewer"
REVIEW_METER_BIN = f"{CODEX_REVIEWER_PREFIX}/meter"


async def install_review_meter(agent, environment, reviewers):
    usage_file = (agent.environment_logs_dir / METER_LOG).as_posix()
    script = "/tmp/harbor-review-meter.cjs"
    await environment.upload_file(Path(__file__).with_name("review-meter.cjs"), script)
    await agent.exec_as_root(environment, f"install -d -m 755 {CODEX_REVIEWER_PREFIX} {REVIEW_METER_BIN}")
    for provider, executable in reviewers.items():
        target = f"{REVIEW_METER_BIN}/{provider}"
        snapshot = agent.comparison
        model = (snapshot["models"].get(provider) if snapshot else
                 CODEX_REVIEWER_MODEL if provider == "codex" else None)
        config = shlex.quote(json.dumps({
            "executable": executable, "provider": provider, "usageFile": usage_file,
            "defaultModel": model,
            "comparisonFile": agent.comparison_file,
            "budgetUsd": float(agent.options.max_budget_usd) if snapshot and agent.options.max_budget_usd else None,
            "spendModule": (agent.environment_logs_dir / "trial-spend.cjs").as_posix(),
        }))
        await agent.exec_as_root(
            environment,
            f"install -m 755 {script} {target} && printf '%s' {config} > {target}.json "
            f"&& chmod 644 {target}.json",
        )
    await agent.exec_as_agent(environment, f"touch {shlex.quote(usage_file)}")


class ComparisonAgent(ClaudeCode):
    def __init__(self, *args, **kwargs):
        arm = os.environ["SAFEWORD_EVAL_ARM"]
        if arm not in {"baseline", "release", "checkout"}:
            raise ValueError(f"Unknown comparison arm: {arm}")
        self.arm = arm
        reviewer_auth = os.environ.get("SAFEWORD_EVAL_CODEX_REVIEW_AUTH")
        self.reviewer_auth = (
            Path(reviewer_auth).expanduser() if reviewer_auth and arm != "baseline" else None
        )
        if self.reviewer_auth and not self.reviewer_auth.is_file():
            raise ValueError("SAFEWORD_EVAL_CODEX_REVIEW_AUTH must point to a local Codex auth.json")
        self.reviewer_home = None
        self.claude_executable = None
        self.arm_bundle = None
        snapshot = os.environ.get("SAFEWORD_EVAL_COMPARISON")
        self.comparison_source = Path(snapshot) if snapshot else None
        self.comparison = json.loads(self.comparison_source.read_text()) if self.comparison_source else None
        self.comparison_file = None
        if (budget := kwargs.get("max_budget_usd")) is not None:
            try:
                amount = Decimal(str(budget))
            except InvalidOperation as error:
                raise ValueError("Trial budget must be a positive USD amount") from error
            if not amount.is_finite() or amount <= 0:
                raise ValueError("Trial budget must be a positive USD amount")
            kwargs["max_budget_usd"] = format(amount, "f")
        version = self.comparison["versions"]["claude"] if self.comparison else "2.1.326"
        super().__init__(*args, **{**kwargs, "version": version})

    async def install(self, environment):
        await super().install(environment)
        if not await self._installed_claude_satisfies_version(environment):
            raise RuntimeError("Claude Code version did not match the pin")
        self.supervisor = (self.environment_logs_dir / "supervise-claude.mjs").as_posix()
        await environment.upload_file(
            Path(__file__).with_name("supervise-claude.mjs"), self.supervisor
        )
        await environment.upload_file(
            Path(__file__).with_name("trial-spend.cjs"), (self.environment_logs_dir / "trial-spend.cjs").as_posix()
        )
        if self.comparison_source:
            self.comparison_file = (self.environment_logs_dir / "comparison.json").as_posix()
            await environment.upload_file(self.comparison_source, self.comparison_file)
        if self.arm != "baseline":
            config_dir = shlex.quote(str(self.environment_logs_dir / "sessions"))
            prefix = (
                'export PATH="$HOME/.local/bin:$PATH"; '
                f"export CLAUDE_CONFIG_DIR={config_dir}; "
                'mkdir -p "$CLAUDE_CONFIG_DIR"; cd /app; '
            )
            local_release = self.arm == "release" and "SAFEWORD_EVAL_RELEASE_ARCHIVE" in os.environ
            if self.arm == "checkout" or local_release:
                archive_key = (
                    "SAFEWORD_EVAL_RELEASE_ARCHIVE" if local_release else "SAFEWORD_EVAL_ARCHIVE"
                )
                archive = Path(os.environ[archive_key])
                root = "/tmp/safeword-release" if local_release else "/tmp/safeword-checkout"
                self.arm_bundle = root
                if self.options.permission_mode != "bypassPermissions":
                    self.allow_archived_plugin(archive, root)
                await environment.upload_file(archive, f"{root}.tar")
                extractor = os.environ.get("SAFEWORD_EVAL_TASK", "").startswith("extractor-")
                use_published_cli = local_release and not extractor
                cli = (
                    "./node_modules/.bin/safeword"
                    if use_published_cli
                    else f"bun {root}/plugin/runtime/cli.js"
                )
                offline_flag = " --offline" if extractor else ""
                install = (
                    f"mkdir -p {root} && tar -xf {root}.tar -C {root} && "
                    f"{cli} install --agents none --no-input{offline_flag} && "
                    f"claude plugin marketplace add {root} --scope project && "
                    "claude plugin install safeword@safeword --scope project"
                )
            else:
                install = (
                    "./node_modules/.bin/safeword install --agents claude --no-input "
                    "|| ./node_modules/.bin/safeword install --agents claude --no-input"
                )
            result = await environment.exec(command=prefix + install)
            if result.return_code:
                details = "\n".join(output for output in (result.stdout, result.stderr) if output)
                raise RuntimeError(f"Safeword setup failed (exit {result.return_code}): {details}")

        if os.environ.get("SAFEWORD_EVAL_READY_DEPS") == "1":
            result = await environment.exec(command="cd /app && npm ci --no-audit")
            if result.return_code:
                raise RuntimeError(f"Fixture npm ci failed: {result.stderr or result.stdout}")

        if self.comparison and self.arm_bundle:
            pin_script = "/tmp/harbor-pin-safeword.cjs"
            await environment.upload_file(Path(__file__).with_name("pin-safeword-cli.cjs"), pin_script)
            ledger = shlex.quote((self.environment_logs_dir / "safeword-runtime.json").as_posix())
            await self.exec_as_agent(environment, f"node {pin_script} {self.arm_bundle} {ledger}", cwd="/app")

        if self.reviewer_auth:
            version = self.comparison["versions"]["codex"] if self.comparison else CODEX_REVIEWER_VERSION
            await self.exec_as_root(
                environment,
                "npm install --global --no-audit --no-fund "
                f"--prefix {CODEX_REVIEWER_PREFIX} @openai/codex@{version} "
                f"&& chmod -R go-w {CODEX_REVIEWER_PREFIX}",
            )
        native_claude = await self.exec_as_agent(environment, 'PATH="$HOME/.local/bin:$PATH" command -v claude')
        self.claude_executable = native_claude.stdout.strip()
        reviewers = {"claude": self.claude_executable}
        if self.reviewer_auth:
            reviewers["codex"] = f"{CODEX_REVIEWER_PREFIX}/bin/codex"
        await install_review_meter(self, environment, reviewers)

    @asynccontextmanager
    async def codex_reviewer_session(self, environment):
        if not self.reviewer_auth:
            yield
            return

        directory = await self.exec_as_agent(environment, "mktemp -d /tmp/safeword-review-auth.XXXXXXXX")
        self.reviewer_home = directory.stdout.strip()
        home = shlex.quote(self.reviewer_home)
        auth_file = f"{home}/auth.json"
        try:
            await environment.upload_file(self.reviewer_auth, f"{self.reviewer_home}/auth.json")
            await self.exec_as_root(
                environment, f"chown --reference={home} {auth_file} && chmod 600 {auth_file}"
            )
            login = await environment.exec(
                command=f"{CODEX_REVIEWER_PREFIX}/bin/codex login status",
                env={"CODEX_HOME": self.reviewer_home, "OPENAI_API_KEY": "", "CODEX_API_KEY": ""},
            )
            login_output = (login.stdout or "") + (login.stderr or "")
            if login.return_code or "Logged in using ChatGPT" not in login_output:
                raise RuntimeError("The Codex reviewer could not use the supplied ChatGPT login")
            self.logger.info("Independent Codex reviewer is installed and signed in")
            yield
        finally:
            self.reviewer_home = None
            await self.exec_as_root(environment, f"rm -rf -- {home}")

    def allow_archived_plugin(self, archive: Path, root: str) -> None:
        # Approve the pinned plugin without enabling other skills or file writes.
        with tarfile.open(archive) as bundle:
            skills = set()
            for member in bundle:
                parts = PurePosixPath(member.name).parts
                if (member.isfile() and len(parts) == 4 and parts[:2] == ("plugin", "skills")
                        and parts[3] == "SKILL.md"):
                    skills.add(parts[2])
        allowed = (self.options.allowed_tools or "").split(",")
        rules = [f"Read(/{root}/plugin/**)", *(f"Skill(safeword:{name})" for name in sorted(skills))]
        self.options.allowed_tools = ",".join(dict.fromkeys(filter(None, [*allowed, *rules])))

    async def exec_as_agent(self, environment, command, env=None, cwd=None, timeout_sec=None):
        # The pinned Harbor adapter uses this invocation in its print-mode run.
        invocation = "claude --verbose --output-format=stream-json "
        if invocation in command:
            project_bin = ":/app/node_modules/.bin" if self.comparison and self.arm_bundle else ""
            command = command.replace(
                invocation,
                f'env PATH="{REVIEW_METER_BIN}{project_bin}:$PATH" {shlex.quote(self.claude_executable)} '
                "--verbose --output-format=stream-json --include-hook-events ",
                1,
            )
            command = f"node {shlex.quote(self.supervisor)} {shlex.quote(command)} 60"
            if self.comparison_file:
                budget = self.options.max_budget_usd or "0"
                command += f" {shlex.quote(self.comparison_file)} {shlex.quote(budget)}"
                env = {**(env or {})}
                for provider in ("claude", "codex"):
                    model = self.comparison["models"].get(provider)
                    if model:
                        env[f"SAFEWORD_REVIEW_PRIMARY_MODEL_{provider.upper()}"] = model
                        env[f"SAFEWORD_REVIEW_ALTERNATE_MODEL_{provider.upper()}"] = model
            if self.reviewer_home:
                env = {
                    **(env or {}),
                    "CODEX_HOME": self.reviewer_home,
                    "OPENAI_API_KEY": "",
                    "CODEX_API_KEY": "",
                }
        return await super().exec_as_agent(environment, command, env, cwd, timeout_sec)

    async def run(self, instruction, environment, context):
        if os.environ.get("SAFEWORD_EVAL_TASK", "").startswith("extractor-"):
            helper = "/tmp/harbor-candidate-evidence.sh"
            await environment.upload_file(Path(__file__).with_name("candidate-evidence.sh"), helper)
            await self.exec_as_agent(
                environment, f"sh {helper} /tmp/harbor-candidate-before.tree", cwd="/app"
            )
        # Exclude all fixture refs (including branches outside HEAD). An empty
        # repository has no refs, so its first trial commit is still captured.
        refs = await environment.exec(
            command="cd /app && git rev-parse --git-dir >/dev/null && "
                    "{ git rev-parse --verify HEAD 2>/dev/null || true; git rev-parse --all; }"
        )
        self.start_refs = set(refs.stdout.splitlines()) if refs.return_code == 0 else None
        if self.start_refs and not all(re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", ref) for ref in self.start_refs):
            self.start_refs = None
        async with self.codex_reviewer_session(environment):
            await self.run_with_relay(instruction, environment, context)

    async def run_with_relay(self, instruction, environment, context):
        if os.environ.get("SAFEWORD_EVAL_HUMAN_RELAY") != "1":
            await self.run_and_record_phase(instruction, environment, context)
            return

        relay_root = Path(os.environ["SAFEWORD_EVAL_RELAY_DIR"])
        relay = relay_root / self.arm / self.logs_dir.parent.name
        log_path = (self.environment_logs_dir / "claude-code.txt").as_posix()
        trial_budget = self.options.max_budget_usd
        self.relay_logs = []
        for checkpoint in count(1):
            await self.run_and_record_phase(instruction, environment, context)
            relay.mkdir(parents=True, exist_ok=True)
            turn_log = relay / f"{checkpoint:02d}-claude.jsonl"
            await environment.download_file(log_path, turn_log)
            self.relay_logs.append(turn_log)
            if self.comparison:
                stop_file = shlex.quote((self.environment_logs_dir / "budget-stop.json").as_posix())
                stop = await environment.exec(command=f"test -f {stop_file}")
                if stop.return_code == 0:
                    return
            result = final_result(turn_log)
            message = result.get("result")
            if not message:
                return
            if trial_budget is not None and not self.comparison:
                cost = result.get("total_cost_usd")
                if cost is None:
                    raise RuntimeError("Claude reported no cost for the trial; cannot continue")
                remaining = Decimal(trial_budget) - Decimal(str(cost))
                if remaining <= 0:
                    return
                self.options.max_budget_usd = format(remaining, "f")
            action, reply = await request_action(relay, checkpoint, message)
            if action == "finish":
                return
            if action == "continue":
                instruction = CONTINUE_PROMPT
            else:
                instruction = reply
            self._resume = True

    async def run_and_record_phase(self, instruction, environment, context):
        try:
            await super().run(instruction, environment, context)
        finally:
            target = shlex.quote((self.environment_logs_dir / "ticket-phases.txt").as_posix())
            commits = ":"
            if self.start_refs is not None:
                excluded = " ".join("^" + sha for sha in sorted(self.start_refs))
                commits = f"git log --format='commit: %H' HEAD {excluded} 2>/dev/null || true"
            try:
                snapshot = await environment.exec(
                    command=(
                        f"cd /app && {{ date -u +%FT%TZ; "
                        "for root in .project .safeword-project; do "
                        'if [ -d "$root/tickets" ]; then '
                        'find "$root/tickets" -name ticket.md -type f '
                        "-exec grep -m1 -H '^phase:' {} + || true; fi; done; "
                        f"{commits}; }} >> {target}"
                    ),
                    timeout_sec=5,
                )
                if snapshot.return_code:
                    self.logger.warning("Could not capture trial evidence")
            except (OSError, RuntimeError, TimeoutError):
                self.logger.warning("Could not capture trial evidence")

    def populate_context_post_run(self, context):
        super().populate_context_post_run(context)
        final_log = self.logs_dir / "claude-code.txt"
        result = final_result(final_log)
        context.metadata = {
            **(context.metadata or {}),
            "clean_terminal_result": (
                result.get("subtype") == "success"
                and result.get("is_error") is False
                and not (self.logs_dir / "budget-stop.json").exists()
            ),
        }
        if (cost := result.get("total_cost_usd")) is not None:
            context.cost_usd = cost
        if usage := result.get("modelUsage"):
            # Claude's modelUsage accumulates for the session, including across resumes.
            # The result's top-level usage covers only that result interval.
            models = {}
            for model, item in usage.items():
                cached = item.get("cacheReadInputTokens", 0) + item.get(
                    "cacheCreationInputTokens", 0
                )
                models[model] = ModelUsage(
                    n_input_tokens=item.get("inputTokens", 0) + cached,
                    n_cache_tokens=cached,
                    n_output_tokens=item.get("outputTokens", 0),
                    cost_usd=item.get("costUSD"),
                )
            context.model_usage = models
            context.n_input_tokens = sum(item.n_input_tokens for item in models.values())
            context.n_cache_tokens = sum(item.n_cache_tokens for item in models.values())
            context.n_output_tokens = sum(item.n_output_tokens for item in models.values())

        checkpoints = [*getattr(self, "relay_logs", []), final_log]
        turns = {}
        for path in checkpoints:
            for event in result_events(path):
                if event.get("uuid") and isinstance(event.get("num_turns"), int):
                    turns[event["uuid"]] = event["num_turns"]
        if turns:
            context.metadata = {
                **(context.metadata or {}),
                "reported_agent_turns": sum(turns.values()),
            }
