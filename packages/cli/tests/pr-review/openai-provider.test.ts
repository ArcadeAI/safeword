import { describe, expect, it } from 'vitest';

import { reviewWithOpenAI } from '../../src/pr-review/providers/openai.js';

describe('OpenAI advisory review provider', () => {
  it('uses strict stored-off no-tools Responses output and returns path-bound findings', async () => {
    let requestedBody: Record<string, unknown> | undefined;
    let requestedHeaders: Headers | undefined;
    let requestedUrl: string | undefined;
    const fetchImplementation: typeof fetch = async (input, init) => {
      await Promise.resolve();
      if (typeof input === 'string') requestedUrl = input;
      else if (input instanceof URL) requestedUrl = input.href;
      else requestedUrl = input.url;
      requestedHeaders = new Headers(init?.headers);
      if (typeof init?.body !== 'string') throw new TypeError('Expected a JSON request body');
      requestedBody = JSON.parse(init.body) as Record<string, unknown>;
      return Response.json(
        {
          output: [
            {
              content: [
                {
                  text: JSON.stringify({
                    findings: [
                      {
                        consequential: true,
                        consequence: 'The wildcard grants access beyond administrators.',
                        evidence: 'The changed rule is `allow *`.',
                        line: 1,
                        nextAction: 'Restrict the rule to the intended administrator role.',
                        path: 'policies/access.flux',
                      },
                    ],
                  }),
                  type: 'output_text',
                },
              ],
              type: 'message',
            },
          ],
          usage: { input_tokens: 123, output_tokens: 45 },
        },
        { headers: { 'content-type': 'application/json' }, status: 200 },
      );
    };

    const review = await reviewWithOpenAI({
      apiKey: 'test-key',
      evidence: [{ content: 'allow *', path: 'policies/access.flux' }],
      fetchImplementation,
      model: 'gpt-test',
    });

    expect(requestedUrl).toBe('https://api.openai.com/v1/responses');
    expect(requestedHeaders?.get('authorization')).toBe('Bearer test-key');
    expect(requestedBody).toMatchObject({
      model: 'gpt-test',
      store: false,
      tools: [],
      text: {
        format: {
          name: 'safeword_advisory_review',
          strict: true,
          type: 'json_schema',
        },
      },
    });
    expect(review).toEqual({
      findings: [
        {
          consequential: true,
          consequence: 'The wildcard grants access beyond administrators.',
          evidence: 'The changed rule is `allow *`.',
          line: 1,
          nextAction: 'Restrict the rule to the intended administrator role.',
          path: 'policies/access.flux',
        },
      ],
      tokenUsage: { input: 123, output: 45 },
    });
  });

  it('rejects findings whose path was not supplied as review evidence', async () => {
    const fetchImplementation: typeof fetch = () =>
      Promise.resolve(
        Response.json({
          output: [
            {
              content: [
                {
                  text: JSON.stringify({
                    findings: [
                      {
                        consequential: true,
                        consequence: 'An unrelated file is unsafe.',
                        evidence: 'The model named a path outside the evidence set.',
                        line: 1,
                        nextAction: 'Do not publish this ungrounded finding.',
                        path: 'not-reviewed.ts',
                      },
                    ],
                  }),
                  type: 'output_text',
                },
              ],
              type: 'message',
            },
          ],
        }),
      );

    await expect(
      reviewWithOpenAI({
        apiKey: 'test-key',
        evidence: [{ content: 'allow *', path: 'policies/access.flux' }],
        fetchImplementation,
        model: 'gpt-test',
      }),
    ).rejects.toThrow('invalid path-bound finding');
  });

  it('reports a failed Responses request without parsing its body', async () => {
    const fetchImplementation: typeof fetch = () =>
      Promise.resolve(new Response('unavailable', { status: 503 }));

    await expect(
      reviewWithOpenAI({
        apiKey: 'test-key',
        evidence: [{ content: 'allow *', path: 'policies/access.flux' }],
        fetchImplementation,
        model: 'gpt-test',
      }),
    ).rejects.toThrow('OpenAI reviewer request failed (503)');
  });
});
