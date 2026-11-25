#!/usr/bin/env node
// Forward the native reviewer protocol and retain only usage metadata.
const { appendFileSync, readFileSync } = require('node:fs');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { randomUUID } = require('node:crypto');
const { dirname } = require('node:path');

const { executable, provider, usageFile, defaultModel, comparisonFile, budgetUsd, spendModule } =
  JSON.parse(readFileSync(`${__filename}.json`, 'utf8'));
const args = process.argv.slice(2);
// An intake comparison installs the frozen local Safeword marketplace. On
// its explicit request, omit the unrelated remote catalog from plugin list.
if (
  process.env.SAFEWORD_EVAL_LOCAL_MARKETPLACE === '1' &&
  provider === 'codex' &&
  args.join(' ') === 'plugin list --json'
) {
  args.push('--marketplace', 'safeword');
}
const option = flag => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const appServer = provider === 'codex' && args[0] === 'app-server' && args.includes('--stdio');
const review =
  !args.includes('--help') &&
  (provider === 'codex'
    ? appServer || (args[0] === 'exec' && args.includes('--json'))
    : args.includes('--no-session-persistence') && args.includes('--json-schema'));
const id = randomUUID();
const inlineModel = args.find(arg => /^(?:--model|-m|model)\s*=/.test(arg));
const explicitModel =
  option('--model') ??
  option('-m') ??
  inlineModel
    ?.split('=')[1]
    ?.trim()
    .replace(/^["']|["']$/g, '');
const pinModel = review && provider === 'codex' && !appServer && !explicitModel && defaultModel;
if (pinModel) args.splice(1, 0, '--model', defaultModel);
const requestedModel = explicitModel || (pinModel ? defaultModel : undefined);
const threadModels = new Map();
const threadSpend = new Map();
const assistantModels = new Set();
const spend = comparisonFile && require(spendModule);
const comparison = spend && spend.readJson(comparisonFile, null);

if (review && comparison && budgetUsd && !(spend.trialSpend(dirname(usageFile)) < budgetUsd)) {
  process.stderr.write('Harbor comparison dollar budget is exhausted.\n');
  process.exit(1);
}

function record(data, cumulativeCost) {
  if (comparison && (data.usage || data.model_usage)) {
    const model = data.model ?? requestedModel;
    const cumulative = provider === 'claude' && data.model_usage?.[model];
    let cost = cumulativeCost;
    if (cost === undefined) {
      cost = cumulative
        ? spend.settleClaude(comparison.pricing, model, cumulative)
        : spend.priceUsage(comparison.pricing, provider, model, data.usage);
      // Without per-request usage, a Codex thread above the threshold has
      // no single verifiable tier.
      if (
        provider === 'codex' &&
        (data.usage?.input_tokens ?? data.usage?.inputTokens) >
          comparison.pricing.models[model]?.above
      )
        cost = null;
    }
    if (cost !== null && model === defaultModel) {
      data.cost_usd = cost;
      data.basis = `provider rates ${comparison.pricing.verified_on}`;
    } else {
      data.unpriced = true;
    }
  }
  try {
    appendFileSync(
      usageFile,
      JSON.stringify({
        id,
        observed_at_epoch_ms: Date.now(),
        provider,
        requested_model: requestedModel,
        model_basis: pinModel ? 'Harbor reviewer default' : undefined,
        ...data,
      }) + '\n',
    );
  } catch {
    // The reviewer must remain usable if telemetry storage fails.
    process.stderr.write('Harbor could not write reviewer usage.\n');
  }
}

function observe(event) {
  if (event?.result?.thread?.id && typeof event.result.model === 'string') {
    threadModels.set(event.result.thread.id, event.result.model);
  }
  if (appServer && event?.method === 'thread/tokenUsage/updated') {
    const { threadId, tokenUsage } = event.params;
    const model = threadModels.get(threadId);
    const total = tokenUsage.total;
    const previous = threadSpend.get(threadId);
    const fields = ['inputTokens', 'outputTokens', 'cachedInputTokens', 'cacheWriteInputTokens'];
    if (previous && fields.every(key => (previous.total[key] ?? 0) === (total[key] ?? 0))) return;
    let cost;
    if (comparison) {
      const rate = comparison.pricing.models[model];
      if (!rate?.above || total.inputTokens <= rate.above) {
        cost = spend.priceUsage(comparison.pricing, provider, model, total);
      } else if (
        tokenUsage.last &&
        fields.every(
          key => (previous?.total[key] ?? 0) + (tokenUsage.last[key] ?? 0) === (total[key] ?? 0),
        )
      ) {
        const increment = spend.priceUsage(comparison.pricing, provider, model, tokenUsage.last);
        cost =
          previous?.cost === null || increment === null ? null : (previous?.cost ?? 0) + increment;
      } else {
        cost = null;
      }
    }
    threadSpend.set(threadId, { total, cost });
    record({ thread: threadId, model, usage: total }, cost);
  }
  if (provider === 'codex' && event?.type === 'turn.completed' && event.usage) {
    record({ cost_usd: event.cost_usd, usage: event.usage });
  }
  if (
    provider === 'claude' &&
    event?.type === 'assistant' &&
    typeof event.message?.model === 'string'
  ) {
    assistantModels.add(event.message.model);
  }
  if (provider === 'claude' && event?.type === 'result') {
    const models = Object.keys(event.modelUsage ?? {});
    record({
      model: models.length === 1 ? models[0] : undefined,
      cost_usd: event.total_cost_usd,
      usage: event.usage,
      model_usage: event.modelUsage,
      native_provenance: {
        terminal_subtype: event.subtype,
        assistant_models: [...assistantModels],
        model_usage: Object.values(event.modelUsage ?? {}).map(({ provider, canonicalModel }) => ({
          provider,
          canonicalModel,
        })),
      },
    });
  }
}

if (review) record({ started: true });
const child = spawn(executable, args, {
  stdio: ['inherit', review ? 'pipe' : 'inherit', 'inherit'],
});
if (review) {
  child.stdout.pipe(process.stdout);
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const singleJson = provider === 'claude' && option('--output-format') === 'json';
  let json = '';
  let oversized = false;
  lines.on('line', line => {
    if (singleJson) {
      if (json.length + line.length > 1_048_576) oversized = true;
      if (!oversized) json += line + '\n';
      return;
    }
    try {
      observe(JSON.parse(line));
    } catch {
      /* Ignore other CLI output. */
    }
  });
  lines.on('close', () => {
    if (singleJson && !oversized) {
      try {
        observe(JSON.parse(json));
      } catch {
        /* The reviewer emitted no usage result. */
      }
    }
  });
}
child.on('error', error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? 1;
  if (signal) process.kill(process.pid, signal);
});
