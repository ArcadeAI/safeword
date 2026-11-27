"""Shared hidden functional and preservation checks for generated JavaScript tasks."""

import json
import subprocess


def grade_script(functional, preservation):
    return f"""import assert from "node:assert/strict";
import {{ writeFileSync }} from "node:fs";
import {{ pathToFileURL }} from "node:url";

const api = await import(pathToFileURL(process.argv[2])).catch(error => {{
  console.error(error);
  return {{}};
}});
function check(name, run) {{
  try {{
    run();
    return 1;
  }} catch (error) {{
    console.error(name, error);
    return 0;
  }}
}}
const functional = check("functional", () => {{ {functional} }});
const preservation = check("preservation", () => {{ {preservation} }});
writeFileSync(process.argv[3], JSON.stringify({{
  reward: functional * preservation, functional, preservation,
}}));
"""


def calibrate(staging, grader, starter, reference):
    """Exercise the verifier the agent will actually be scored with."""
    staging.mkdir(parents=True, exist_ok=True)
    implementation = staging / "task.mjs"
    for name, source, expected in (
        ("starter", starter, 0),
        ("reference", reference, 1),
    ):
        implementation.write_text(source)
        result = staging / f"{name}.json"
        result.unlink(missing_ok=True)
        run = subprocess.run(
            ["node", grader, implementation, result], capture_output=True, text=True,
            check=True,
        )
        score = json.loads(result.read_text())
        if score != dict(reward=expected, functional=expected, preservation=1):
            raise RuntimeError(f"{staging.name} {name}: {score}\n{run.stderr}")
