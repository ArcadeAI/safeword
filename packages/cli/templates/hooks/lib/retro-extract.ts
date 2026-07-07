// Safeword: retro headless-extraction helpers (ticket 7D8PJP).
//
// The invisible-retro path runs extraction in a separate headless `claude -p`
// session launched by the Stop hook — never injected into the user's
// conversation. This module holds the pieces that path needs: a transcript
// DIGEST (transcripts are multi-MB, far past any model context), and — added in
// later steps — the headless argv builder, the recursion-guard predicate, and the
// synchronous runner. Agent-neutral where possible; Claude-specific bits are
// named as such.

import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { iterateJsonlEntries } from './jsonl-spool.js';

/**
 * Default cap (chars) for a transcript digest. A real session transcript is tens
 * of MB; the extractor needs a bounded, signal-dense slice, not the raw JSONL.
 */
export const DIGEST_CAP = 180_000;

/**
 * Default Claude extraction model. Sonnet, not haiku: measured head-to-head on
 * the same transcript, haiku surfaced 1–3 weak findings vs sonnet's 9 strong
 * ones (ZFGWS1). Overridable per install via `.safeword/config.json` →
 * `retro.model`.
 */
export const DEFAULT_CLAUDE_RETRO_MODEL = 'sonnet';

/** Default Codex extraction model. Stock Codex can only call OpenAI models. */
export const DEFAULT_CODEX_RETRO_MODEL = 'gpt-5.5';

/** Backward-compatible alias for existing Claude call sites/tests. */
export const DEFAULT_RETRO_MODEL = DEFAULT_CLAUDE_RETRO_MODEL;

export type RetroAgent = 'claude' | 'codex';

function defaultRetroModel(agent: RetroAgent): string {
  return agent === 'codex' ? DEFAULT_CODEX_RETRO_MODEL : DEFAULT_CLAUDE_RETRO_MODEL;
}

/**
 * Resolve the extraction model for an install: `retro.model` from
 * `.safeword/config.json`, else the per-agent default. Fail-open to the default
 * on any missing/unreadable/malformed config — model selection must never break
 * the out-of-band retro run.
 */
export function resolveRetroModel(projectDirectory: string, agent: RetroAgent = 'claude'): string {
  try {
    const raw = readFileSync(nodePath.join(projectDirectory, '.safeword', 'config.json'), 'utf8');
    const parsed = JSON.parse(raw) as { retro?: { model?: unknown } };
    const model = parsed.retro?.model;
    return typeof model === 'string' && model.length > 0 ? model : defaultRetroModel(agent);
  } catch {
    return defaultRetroModel(agent);
  }
}

/**
 * Overlap (chars) re-included before a delta window's start, so a finding
 * straddling a window boundary appears whole in one fire (ticket ZFGWS1). A
 * char-slice may cut the first JSONL line; `buildDigest` skips that malformed head
 * line, so whole boundary entries still survive. Duplicate findings from the
 * overlap are absorbed by signature dedupe (triage).
 */
export const OVERLAP_CHARS = 2048;

/**
 * Slice the delta window a fire should digest: from `windowStart` (the previous
 * fire's recorded offset) minus a small overlap, to the end. The FIRST fire
 * (`windowStart <= 0`) returns the whole transcript so far. So `buildDigest`'s cap
 * applies to the WINDOW, not the chronological head — defeating the head-cap that
 * made plain re-arm inert. The overlap is clamped at the start of the transcript.
 */
export function windowFor(
  transcript: string,
  windowStart: number,
  overlap: number = OVERLAP_CHARS,
): string {
  if (windowStart <= 0) return transcript;
  return transcript.slice(Math.max(0, windowStart - overlap));
}

/** A decision to run the retro child, carrying the delta window + stable session id. */
export interface RetroChildInvocation {
  transcriptPath: string;
  windowStart: number;
  sessionId: string;
}

