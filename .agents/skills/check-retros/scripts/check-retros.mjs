import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL, URL } from 'node:url';

const RELAY_ORIGIN = 'https://retro-relay-production.up.railway.app';
const COLLECTOR_ORIGIN = 'https://retro-collector-production.up.railway.app';
const COUNT_FIELDS = [
  'accepted',
  'ambiguous',
  'claimed',
  'dead-letter',
  'dispatching',
  'filed',
  'rejected',
  'retryable',
  'tombstone',
];
const SOURCE_FIELDS = [
  'harness',
  'hostClass',
  'projectUUID',
  'safewordCliVersion',
  'repository',
  'agentVersion',
  'model',
  'safewordPluginVersion',
  'osFamily',
];
const alphabetically = (left, right) => left.localeCompare(right);

async function readJson(url, options = {}) {
  const response = await globalThis.fetch(url, {
    ...options,
    redirect: 'error',
    signal: globalThis.AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${url} returned non-JSON content`);
  }
}

function selectFields(value, fields, required, label) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} returned an invalid response`);
  }
  for (const field of required) {
    if (!Object.hasOwn(value, field)) throw new Error(`${label} is missing ${field}`);
  }
  return Object.fromEntries(
    fields.filter(field => Object.hasOwn(value, field)).map(field => [field, Reflect.get(value, field)]),
  );
}

function safeHealth(value) {
  const health = selectFields(
    value,
    ['status', 'schemaVersion', 'replicaId', 'bootId'],
    ['status'],
    'health',
  );
  if (typeof health.status !== 'string') throw new Error('health status is not text');
  return health;
}

function validateCounts(counts) {
  if (typeof counts !== 'object' || counts === null || Array.isArray(counts)) {
    throw new Error('relay operations counts is not an object');
  }
  const countKeys = Object.keys(counts).toSorted(alphabetically);
  if (countKeys.join('\0') !== COUNT_FIELDS.toSorted(alphabetically).join('\0')) {
    throw new Error('relay operations counts has an unexpected shape');
  }
  for (const field of COUNT_FIELDS) {
    const count = Reflect.get(counts, field);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`relay operations count ${field} is not a nonnegative integer`);
    }
  }
}

function safeOperations(value) {
  const operations = selectFields(
    value,
    ['counts', 'oldestQueuedAgeSeconds', 'schemaVersion', 'bootId'],
    ['counts', 'oldestQueuedAgeSeconds'],
    'relay operations',
  );
  validateCounts(operations.counts);
  if (
    typeof operations.oldestQueuedAgeSeconds !== 'number' ||
    !Number.isFinite(operations.oldestQueuedAgeSeconds) ||
    operations.oldestQueuedAgeSeconds < 0
  ) {
    throw new Error('relay operations oldestQueuedAgeSeconds is not a nonnegative number');
  }
  return operations;
}

function safeRelayReceipt(value) {
  const receipt = selectFields(
    value,
    ['receiptId', 'requestId', 'state', 'issueNumber'],
    ['receiptId', 'requestId', 'state'],
    'relay receipt',
  );
  receipt.receiptId = boundedText(receipt.receiptId, 200, 'relay receipt receiptId');
  receipt.requestId = boundedText(receipt.requestId, 200, 'relay receipt requestId');
  receipt.state = boundedText(receipt.state, 32, 'relay receipt state');
  if (Object.hasOwn(receipt, 'issueNumber') && !Number.isSafeInteger(receipt.issueNumber)) {
    throw new Error('relay receipt issueNumber is not an integer');
  }
  return receipt;
}

function boundedText(value, limit, label) {
  if (typeof value !== 'string') throw new Error(`${label} is not text`);
  const characters = [...value];
  return characters.length > limit ? `${characters.slice(0, limit).join('')}…` : value;
}

