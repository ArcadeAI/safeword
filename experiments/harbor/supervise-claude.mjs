import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { priceUsage, readJson, saveJson, settleClaude, trialSpend } from './trial-spend.cjs';

const [command, graceSeconds, comparisonFile, budgetUsd] = process.argv.slice(2);
const graceMs = Number(graceSeconds) * 1000;
const comparison = comparisonFile ? readJson(comparisonFile, null) : null;
const logs = comparison && dirname(comparisonFile);
const authorFile = logs && join(logs, 'author-spend.json');
const author = authorFile && readJson(authorFile, { cost_usd: 0, messages: {} });
const child = spawn('bash', ['-o', 'pipefail', '-c', command], {
  detached: true,
  stdio: ['inherit', 'pipe', 'inherit'],
});
let timer;
let killTimer;
let terminalResult;
let cleanedUp = false;
let budgetStopped = false;

function descendants(parent) {
  const snapshot = spawnSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' });
  const children = (snapshot.stdout ?? '')
    .trim()
    .split('\n')
    .map(line => line.trim().split(/\s+/).map(Number));
  return descendantsInSnapshot(parent, children);
}

function descendantsInSnapshot(parent, rows) {
  return rows
    .filter(([, ppid]) => ppid === parent)
    .flatMap(([pid]) => [...descendantsInSnapshot(pid, rows), pid]);
}

function signal(pid, name) {
  try {
    process.kill(pid, name);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

function stop(message) {
  if (cleanedUp) return;
  const owned = descendants(child.pid);
  cleanedUp = true;
  console.error(message);
  for (const pid of owned) signal(pid, 'SIGTERM');
  signal(-child.pid, 'SIGTERM');
  killTimer = setTimeout(() => {
    for (const pid of owned) signal(pid, 'SIGKILL');
    signal(-child.pid, 'SIGKILL');
  }, 2000);
}

function checkBudget() {
  if (!comparison || cleanedUp || !Number(budgetUsd)) return;
  const cost = trialSpend(logs);
  if (Number.isFinite(cost) && cost < Number(budgetUsd)) return;
  budgetStopped = true;
  const reason = Number.isFinite(cost) ? 'combined_cap' : 'unpriced_reviewer_usage';
  saveJson(join(logs, 'budget-stop.json'), {
    reason,
    budget_usd: Number(budgetUsd),
    estimated_cost_usd: cost,
  });
  stop(`Harbor stopped author and reviewer work (${reason}).`);
}

const budgetCheck = comparison && setInterval(checkBudget, 250);
budgetCheck?.unref?.();

function recordAuthorCost(settledCost) {
  const observed = Object.values(author.messages).reduce((sum, cost) => sum + cost, 0);
  if (settledCost !== undefined) author.settled_delta_usd = Math.max(0, settledCost - observed);
  author.cost_usd = observed + (author.settled_delta_usd ?? 0);
  saveJson(authorFile, author);
  checkBudget();
}

function stopForModel(model) {
  budgetStopped = true;
  saveJson(join(logs, 'budget-stop.json'), { reason: 'author_model_mismatch', model });
  stop('Harbor stopped a run that used a different author model than the comparison selected.');
}

const stream = createInterface({ input: child.stdout });
stream.on('line', line => {
  process.stdout.write(line + '\n');
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return;
  }
  const message = event?.type === 'assistant' && event.message;
  if (author && message?.id && message.usage && message.model !== '<synthetic>') {
    const cost = priceUsage(comparison.pricing, 'claude', message.model, message.usage);
    if (cost === null || message.model !== comparison.models.author) {
      stopForModel(message.model);
    } else if (author.messages[message.id] !== cost) {
      author.messages[message.id] = cost;
      recordAuthorCost();
    }
  }
  if (event?.type === 'result') {
    if (author && event.modelUsage && Object.keys(event.modelUsage).length) {
      const models = Object.keys(event.modelUsage);
      if (models.length !== 1 || models[0] !== comparison.models.author) {
        stopForModel(models.join(', '));
      } else {
        const settled = settleClaude(comparison.pricing, models[0], event.modelUsage[models[0]]);
        if (settled !== null) recordAuthorCost(settled);
      }
    }
    terminalResult = event;
    clearTimeout(timer);
    timer = setTimeout(
      () => stop('Harbor stopped leftover Claude processes after a terminal result.'),
      graceMs,
    );
  } else if (event?.type === 'assistant' || event?.type === 'user') {
    clearTimeout(timer);
    terminalResult = undefined;
  }
});

child.on('error', error => {
  console.error(error);
  process.exitCode = 1;
});
child.on('close', (code, signalName) => {
  clearInterval(budgetCheck);
  clearTimeout(timer);
  // A TERM-resistant descendant can outlive the shell. Let the escalation finish.
  if (!cleanedUp) clearTimeout(killTimer);
  process.exitCode = budgetStopped
    ? 0
    : cleanedUp
      ? Number(terminalResult?.is_error !== false)
      : (code ?? Number(Boolean(signalName)));
});
