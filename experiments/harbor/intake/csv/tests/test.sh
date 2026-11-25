#!/bin/sh
set -eu
mkdir -p /logs/verifier
python3 - << 'PY'
import json
from pathlib import Path
agent = Path('/logs/agent')
verifier = Path('/logs/verifier')
stop = agent / 'intake-stop.json'
if stop.is_file():
    outcome = json.loads(stop.read_text())['outcome']
else:
    outcome = 'budget_before_gate' if (agent / 'budget-stop.json').exists() else 'ended_before_gate'
reward = int(outcome == 'passed')
(verifier / 'reward.json').write_text(json.dumps({
    'reward': reward, 'intake_gate': reward, 'intake_conclusive': int(outcome != 'order_unverified'),
}))
(verifier / 'intake-outcome.json').write_text(json.dumps({'outcome': outcome}) + '\n')
PY
