import json
import os
import shlex
from pathlib import Path

from harbor.agents.base import BaseAgent
from human_relay import CONTINUE_PROMPT, final_result, request_action, trace_events

Q = shlex.quote
ROOT = Path(__file__).resolve().parent
HARBOR = ROOT.parent
BASE = "/opt/intake-assessment"
CLAUDE = f"{BASE}/bundle/plugin"
CODEX = f"{BASE}/bundle/packages/cli/codex-plugin"
CODEX_HOME = "/root/intake-codex"
CLAUDE_HOME = "/tmp/intake-claude"
LOG = "/logs/agent"


class IntakeAgent(BaseAgent):
    @staticmethod
    def name():
        return "intake-assessment"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.host = os.environ["ASSESS_HOST"]
        self.bundle = Path(os.environ["INTAKE_RUN"])
        self.snapshot = json.loads((self.bundle / "comparison.json").read_text())
        self.expected = self.snapshot["models"][self.host]
        self.relay = Path(os.environ["ASSESS_RELAY"])
        self.budget = float(os.environ.get("ASSESS_BUDGET", "3"))
        self.runtime = (CLAUDE if self.host == "claude" else CODEX) + "/runtime/cli.js"
        self.reviewer = "codex" if self.host == "claude" else "claude"
        self.env = {
            "CODEX_HOME": CODEX_HOME,
            "CLAUDE_CONFIG_DIR": CLAUDE_HOME,
            "CLAUDE_CODE_OAUTH_TOKEN": os.environ["CLAUDE_CODE_OAUTH_TOKEN"],
            "CLAUDE_FORCE_OAUTH": "1",
            "OPENAI_API_KEY": "",
            "CODEX_API_KEY": "",
            "SAFEWORD_AGENT_RUNTIME": self.host,
            "SAFEWORD_EVAL_LOCAL_MARKETPLACE": "1",
            "ANTHROPIC_API_KEY": "",
            "ANTHROPIC_AUTH_TOKEN": "",
            "SAFEWORD_REVIEW_PRIMARY_MODEL_CODEX": self.snapshot["models"]["codex"],
            "SAFEWORD_REVIEW_ALTERNATE_MODEL_CODEX": self.snapshot["models"]["codex"],
            "SAFEWORD_REVIEW_PRIMARY_MODEL_CLAUDE": self.snapshot["models"]["claude"],
            "SAFEWORD_REVIEW_ALTERNATE_MODEL_CLAUDE": self.snapshot["models"]["claude"],
        }

    def version(self):
        return self.snapshot["versions"][self.host]

    async def checked(self, env, command, cwd="/app"):
        result = await env.exec(command=command, cwd=cwd, env=self.env)
        if result.return_code:
            raise RuntimeError((result.stderr or result.stdout or command).strip())
        return (result.stdout or "").strip()

    async def record(self, env, file, content):
        await self.checked(
            env, f"printf '%s\\n' {Q(json.dumps(content))} > {LOG}/{file}"
        )

    async def setup(self, environment):
        env = environment
        await self.checked(
            env,
            f"mkdir -p {LOG} {BASE}/bundle {CODEX_HOME} {CLAUDE_HOME} && install -d -m 755 {BASE} {BASE}/meter",
        )
        details = {"host": self.host, "expected_model": self.expected}
        try:
            root = await self.checked(env, "git rev-parse --show-toplevel")
            details["workspace"] = root
            expected_root = "/app"
            if root != expected_root:
                raise ValueError(
                    f"wrong_workspace_root: expected {expected_root}, found {root}"
                )
            details["fixture_revision"] = await self.checked(env, "git rev-parse HEAD")
            await env.upload_file(self.bundle / "bundle.tar", f"{BASE}/bundle.tar")
            await self.checked(env, f"tar -xf {BASE}/bundle.tar -C {BASE}/bundle")
            details["bundle_sha256"] = (
                await self.checked(env, f"sha256sum {BASE}/bundle.tar")
            ).split()[0]
            paths = {
                "claude": [
                    f"{CLAUDE}/skills/bdd/SKILL.md",
                    f"{CLAUDE}/skills/bdd/DISCOVERY.md",
                ],
                "codex": [
                    f"{CODEX}/skills/bdd/SKILL.md",
                    f"{CODEX}/skills/bdd/references/DISCOVERY.md",
                ],
            }
            skill, guide = paths[self.host]
            for path in (skill, guide):
                await self.checked(
                    env,
                    f"test -r {path} || {{ echo 'missing_plugin_reference: {path}' >&2; exit 1; }}",
                )
            details["skill"], details["guide"] = skill, guide
            runtime = self.runtime
            details["runtime_sha256"] = (
                await self.checked(env, f"sha256sum {runtime}")
            ).split()[0]
            details["safeword_version"] = await self.checked(
                env, f"bun {runtime} --version"
            )
            details["cli_versions"] = {}
            for provider, version in self.snapshot["versions"].items():
                actual = await self.checked(env, f"{provider} --version")
                if version not in actual.split():
                    raise ValueError(f"agent_version_mismatch: {provider} {actual}")
                details["cli_versions"][provider] = actual
            await env.upload_file(
                Path(os.environ["SAFEWORD_EVAL_CODEX_REVIEW_AUTH"]).expanduser(),
                f"{CODEX_HOME}/auth.json",
            )
            await self.checked(env, f"chmod 600 {CODEX_HOME}/auth.json")
            login = await self.checked(env, "codex login status 2>&1")
            if "logged in using chatgpt" not in login.lower():
                raise RuntimeError("Expected native Codex account login")
            details["codex_auth"] = "ChatGPT"
            await self.checked(
                env, f"bun {runtime} install --agents none --no-input --offline"
            )
            if self.host == "claude":
                await self.checked(
                    env,
                    f"claude plugin marketplace add {BASE}/bundle --scope project && claude plugin install safeword@safeword --scope project",
                )
            else:
                await self.checked(
                    env,
                    f"codex plugin marketplace add {BASE}/bundle && codex plugin add safeword@safeword",
                )
            await env.upload_file(
                self.bundle / "comparison.json", f"{LOG}/comparison.json"
            )
            await env.upload_file(HARBOR / "trial-spend.cjs", f"{LOG}/trial-spend.cjs")
            await env.upload_file(
                HARBOR / "supervise-claude.mjs", f"{LOG}/supervise-claude.mjs"
            )
            await env.upload_file(
                ROOT / "supervise-codex.mjs", f"{LOG}/supervise-codex.mjs"
            )
            await env.upload_file(ROOT / "stamp_trace.py", f"{BASE}/stamp_trace.py")
            await env.upload_file(
                HARBOR / "intake_cutoff.py", f"{BASE}/stop_at_intake.py"
            )
            await self.checked(
                env,
                f"mkdir -p /app/node_modules/.bin && rm -f /app/node_modules/.bin/safeword && printf '#!/bin/sh\\nexec bun {runtime} \"$@\"\\n' > /app/node_modules/.bin/safeword && chmod 755 /app/node_modules/.bin/safeword",
            )
            provider = self.reviewer
            for tool in ("claude", "codex"):
                entry = await self.checked(env, f"command -v {tool}")
                executable = await self.checked(env, f"readlink -f {Q(entry)}")
                if executable == entry:
                    raise RuntimeError(f"Expected an npm executable symlink for {tool}")
                await env.upload_file(
                    HARBOR / "review-meter.cjs", f"{BASE}/meter/{tool}"
                )
                config = {
                    "executable": executable,
                    "provider": tool,
                    "defaultModel": self.snapshot["models"][tool],
                    "comparisonFile": f"{LOG}/comparison.json",
                    "usageFile": f"{LOG}/review-usage.jsonl",
                    "spendModule": f"{LOG}/trial-spend.cjs",
                    "budgetUsd": self.budget,
                }
                await self.checked(
                    env,
                    f"chown root:root {BASE}/meter/{tool} && chmod 755 {BASE}/meter/{tool} && printf '%s' {Q(json.dumps(config))} > {BASE}/meter/{tool}.json && chmod 644 {BASE}/meter/{tool}.json",
                )
                await self.checked(env, f"ln -sfn {BASE}/meter/{tool} {Q(entry)}")
            await self.checked(env, f"touch {LOG}/review-usage.jsonl")
            details["qa_tools"] = {
                name: await self.checked(env, f"./node_modules/.bin/{name} --version")
                for name in ("cucumber-js", "eslint")
            }
            details["reviewer"] = provider
            details["reviewer_model"] = self.snapshot["models"][provider]
            details["status"] = "ready"
            await self.record(env, "setup-evidence.json", details)
        except Exception as error:
            details.update(status="setup_failure", reason=str(error))
            for operation in (
                lambda: self.checked(env, f"rm -f {CODEX_HOME}/auth.json"),
                lambda: self.record(env, "setup-evidence.json", details),
            ):
                try:
                    await operation()
                except Exception as secondary:
                    error.add_note(f"Setup failure handling: {secondary}")
            raise

    def author_command(self, instruction, output, step):
        prefix = f'env PATH="{BASE}/meter:/app/node_modules/.bin:$PATH" '
        if self.host == "claude":
            tools = f"Read(/{CLAUDE}/**),Skill(safeword:*),Bash"
            resume = "--continue " if step > 1 else ""
            command = (
                f"{prefix}claude {resume}-p --model {Q(self.expected)} "
                f"--verbose --output-format=stream-json --include-hook-events --strict-mcp-config "
                f"--permission-mode acceptEdits --allowedTools {Q(tools)} "
                f"--disallowedTools {Q('Bash(gh *),Bash(git push *)')} "
                f"--max-budget-usd {self.budget} -- {Q(instruction)}"
            )
            supervisor = f"node {LOG}/supervise-claude.mjs"
            args = f"60 {LOG}/comparison.json {self.budget} {Q(self.expected)}"
        else:
            resume = " resume --last" if step > 1 else ""
            command = (
                f"{prefix}codex -a never -c sandbox_mode=danger-full-access exec{resume} "
                f"--trust --dangerously-bypass-hook-trust -c web_search=disabled "
                f"--model {Q(self.expected)} --json -- {Q(instruction)}"
            )
            supervisor = f"node {LOG}/supervise-codex.mjs"
            args = f"{LOG}/comparison.json {self.budget} {CODEX_HOME}"
        command += f" 2>&1 | python3 -u {BASE}/stamp_trace.py {output}"
        invocation = f"{supervisor} {Q(command)} {args}"
        runtime = self.runtime
        reviewer = self.reviewer
        return (
            f"python3 {BASE}/stop_at_intake.py {runtime} {self.host} {reviewer} "
            f"{Q(self.snapshot['models'][reviewer])} {invocation}"
        )

    async def run(self, instruction, environment, context):
        env = environment
        self.relay.mkdir(parents=True, exist_ok=True)
        await self.checked(
            env,
            f"git status --porcelain --untracked-files=all > {LOG}/initial-worktree-status.txt",
        )
        step = 1
        primary_error = None
        try:
            while True:
                output = f"{LOG}/{step:02}-{self.host}.jsonl"
                invocation = self.author_command(instruction, output, step)
                run = await env.exec(command=invocation, cwd="/app", env=self.env)
                host_log = self.relay / Path(output).name
                await env.download_file(output, host_log)
                await self.checked(
                    env,
                    f"""find .project/tickets -name ticket.md -exec grep -m1 -H '^phase:' {{}} + >> {LOG}/ticket-phases.txt || true""",
                )
                spent = await env.exec(
                    command=f"test -f {LOG}/budget-stop.json || test -f {LOG}/intake-stop.json",
                    cwd="/app",
                )
                if spent.return_code == 0:
                    return
                if self.host == "claude":
                    message = final_result(host_log).get("result")
                else:
                    messages = [
                        entry.get("item", {}).get("text")
                        for _, entry in trace_events(host_log)
                        if entry.get("type") == "item.completed"
                        and entry.get("item", {}).get("type") == "agent_message"
                    ]
                    message = messages[-1] if messages else None
                if run.return_code:
                    raise RuntimeError("Author invocation failed; see trial trace")
                if not message:
                    return
                await self.checked(
                    env,
                    "find .project/tickets -type f \\( -name ticket.md -o -name spec.md \\) "
                    f"2>/dev/null | tar -czf {LOG}/{step:02}-pre-reply-plans.tar.gz -T -",
                )
                action, reply = await request_action(self.relay, step, message)
                if action == "finish":
                    return
                instruction = reply or CONTINUE_PROMPT
                step += 1
        except BaseException as error:
            primary_error = error
            raise
        finally:
            try:
                await self.checked(env, f"rm -f {CODEX_HOME}/auth.json")
                try:
                    await self.checked(
                        env,
                        f"git status --porcelain --untracked-files=all > {LOG}/worktree-status.txt && git diff HEAD > {LOG}/workspace.diff",
                    )
                except Exception as error:
                    self.logger.warning(
                        "Could not capture the optional worktree diff: %s", error
                    )
                await self.checked(
                    env,
                    "find .project/tickets .safeword/state features src test tests README.md task.mjs "
                    f"-type f 2>/dev/null | tar -czf {LOG}/workflow-artifacts.tar.gz -T -",
                )
            except Exception as error:
                if primary_error is None:
                    raise
                primary_error.add_note(f"Intake cleanup also failed: {error}")
