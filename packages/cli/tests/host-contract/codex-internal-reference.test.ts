import { parse } from 'smol-toml';
import { describe, expect, it } from 'vitest';

import {
  existingGrants,
  hasNativeControl,
  matchedReads,
} from '../../scripts/check-codex-internal-reference.js';
import captured from '../fixtures/host-contract/codex-literal-root-call.json' with { type: 'json' };
import newline from '../fixtures/host-contract/codex-newline-read-call.json' with { type: 'json' };

const target = '/owned/pilot/profile/plugins/cache/test/safeword/1.2.0/internal/testing/SKILL.md';
const marker = 'internal-reference-unique-body-marker';

function evidence(
  kind: 'function' | 'custom',
  input = `sed -n '1,240p' ${target}`,
  output: unknown = marker,
) {
  return [
    {
      type: 'response_item',
      payload: {
        type: kind === 'function' ? 'function_call' : 'custom_tool_call',
        call_id: 'read-1',
        ...(kind === 'function' ? { arguments: input } : { input }),
      },
    },
    {
      type: 'response_item',
      payload: {
        type: kind === 'function' ? 'function_call_output' : 'custom_tool_call_output',
        call_id: 'read-1',
        output,
      },
    },
  ] satisfies [unknown, unknown];
}

describe('internal reference observation', () => {
  const escapedDelimiter = String.raw`printf x \; cat ${target}`;
  const escapedQuote = String.raw`printf "\"; cat ${target}; \""`;
  it.each([
    `printf 'cat ${target}'; X="$(pwd)"`,
    `printf "$(printf 'ok; cat ${target};')"`,
    `cat "$(printf '${target}')"`,
    `X=$(pwd); cat ${target}`,
    `unknown-command; cat ${target}; X=$(pwd)`,
    `printf x # ; cat ${target}\nX=$(pwd)`,
    `printf x & if false\ncat ${target}\nfi\nX=$(pwd)`,
    `pwd || cat ${target}; X=$(pwd)`,
    `pwd && if false\ncat ${target}\nfi\nX=$(pwd)`,
    `f() { cat ${target}; }; X=$(pwd)`,
    `cat <<EOF\ncat ${target}\nEOF\nX=$(pwd)`,
    `${escapedDelimiter}\nX=$(pwd)`,
    `${escapedQuote}\nX=$(pwd)`,
    `cat ${target}$(printf .backup)`,
    'SKILL_ROOT=/owned; cat "$SKILL_ROOT/internal/testing/SKILL.md"; X=$(pwd)',
    `cat ${target}.backup; X=$(pwd)`,
  ])('rejects ambiguous or dynamic reads despite a matching output marker: %s', command => {
    const input = `await tools.exec_command(${JSON.stringify({ cmd: command })})`;
    expect(matchedReads(evidence('custom', input), target, marker)).toEqual([]);
  });
  it('decodes the captured guide read newline once before exact-path matching', () => {
    expect(matchedReads(evidence('custom', newline.input), newline.target, marker)).toEqual([
      'read-1',
    ]);
    const input = JSON.stringify({ cmd: `cat ${target}\n` });
    expect(matchedReads(evidence('function', input), target, marker)).toEqual(['read-1']);
  });
  it.each([
    String.raw`cat ${target}\ncat /wrong`,
    `printf 'cat ${target}'`,
    `printf ';cat ${target};'`,
    `printf '&& cat ${target}' && cat /wrong`,
    `printf "&& cat ${target}" && cat /wrong`,
    `cat ${target}.backup\n`,
    `cat $(printf '${target}')`,
    String.raw`cat \"${target}\"`,
  ])('rejects shell escapes, quoted text or incorrect operands: %s', command => {
    const input = `await tools.exec_command(${JSON.stringify({ cmd: command })})`;
    expect(matchedReads(evidence('custom', input), target, marker)).toEqual([]);
  });
  it.each([
    'await tools.exec_command({"cmd": command})',
    'await tools.exec_command({"cmd":"cat /wrong","cmd":"cat /owned"})',
    '{"cmd":42}',
    '{"command":["bash","-lc","cat /owned"]}',
    String.raw`await tools.exec_command({"cmd":"cat\q"})`,
  ])('reports unsupported or ambiguous command encoding as unavailable: %s', input => {
    expect(() => matchedReads(evidence('custom', input), target, marker)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported shell argument encoding',
    );
  });
  it('recognizes the captured code-mode literal-root read with correlated output', () => {
    // Actual captured input shape; synthetic unit output is never a native receipt.
    expect(matchedReads(evidence('custom', captured.input), captured.target, marker)).toEqual([
      'read-1',
    ]);
  });

  it.each([
    'SKILL_ROOT=/wrong; sed -n \'1,260p\' "$SKILL_ROOT/internal/testing/SKILL.md"',
    'SKILL_ROOT=/owned; SKILL_ROOT=/wrong; cat "$SKILL_ROOT/internal/testing/SKILL.md"',
    'SKILL_ROOT=/owned | cat "$SKILL_ROOT/internal/testing/SKILL.md"',
    'cat "$SKILL_ROOT/internal/testing/SKILL.md"',
    'SKILL_ROOT=$(pwd); cat "$SKILL_ROOT/internal/testing/SKILL.md"',
    'SKILL_ROOT=/owned; eval "SKILL_ROOT=/wrong"; cat "$SKILL_ROOT/internal/testing/SKILL.md"',
    'SKILL_ROOT=/owned; printf \'cat "$SKILL_ROOT/internal/testing/SKILL.md"\'',
    'SKILL_ROOT=/owned; printf \'; cat "$SKILL_ROOT/internal/testing/SKILL.md"; pwd\'; cat /wrong',
    "SKILL_ROOT=/owned; cat '$SKILL_ROOT/internal/testing/SKILL.md'",
    'SKILL_ROOT=/owned; cat "$SKILL_ROOT/internal/testing/SKILL.md.backup"',
  ])('rejects unsafe or incorrect root resolution: %s', command => {
    const input = `await tools.exec_command(${JSON.stringify({ cmd: command })})`;
    expect(
      matchedReads(evidence('custom', input), '/owned/internal/testing/SKILL.md', marker),
    ).toEqual([]);
  });
  it.each(['function', 'custom'] as const)(
    'correlates %s calls with string and content-block outputs',
    kind => {
      expect(matchedReads(evidence(kind), target, marker)).toEqual(['read-1']);
      const blocks = [{ type: 'input_text', text: `body\n<!-- ${marker} -->` }];
      expect(matchedReads(evidence(kind, `cat "${target}"`, blocks), target, marker)).toEqual([
        'read-1',
      ]);
    },
  );

  it.each([
    `${target}.backup`,
    '/another-profile/internal/testing/SKILL.md',
    'internal/testing/SKILL.md',
  ])('rejects a read of %s despite a marker in its output', wrongPath => {
    expect(matchedReads(evidence('custom', `cat ${wrongPath}`), target, marker)).toEqual([]);
  });

  it('requires the exact random marker from the read output', () => {
    expect(
      matchedReads(evidence('custom', undefined, 'body without marker'), target, marker),
    ).toEqual([]);
  });

  it('does not accept a marker from another call ID', () => {
    const entries = evidence('custom');
    entries[1].payload.call_id = 'unrelated';
    expect(() => matchedReads(entries, target, marker)).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE');
  });

  it('does not accept a marker supplied in tool input', () => {
    expect(() =>
      matchedReads(evidence('custom', `echo ${marker}; cat ${target}`), target, marker),
    ).toThrow('marker supplied as tool input');
  });

  it('treats an unrecognized call protocol as unavailable', () => {
    const entries = evidence('custom');
    entries[0].payload.type = 'future_tool_call';
    expect(() => matchedReads(entries, target, marker)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE: unrecognized rollout protocol',
    );
  });

  it('treats an unrecognized output representation as unavailable', () => {
    expect(() =>
      matchedReads(evidence('custom', undefined, { text: marker }), target, marker),
    ).toThrow('HOST_CONTRACT_PROOF_UNAVAILABLE: unknown tool output');
  });

  it('does not label an unavailable native shell as a product failure', () => {
    const entries = evidence(
      'custom',
      'pwd',
      'sandbox-exec: sandbox_apply: Operation not permitted',
    );
    expect(() => matchedReads(entries, target, marker)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE: native shell sandbox could not start',
    );
  });

  it('rejects naming the target separately from reading another copy', () => {
    expect(
      matchedReads(
        evidence('custom', `ls ${target}; cat /marketplace/internal/testing/SKILL.md`),
        target,
        marker,
      ),
    ).toEqual([]);
  });

  it('requires a native execution control rather than a completed wrapper', () => {
    expect(hasNativeControl(evidence('custom', 'pwd', 'Script completed\ncommand failed'))).toBe(
      false,
    );
    expect(hasNativeControl(evidence('custom', 'node --test', '# pass 5\n# fail 0'))).toBe(true);
  });

  it('copies existing trust without trailing project hook definitions', () => {
    const config =
      '[hooks.state."native"]\ntrusted_hash="unchanged"\n[hooks.SessionStart]\ncommand="untrusted-bootstrap"\n[projects."other"]\ntrust_level="trusted"\n';
    expect(parse(existingGrants(config))).toEqual({
      hooks: { state: { native: { trusted_hash: 'unchanged' } } },
    });
  });
});