/**
 * Build the `safeword retro` argv the Stop hook spawns out-of-band. Forwards the
 * delta window offset and the resolved session id (ZFGWS1) so the child digests
 * only the new window and attributes findings to the real session — not the
 * 'unknown' fallback its own env resolves to in cloud.
 */
export function retroChildArgs(invocation: RetroChildInvocation): string[] {
  return [
    'retro',
    '--auto-extract',
    '--transcript',
    invocation.transcriptPath,
    '--window-start',
    String(invocation.windowStart),
    '--session-id',
    invocation.sessionId,
  ];
}

/**
 * The headless extractor only ever READS the digest — never writes, edits, or
 * runs shell. A read-only allow-list keeps the out-of-band child from mutating
 * the working tree or exfiltrating via a tool.
 */
const READ_ONLY_TOOLS = 'Read';

/**
 * Env sentinel set on the headless child. The auth-working invocation does NOT
 * use `--bare`, so the child loads safeword's hooks; the retro Stop hook checks
 * this and early-returns, so the child can't re-trigger retro (infinite spawn) —
 * and stop-retro is the only hook that recursively spawns `claude -p`, so guarding
 * it is sufficient. NOT `--bare` (breaks cloud auth) and NOT `CLAUDE_CODE_CHILD_SESSION`
 * (already `1` in the normal tool context, so it can't distinguish a retro child).
 */
export const RETRO_CHILD_ENV = 'SAFEWORD_RETRO_CHILD';

/** Whether the current process is a retro headless child (recursion guard). */
export function isRetroChild(env: Record<string, string | undefined>): boolean {
  return (env[RETRO_CHILD_ENV] ?? '').length > 0;
}

/**
 * Override for the command the Stop hook spawns to run the extraction CLI. When
 * set, the hook spawns this command verbatim instead of resolving `safeword retro
 * --auto-extract`. A test/advanced seam so the hook's invisibility can be proven
 * without launching a real headless `claude -p`.
 */
export const RETRO_EXTRACT_CMD_ENV = 'SAFEWORD_RETRO_EXTRACT_CMD';

export interface ExtractArgvOptions {
  /** Model for the headless extraction (cheap by default — see the caller). */
  model: string;
  /** System prompt appended to the extractor's default behavior. */
  systemPrompt: string;
  /** The task prompt (trailing positional) — instructs reading the digest. */
  prompt: string;
}

/**
 * Build the `claude` argv for a headless, isolated retro extraction. Print mode
 * + JSON output, a read-only tool set, and — load-bearing — NO `--bare`: `--bare`
 * skips the managed-provider setup a Claude cloud container authenticates through
 * (proven live: `--bare` → Authentication error). The returned array excludes the
 * `claude` binary itself; the runner supplies it.
 */
export function buildExtractArgv(options: ExtractArgvOptions): string[] {
  return [
    '-p',
    '--model',
    options.model,
    '--allowed-tools',
    READ_ONLY_TOOLS,
    '--output-format',
    'json',
    '--append-system-prompt',
    options.systemPrompt,
    options.prompt,
  ];
}

export interface CodexExtractArgvOptions {
  /** OpenAI model for the child `codex exec` process. */
  model: string;
  /** JSON schema path supplied to `--output-schema`. */
  schemaPath: string;
  /** JSON output path supplied to `-o`. */
  outputPath: string;
  /** Inline digest + task prompt. No Read/MCP tools are available. */
  prompt: string;
}

/**
 * Build the `codex exec` argv for a headless retro extraction. The digest is
 * inline in the prompt because `--output-schema` is ignored by Codex when the
 * task requires Read/MCP tool use. Hooks and MCP servers are explicitly disabled,
 * stdin is closed by the runner, and the sandbox is read-only.
 */
