#!/bin/sh
set -eu
cd "${1:-/logs}"
mkdir -p verifier
python3 - << 'PY'
import json
from pathlib import Path
agent = Path('agent')
verifier = Path('verifier')
stop = agent / 'intake-stop.json'
budget = agent / 'budget-stop.json'
meter_interrupted = budget.is_file() and json.loads(budget.read_text()).get('reason') != 'combined_cap'
if meter_interrupted:
    outcome = 'budget_before_gate'
elif stop.is_file():
    outcome = json.loads(stop.read_text())['outcome']
else:
    outcome = 'budget_before_gate' if budget.is_file() else 'ended_before_gate'
reward = int(outcome == 'passed')
(verifier / 'reward.json').write_text(json.dumps({
    'reward': reward, 'intake_gate': reward, 'intake_conclusive': int(not meter_interrupted and outcome != 'order_unverified'),
}))
(verifier / 'intake-outcome.json').write_text(json.dumps({'outcome': outcome}) + '\n')
PY
