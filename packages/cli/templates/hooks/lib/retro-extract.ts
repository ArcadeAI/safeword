// Safeword: retro headless-extraction helpers (ticket 7D8PJP).
//
// The invisible-retro path runs extraction in a separate headless `claude -p`
// session launched by the Stop hook — never injected into the user's
// conversation. This module holds the pieces that path needs: a transcript
// DIGEST (transcripts are multi-MB, far past any model context), and — added in
// later steps — the headless argv builder, the recursion-guard predicate, and the
// synchronous runner. Agent-neutral where possible; Claude-specific bits are
// named as such.

/**
 * Default cap (chars) for a transcript digest. A real session transcript is tens
 * of MB; the extractor needs a bounded, signal-dense slice, not the raw JSONL.
 */
export const DIGEST_CAP = 180_000;

/**
 * Overlap (chars) re-included before a delta window's start, so a finding
 * straddling a window boundary appears whole in one fire (ticket ZFGWS1). A
 * char-slice may cut the first JSONL line; `buildDigest` skips that malformed head
 * line, so whole boundary entries still survive. Duplicate findings from the
 * overlap are absorbed by signature dedupe (triage).
 */
export const OVERLAP_BYTES = 2048;

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
  overlap: number = OVERLAP_BYTES,
): string {
  if (windowStart <= 0) return transcript;
  return transcript.slice(Math.max(0, windowStart - overlap));
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

// The extraction rules, mirrored from templates/guides/retro.md: SAFEWORD's own
// friction only, the constrained snake_case schema, no invention. The egress
// guard sanitizes downstream, so the child writes plainly.
const EXTRACT_SYSTEM_PROMPT =
  "You extract SAFEWORD's OWN friction from a session digest. Output ONLY a JSON " +
  'array (no prose). Each item: {"category":"bug|rough-edge|gap","title":"canonical ' +
  'title of the SAFEWORD behavior","safeword_surface":"a real safeword path: ' +
  'hooks/…, packages/cli/…, templates/…, dist/…, or .safeword/…","what_happened":"",' +
  '"why_friction":"","repro":"in terms of safeword commands"}. Rules: SAFEWORD\'s ' +
  'friction only (not the host project, not Claude Code itself); canonical ' +
  'behavior-titles; do not invent; [] if none.';

/** The task prompt: point the read-only child at the digest file. */
function buildExtractPrompt(digestPath: string): string {
  return `Read the file ${digestPath} and extract SAFEWORD's own friction as the JSON array described. Output only the JSON array.`;
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
      model: dependencies.model ?? 'haiku',
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

// A tool-result body is kept whole only when it's short OR carries a friction
// signal (errors/failures/gate blocks are exactly what retro mines); larger
// non-signal bodies are dropped so they can't crowd out text + tool-use names.
const SHORT_RESULT = 600;
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
    return `[tool_use] ${item.name}: ${JSON.stringify(item.input ?? {}).slice(0, 300)}`;
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
  const trimmed = rawTranscript.trim();
  if (trimmed.length === 0) return '';
  const out: string[] = [];
  for (const line of trimmed.split('\n')) {
    let entry: TranscriptEntry;
    try {
      entry = JSON.parse(line) as TranscriptEntry;
    } catch {
      continue; // skip malformed JSONL
    }
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