export function buildCodexExtractArgv(options: CodexExtractArgvOptions): string[] {
  return [
    'exec',
    '--ignore-user-config',
    '--disable',
    'hooks',
    '-c',
    'mcp_servers={}',
    '--output-schema',
    options.schemaPath,
    '-o',
    options.outputPath,
    '--json',
    '--sandbox',
    'read-only',
    '-m',
    options.model,
    options.prompt,
  ];
}

// The extraction rules, mirrored from templates/guides/retro.md: SAFEWORD's own
// friction only, the constrained snake_case schema, no invention. The egress
// guard sanitizes downstream, so the child writes plainly. Exported for the
// string-contract tests (PNZM3B) — the guidance IS a tested surface.
export const EXTRACT_SYSTEM_PROMPT =
  "You extract SAFEWORD's OWN friction from a session digest. Output ONLY a JSON " +
  'array (no prose). Each item: {"category":"bug|rough-edge|gap","title":"canonical ' +
  'title of the SAFEWORD behavior","safeword_surface":"a real safeword path: ' +
  'hooks/…, packages/cli/…, templates/…, dist/…, or .safeword/…; for friction ' +
  'with no single-file surface use process/<area>, a short lowercase-hyphen area ' +
  'like process/tdd-loop","what_happened":"",' +
  '"why_friction":"","repro":"in terms of safeword commands"}. Rules: SAFEWORD\'s ' +
  'friction only (not the host project, not Claude Code itself); canonical ' +
  'behavior-titles; do not invent; [] if none.';

// Exported for the string-contract tests (PNZM3B) — parity with the shared
// prompt's surface guidance is a tested invariant.
export const CODEX_RETRO_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          category: { type: 'string', enum: ['bug', 'rough-edge', 'gap'] },
          title: { type: 'string' },
          safeword_surface: {
            type: 'string',
            description:
              'A real safeword path (hooks/…, packages/cli/…, templates/…, dist/…, .safeword/…); for friction with no single-file surface use process/<area>, e.g. process/tdd-loop',
          },
          what_happened: { type: 'string' },
          why_friction: { type: 'string' },
          repro: { type: 'string' },
        },
        required: [
          'category',
          'title',
          'safeword_surface',
          'what_happened',
          'why_friction',
          'repro',
        ],
      },
    },
  },
  required: ['findings'],
};

/** The task prompt: point the read-only child at the digest file. */
function buildExtractPrompt(digestPath: string): string {
  return `Read the file ${digestPath} and extract SAFEWORD's own friction as the JSON array described. Output only the JSON array.`;
}

function buildCodexExtractPrompt(digest: string): string {
  return (
    `${EXTRACT_SYSTEM_PROMPT}\n\n` +
    'Return only JSON matching the provided output schema: {"findings":[...]}. ' +
    'Use an empty findings array when there is no safeword friction.\n\n' +
    `Transcript digest:\n${digest}`
  );
}

/** Parse a findings array out of a `claude -p --output-format json` envelope. */
function parseFindings(stdout: string): unknown[] {
  let envelopeResult: string;
  try {
    const parsed = JSON.parse(stdout) as { result?: unknown };
    if (typeof parsed.result !== 'string') return [];
    envelopeResult = parsed.result;
  } catch {
    return [];
  }
  // The model's text may be fenced (```json … ```); pull the first array literal.
  const match = envelopeResult.match(/\[[\S\s]*\]/);
  if (!match) return [];
  try {
    const findings = JSON.parse(match[0]) as unknown;
    return Array.isArray(findings) ? findings : [];
  } catch {
    return [];
  }
}

function parseCodexFindingsOutput(rawOutput: string): unknown[] | undefined {
  try {
    const parsed = JSON.parse(rawOutput) as { findings?: unknown };
    return Array.isArray(parsed.findings) ? parsed.findings : undefined;
  } catch {
    return undefined;
  }
}

/** Result of spawning the headless extractor. */
export interface SpawnResult {
  code: number | null;
  stdout: string;
}