function safeCollectorSubmission(value) {
  const submission = selectFields(
    value,
    ['version', 'finding', 'source', 'sessionScope'],
    ['finding'],
    'collector submission',
  );
  if (Object.hasOwn(submission, 'version')) {
    submission.version = boundedText(submission.version, 20, 'collector submission version');
  }
  submission.finding = boundedText(submission.finding, 500, 'collector submission finding');
  if (Object.hasOwn(submission, 'source')) {
    const source = selectFields(submission.source, SOURCE_FIELDS, [], 'collector source');
    submission.source = Object.fromEntries(
      Object.entries(source).map(([field, fieldValue]) => [
        field,
        boundedText(fieldValue, 200, `collector source ${field}`),
      ]),
    );
  }
  if (Object.hasOwn(submission, 'sessionScope')) {
    submission.sessionScope = boundedText(
      submission.sessionScope,
      200,
      'collector submission sessionScope',
    );
  }
  return { trust: 'untrusted-submitter-content', data: submission };
}

function authorization(credential) {
  if (typeof credential !== 'string' || credential.length === 0) {
    throw new Error('operator credential is unavailable');
  }
  return { authorization: `Bearer ${credential}` };
}

function operatorCredential(environmentName, keychainService) {
  const injected = Reflect.get(process.env, environmentName);
  if (process.env.CHECK_RETROS_TEST_MODE === '1') return injected ?? '';
  if (injected || process.platform !== 'darwin') return injected ?? '';
  try {
    return execFileSync(
      '/usr/bin/security',
      ['find-generic-password', '-a', 'safeword', '-s', keychainService, '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
  } catch {
    return '';
  }
}

function serviceOrigin(testVariable, productionOrigin) {
  if (process.env.CHECK_RETROS_TEST_MODE !== '1') return productionOrigin;
  const origin = Reflect.get(process.env, testVariable);
  if (!origin) throw new Error(`${testVariable} is required in test mode`);
  const parsed = new URL(origin);
  if (
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', '::1', 'localhost'].includes(parsed.hostname)
  ) {
    throw new Error(`${testVariable} must be a loopback HTTP origin`);
  }
  return origin;
}

export async function inspectRelay({ origin = RELAY_ORIGIN, credential, receiptId }) {
  const headers = authorization(credential);
  const health = safeHealth(await readJson(`${origin}/health`));
  const operations = safeOperations(
    await readJson(`${origin}/v1/operations/retro-filings`, { headers }),
  );
  const result = { service: 'retro-relay', health, operations };
  if (receiptId !== undefined) {
    result.receipt = safeRelayReceipt(
      await readJson(`${origin}/v1/retro-filings/${encodeURIComponent(receiptId)}`, { headers }),
    );
  }
  return result;
}

export async function inspectCollector({ origin = COLLECTOR_ORIGIN, credential, receiptId }) {
  const health = safeHealth(await readJson(`${origin}/health`));
  const result = { service: 'retro-collector', health };
  if (receiptId !== undefined) {
    result.submission = safeCollectorSubmission(
      await readJson(`${origin}/v1/public-retros/${encodeURIComponent(receiptId)}`, {
        headers: authorization(credential),
      }),
    );
  }
  return result;
}

async function main() {
  const [mode, receiptId, extra] = process.argv.slice(2);
  if (
    !['relay', 'collector'].includes(mode) ||
    extra !== undefined ||
    (receiptId !== undefined && !/^[\w-]{1,200}$/u.test(receiptId))
  ) {
    throw new Error('usage: check-retros.mjs <relay|collector> [receipt-id]');
  }
  const result =
    mode === 'relay'
      ? await inspectRelay({
          origin: serviceOrigin('CHECK_RETROS_RELAY_ORIGIN', RELAY_ORIGIN),
          credential: operatorCredential(
            'SAFEWORD_RETRO_RELAY_OPERATOR_CREDENTIAL',
            'safeword-retro-relay-operator',
          ),
          receiptId,
        })
      : await inspectCollector({
          origin: serviceOrigin('CHECK_RETROS_COLLECTOR_ORIGIN', COLLECTOR_ORIGIN),
          ...(receiptId !== undefined && {
            credential: operatorCredential(
              'SAFEWORD_PUBLIC_RETRO_OPERATOR_CREDENTIAL',
              'safeword-retro-collector-operator',
            ),
          }),
          receiptId,
        });
  process.stdout.write(`${JSON.stringify(result, undefined, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'retro inspection failed'}\n`);
    process.exitCode = 1;
  }
}
