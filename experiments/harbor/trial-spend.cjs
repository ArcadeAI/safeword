const { existsSync, readFileSync, renameSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

function priceUsage(prices, provider, model, usage, { aggregate = false } = {}) {
  const rate = prices.models[model];
  if (!rate || !usage) return null;
  const input = usage.input_tokens ?? usage.inputTokens;
  const output = usage.output_tokens ?? usage.outputTokens;
  const cached =
    usage.cache_read_input_tokens ??
    usage.cached_input_tokens ??
    usage.cachedInputTokens ??
    usage.cacheReadInputTokens ??
    0;
  const writes =
    usage.cache_creation_input_tokens ??
    usage.cache_write_input_tokens ??
    usage.cacheWriteInputTokens ??
    usage.cacheCreationInputTokens ??
    0;
  const uncached = provider === 'claude' ? input : input - cached - writes;
  if (![input, output, cached, writes, uncached].every(n => Number.isSafeInteger(n) && n >= 0)) {
    return null;
  }
  const longWrites =
    usage.cache_creation?.ephemeral_1h_input_tokens ??
    usage.cacheCreationEphemeral1hInputTokens ??
    writes;
  if (!Number.isSafeInteger(longWrites) || longWrites < 0 || longWrites > writes) return null;
  // A session aggregate cannot reveal which individual requests crossed a tier.
  const over = !aggregate && uncached + cached + writes > (rate.above ?? Infinity);
  const inputCost =
    uncached * rate.input +
    cached * rate.cached +
    (writes - longWrites) * rate.write_short +
    longWrites * rate.write_long;
  const cost =
    (inputCost * (over ? rate.input_multiplier : 1) +
      output * rate.output * (over ? rate.output_multiplier : 1)) /
    1_000_000;
  return Number.isFinite(cost) ? cost : null;
}

function settleClaude(prices, model, usage) {
  const cost = priceUsage(prices, 'claude', model, usage, { aggregate: true });
  if (cost === null) return null;
  const reported = usage.costUSD;
  return prices.models[model].above && Number.isFinite(reported) ? Math.max(cost, reported) : cost;
}

function readJson(file, fallback) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;
}

function saveJson(file, content) {
  writeFileSync(`${file}.${process.pid}.tmp`, JSON.stringify(content) + '\n');
  renameSync(`${file}.${process.pid}.tmp`, file);
}

function trialSpend(directory) {
  const author = readJson(join(directory, 'author-spend.json'), {});
  const reviewPath = join(directory, 'review-usage.jsonl');
  const calls = new Map();
  for (const line of existsSync(reviewPath)
    ? readFileSync(reviewPath, 'utf8').trim().split('\n')
    : []) {
    if (!line) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (!event.started && (event.unpriced || Number.isFinite(event.cost_usd))) {
      calls.set(`${event.id}:${event.thread ?? ''}`, event.unpriced ? NaN : event.cost_usd);
    }
  }
  return (author.cost_usd ?? 0) + [...calls.values()].reduce((sum, cost) => sum + cost, 0);
}

module.exports = { priceUsage, readJson, saveJson, settleClaude, trialSpend };