/** Dependencies for `runHeadlessExtraction` — the process boundaries, injected. */
export interface RunExtractionDeps {
  /** Spawn `claude` with argv; resolve with exit code + stdout. Awaited (sync). */
  spawn: (
    argv: string[],
    options: { cwd: string; env: Record<string, string | undefined> },
  ) => Promise<SpawnResult>;
  /** Persist the digest to a file the read-only child can Read; return its path. */
  writeDigest: (digest: string) => string;
  /** Base env for the child (the sentinel is added here). */
  env: Record<string, string | undefined>;
  /** Neutral cwd — NOT the user's project — so project hooks don't load. */
  cwd: string;
  /** Extraction model (cheap by default). */
  model?: string;
}

export interface CodexSpawnOptions {
  cwd: string;
  env: Record<string, string | undefined>;
  stdio: 'ignore';
}

/** Dependencies for `runCodexHeadlessExtraction` — injected for tests. */
export interface RunCodexExtractionDeps {
  /** Spawn `codex` with argv; resolve after the child exits. Awaited (sync). */
  spawn: (argv: string[], options: CodexSpawnOptions) => Promise<SpawnResult>;
  /** Persist the output schema file read by `codex exec --output-schema`. */
  writeFile?: (path: string, content: string) => void;
  /** Read the `-o` JSON file written by `codex exec`. */
  readFile?: (path: string) => string;
  /** Base env for the child (the sentinel is added here). */
  env: Record<string, string | undefined>;
  /** Neutral cwd — NOT the user's project — so project hooks don't load. */
  cwd: string;
  /** Extraction model (OpenAI default for Codex). */
  model?: string;
  /** Test seam for deterministic schema/output paths. */
  schemaPath?: string;
  outputPath?: string;
}

export interface CodexExtractionResult {
  /** True only when the child exited successfully and wrote schema-valid JSON. */
  ok: boolean;
  findings: unknown[];
}

/**
 * Run the retro extraction in a separate, isolated headless `claude -p` session
 * and return the raw findings array. Synchronous (awaits the spawn) and
 * fail-OPEN: any error — non-zero exit, unparseable output, a spawn throw —
 * yields `[]` and never throws, so the Stop hook that wraps this stays silent and
 * never blocks. Spawn contract: the digest is the input (referenced in the
 * prompt), the child runs from the neutral cwd, and the child env carries
 * `SAFEWORD_RETRO_CHILD=1` (recursion guard).
 */
export async function runHeadlessExtraction(
  transcript: string,
  dependencies: RunExtractionDeps,
): Promise<unknown[]> {
  try {
    const digestPath = dependencies.writeDigest(buildDigest(transcript));
    const argv = buildExtractArgv({
      model: dependencies.model ?? DEFAULT_RETRO_MODEL,
      systemPrompt: EXTRACT_SYSTEM_PROMPT,
      prompt: buildExtractPrompt(digestPath),
    });
    const { code, stdout } = await dependencies.spawn(argv, {
      cwd: dependencies.cwd,
      env: { ...dependencies.env, [RETRO_CHILD_ENV]: '1' },
    });
    if (code !== 0) return []; // fail-open on a failed extraction
    return parseFindings(stdout);
  } catch {
    return []; // fail-open on any spawn/IO error
  }
}

/**
 * Run Codex retro extraction in a separate `codex exec` child and return the raw
 * findings array with a success bit. Synchronous (awaits the child) and
 * fail-OPEN: any non-zero exit, missing output, malformed JSON, or
 * spawn/read/write error yields `{ ok:false, findings:[] }`.
 */
