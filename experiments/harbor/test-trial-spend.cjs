const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { test } = require('node:test');
const pricing = require('./provider-rates.json');
const { priceUsage, readJson, saveJson, settleClaude, trialSpend } = require('./trial-spend.cjs');

const model = 'claude-opus-5-5';

test('Claude settles cumulative usage, including the cache write TTL', () => {
  assert.equal(
    settleClaude(pricing, model, {
      inputTokens: 28,
      outputTokens: 8958,
      cacheReadInputTokens: 606647,
      cacheCreationInputTokens: 45977,
      cacheCreationEphemeral1hInputTokens: 45977,
    }),
    0.6684174,
  );
  assert.equal(
    priceUsage(pricing, 'codex', 'gpt-6.2-sol', {
      inputTokens: 1000,
      cachedInputTokens: 400,
      outputTokens: 100,
    }),
    0.00224,
  );
});

test('Claude uses the default five-minute price for unclassified cache writes', () => {
  const usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1000000 };
  assert.equal(priceUsage(pricing, 'claude', model, usage), 5);
  assert.equal(
    settleClaude(pricing, model, {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 1000000,
    }),
    5,
  );
  assert.equal(
    priceUsage(pricing, 'claude', model, {
      ...usage,
      cache_creation: { ephemeral_5m_input_tokens: 750000, ephemeral_1h_input_tokens: 250000 },
    }),
    5.75,
  );
});

test('the combined cap includes each review attempt and survives an author resume', t => {
  const logs = mkdtempSync(join(tmpdir(), 'harbor-spend-'));
  t.after(() => rmSync(logs, { recursive: true, force: true }));
  const comparison = join(logs, 'comparison.json');
  const author = join(logs, 'author-spend.json');
  const budgetStop = join(logs, 'budget-stop.json');
  saveJson(comparison, { pricing, models: { author: model } });
  saveJson(author, { cost_usd: 0.6, messages: { previous: 0.5 }, settled_delta_usd: 0.1 });
  const reviews = [
    { id: 'review', thread: 'thread', cost_usd: 0.07 },
    { id: 'review', thread: 'thread', cost_usd: 0.13 },
    { id: 'retry', cost_usd: 0.1 },
  ];
  writeFileSync(
    join(logs, 'review-usage.jsonl'),
    reviews.map(event => JSON.stringify(event)).join('\n'),
  );
  assert.equal(trialSpend(logs), 0.83);

  const script = join(logs, 'resume.cjs');
  writeFileSync(
    script,
    `
    const trace = (id, output) => console.log(JSON.stringify({
      type: 'assistant',
      message: { id, model: '${model}', usage: { input_tokens: 0, output_tokens: output } },
    }));
    trace('previous', 25000);
    trace('new', 5000);
    console.log(JSON.stringify({
      type: 'result',
      is_error: false,
      modelUsage: { '${model}': { inputTokens: 0, outputTokens: 40000 } },
    }));
    setInterval(() => {}, 1000);
  `,
  );
  const result = spawnSync(
    process.execPath,
    [
      join(__dirname, 'supervise-claude.mjs'),
      'node ' + JSON.stringify(script),
      '30',
      comparison,
      '1.00',
    ],
    { encoding: 'utf8', timeout: 8000 },
  );
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  assert.equal(readJson(budgetStop).reason, 'combined_cap');
  assert.ok(Math.abs(trialSpend(logs) - 1.03) < 1e-12);
});

test('Claude intake uses its selected host model for messages and terminal usage', t => {
  const logs = mkdtempSync(join(tmpdir(), 'harbor-intake-model-'));
  t.after(() => rmSync(logs, { recursive: true, force: true }));
  const comparison = join(logs, 'comparison.json');
  const otherPricedModel = 'claude-haiku-5-5';
  saveJson(comparison, { pricing, models: { author: otherPricedModel, claude: model } });
  const script = join(logs, 'trace.jsonl');
  const run = actual => {
    const events = [
      {
        type: 'assistant',
        message: { id: 'msg', model: actual, usage: { input_tokens: 0, output_tokens: 10 } },
      },
      {
        type: 'result',
        is_error: false,
        modelUsage: { [actual]: { inputTokens: 0, outputTokens: 10 } },
      },
    ];
    writeFileSync(script, events.map(event => JSON.stringify(event)).join('\n') + '\n');
    const result = spawnSync(
      process.execPath,
      [
        join(__dirname, 'supervise-claude.mjs'),
        'cat ' + JSON.stringify(script) + (actual === model ? '' : ' && sleep 5'),
        '5',
        comparison,
        '2',
        model,
      ],
      { encoding: 'utf8', timeout: 8000 },
    );
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
    return readJson(join(logs, 'budget-stop.json'), null);
  };
  assert.equal(run(model), null);
  assert.ok(trialSpend(logs) > 0);
  assert.equal(run(otherPricedModel).reason, 'author_model_mismatch');
});

test('Codex reviewer prices each request across the long-context threshold once', t => {
  const dir = mkdtempSync(join(tmpdir(), 'harbor-review-meter-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const wrapper = join(dir, 'codex');
  const executable = join(dir, 'fake-cli.cjs');
  const usageFile = join(dir, 'review-usage.jsonl');
  const comparisonFile = join(dir, 'comparison.json');
  const model = 'gpt-6.2-sol';
  copyFileSync(join(__dirname, 'review-meter.cjs'), wrapper);
  saveJson(comparisonFile, { pricing });
  saveJson(wrapper + '.json', {
    provider: 'codex',
    executable,
    comparisonFile,
    usageFile,
    defaultModel: model,
    spendModule: join(__dirname, 'trial-spend.cjs'),
  });
  const update = (threadId, totalInput, lastInput) => ({
    method: 'thread/tokenUsage/updated',
    params: {
      threadId,
      tokenUsage: {
        total: { inputTokens: totalInput, outputTokens: 0 },
        last: { inputTokens: lastInput, outputTokens: 0 },
      },
    },
  });
  const events = [
    { result: { thread: { id: 'a' }, model } },
    update('a', 150000, 150000),
    update('a', 300000, 150000),
    update('a', 300000, 150000),
    { result: { thread: { id: 'b' }, model } },
    update('b', 400000, 100000),
  ];
  writeFileSync(
    executable,
    '#!/usr/bin/env node\nconsole.log(' +
      JSON.stringify(events.map(e => JSON.stringify(e)).join('\n')) +
      ');\n',
    { mode: 0o755 },
  );
  const child = spawnSync(process.execPath, [wrapper, 'app-server', '--stdio'], {
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  const ledger = readFileSync(usageFile, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));
  assert.deepEqual(
    ledger.filter(row => row.thread === 'a').map(row => row.cost_usd),
    [0.3, 0.6],
  );
  assert.equal(ledger.at(-1).unpriced, true);
  assert.ok(ledger.every(row => Number.isSafeInteger(row.observed_at_epoch_ms)));
});
