import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { priceUsage, readJson, saveJson, trialSpend } from './trial-spend.cjs';

const [command, snapshot, cap, home] = process.argv.slice(2);
const comparison = readJson(snapshot);
const logs = dirname(snapshot);
const expected = comparison.models.codex;
const child = spawn('bash', ['-o', 'pipefail', '-c', command], {
  detached: true,
  stdio: 'inherit',
});
let stopped = false;
let latestCount = -1;

function sessionUsage(path) {
  let model = expected;
  let id = path;
  let total;
  let cost = 0;
  const timeline = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === 'session_meta' && event.payload?.id) id = event.payload.id;
    if (event.type === 'turn_context' && typeof event.payload?.model === 'string') {
      model = event.payload.model;
    }
    const usage = event.payload?.info?.total_token_usage;
    if (!usage || (total && usage.total_tokens <= total.total_tokens)) continue;
    const delta = {};
    for (const key of [
      'input_tokens',
      'output_tokens',
      'cached_input_tokens',
      'cache_write_input_tokens',
    ]) {
      delta[key] = (usage[key] ?? 0) - (total?.[key] ?? 0);
    }
    const amount = priceUsage(comparison.pricing, 'codex', model, delta);
    if (amount === null || model !== expected) return { invalid: model };
    total = usage;
    cost += amount;
    timeline.push({ at: event.timestamp, cost_usd: cost, usage: delta });
  }
  return { id, total, cost, timeline };
}

function stop(reason, cost) {
  if (stopped) return;
  stopped = true;
  saveJson(join(logs, 'budget-stop.json'), {
    reason,
    budget_usd: Number(cap),
    estimated_cost_usd: cost,
  });
  const rows = (spawnSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' }).stdout ?? '')
    .trim()
    .split('\n')
    .map(line => line.trim().split(/\s+/).map(Number));
  function terminate(pid) {
    for (const [childPid, parent] of rows) if (parent === pid) terminate(childPid);
    try {
      process.kill(pid, 'SIGTERM');
    } catch {}
  }
  terminate(child.pid);
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {}
}

function assess() {
  const folder = join(home, 'sessions');
  let paths = [];
  try {
    paths = readdirSync(folder, { recursive: true }).filter(path => path.endsWith('.jsonl'));
  } catch {}
  const sessions = new Map();
  for (const path of paths) {
    const rollup = sessionUsage(join(folder, path));
    if (rollup.invalid) {
      stop('author_usage_unpriced', null);
      return;
    }
    // Resuming may write another copy of one cumulative session. Distinct
    // author sessions, including subagents, each contribute to the budget.
    const previous = sessions.get(rollup.id);
    if (rollup.total && (!previous || rollup.total.total_tokens > previous.total.total_tokens)) {
      sessions.set(rollup.id, rollup);
    }
  }
  const usage = {};
  let cost = 0;
  const timeline = [];
  for (const session of sessions.values()) {
    cost += session.cost;
    for (const [name, count] of Object.entries(session.total)) {
      if (typeof count === 'number') usage[name] = (usage[name] ?? 0) + count;
    }
    for (const sample of session.timeline) timeline.push({ session: session.id, ...sample });
  }
  if (usage.total_tokens > latestCount) {
    latestCount = usage.total_tokens;
    saveJson(join(logs, 'author-spend.json'), { cost_usd: cost, usage, model: expected });
    saveJson(join(logs, 'author-usage-timeline.json'), timeline);
  }
  const total = trialSpend(logs);
  if (!Number.isFinite(total)) stop('unpriced_reviewer_usage', null);
  else if (total >= Number(cap)) stop('combined_cap', total);
}

const timer = setInterval(assess, 250);
child.on('close', code => {
  clearInterval(timer);
  assess();
  process.exitCode = stopped ? 0 : (code ?? 1);
});