export async function runCodexHeadlessExtractionChecked(
  transcript: string,
  dependencies: RunCodexExtractionDeps,
): Promise<CodexExtractionResult> {
  try {
    const schemaPath = dependencies.schemaPath ?? nodePath.join(dependencies.cwd, 'schema.json');
    const outputPath = dependencies.outputPath ?? nodePath.join(dependencies.cwd, 'output.json');
    const writeFile = dependencies.writeFile ?? writeFileSync;
    const readFile = dependencies.readFile ?? ((path: string) => readFileSync(path, 'utf8'));

    writeFile(schemaPath, JSON.stringify(CODEX_RETRO_OUTPUT_SCHEMA));
    const argv = buildCodexExtractArgv({
      model: dependencies.model ?? DEFAULT_CODEX_RETRO_MODEL,
      schemaPath,
      outputPath,
      prompt: buildCodexExtractPrompt(buildDigest(transcript)),
    });
    const { code } = await dependencies.spawn(argv, {
      cwd: dependencies.cwd,
      env: { ...dependencies.env, [RETRO_CHILD_ENV]: '1' },
      stdio: 'ignore',
    });
    if (code !== 0) return { ok: false, findings: [] };
    const findings = parseCodexFindingsOutput(readFile(outputPath));
    return findings === undefined ? { ok: false, findings: [] } : { ok: true, findings };
  } catch {
    return { ok: false, findings: [] };
  }
}

/**
 * Backward-compatible fail-open wrapper for call sites that only need findings.
 */
export async function runCodexHeadlessExtraction(
  transcript: string,
  dependencies: RunCodexExtractionDeps,
): Promise<unknown[]> {
  return (await runCodexHeadlessExtractionChecked(transcript, dependencies)).findings;
}

// A tool-result body is kept whole only when it's short OR carries a friction
// signal (errors/failures/gate blocks are exactly what retro mines); larger
// non-signal bodies are dropped so they can't crowd out text + tool-use names.
const SHORT_RESULT = 600;
/** Cap for a tool_use's serialized input in the digest — names it enough, not the whole payload. */
const TOOL_USE_INPUT_CAP = 300;
const FRICTION = /error|fail|block|denied|stale|drift|guard|FAILED/i;

interface ContentItem {
  type?: string;
  text?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
}

interface TranscriptEntry {
  type?: string;
  message?: { role?: string; content?: ContentItem[] | string };
}

function lineFor(item: ContentItem, role: string): string | undefined {
  if (item.type === 'text' && item.text) return `[${role}] ${item.text}`;
  if (item.type === 'tool_use' && item.name)
    return `[tool_use] ${item.name}: ${JSON.stringify(item.input ?? {}).slice(0, TOOL_USE_INPUT_CAP)}`;
  if (item.type === 'tool_result') {
    const text =
      typeof item.content === 'string' ? item.content : JSON.stringify(item.content ?? '');
    // Keep short results, or longer ones only when they carry a friction signal.
    if (text && (text.length < SHORT_RESULT || FRICTION.test(text)))
      return `[tool_result] ${text.slice(0, SHORT_RESULT)}`;
  }
  return undefined;
}

/**
 * Reduce a raw JSONL transcript to a signal-dense digest under `cap` chars:
 * user/assistant text + tool-use names + short/error-ish tool results. Oversized
 * non-signal tool-result bodies are omitted (not just truncated), so they can't
 * crowd out the markers the extractor needs. Malformed lines are skipped, never
 * thrown — a hook must not crash on a partial transcript.
 */
export function buildDigest(rawTranscript: string, cap: number = DIGEST_CAP): string {
  const out: string[] = [];
  for (const raw of iterateJsonlEntries(rawTranscript)) {
    const entry = raw as TranscriptEntry;
    const role = entry.message?.role ?? entry.type ?? 'entry';
    const content = entry.message?.content;
    if (typeof content === 'string') {
      out.push(`[${role}] ${content}`);
    } else if (Array.isArray(content)) {
      for (const item of content) {
        const rendered = lineFor(item, role);
        if (rendered !== undefined) out.push(rendered);
      }
    }
  }
  const digest = out.join('\n');
  return digest.length > cap ? digest.slice(0, cap) : digest;
}
