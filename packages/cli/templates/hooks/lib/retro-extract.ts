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
 * The headless extractor only ever READS the digest — never writes, edits, or
 * runs shell. A read-only allow-list keeps the out-of-band child from mutating
 * the working tree or exfiltrating via a tool.
 */
const READ_ONLY_TOOLS = 'Read';

/**
 * Env sentinel set on the headless child. The auth-working invocation does NOT
 * use `--bare`, so the child loads safeword's hooks; every safeword hook checks
 * this and early-returns, so the child can't re-trigger retro (infinite spawn).
 * NOT `--bare` (breaks cloud auth) and NOT `CLAUDE_CODE_CHILD_SESSION` (already
 * `1` in the normal tool context, so it can't distinguish a retro child).
 */
export const RETRO_CHILD_ENV = 'SAFEWORD_RETRO_CHILD';

/** Whether the current process is a retro headless child (recursion guard). */
export function isRetroChild(env: Record<string, string | undefined>): boolean {
  return (env[RETRO_CHILD_ENV] ?? '').length > 0;
}

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
