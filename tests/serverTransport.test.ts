import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendMrSlopMessage } from '../services/geminiService';
import { compileFuseGenome } from '../services/kernelCompiler';
import { Genome, GenomeComponent, Role } from '../types';

const component: GenomeComponent = {
  id: 'tm-15',
  name: 'Alien Distance Metrics + Enforced Metric Turnover',
  kind: 'mind',
  version: 'test',
  description: 'Test component',
  prompt: 'Use an explicit alien distance metric.',
  tags: ['test'],
  roleHints: ['selection'],
  enabled: true,
  order: 0,
  charWeight: 38,
};

const genome: Genome = {
  id: 'genome-test',
  mode: 'fuse',
  components: [component],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AI Studio server transport', () => {
  it('sends ordinary chat through the same-origin server API instead of requiring a browser API key', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe('/api/mr-slop/chat');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body));
      expect(body.systemInstruction).toBe('SYSTEM');
      expect(body.contents.at(-1).parts.at(-1).text).toBe('hello');
      return new Response(JSON.stringify({ text: '{"text":"hello from server"}' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendMrSlopMessage({
      history: [{ id: 'u1', role: Role.USER, content: 'old', timestamp: 1 }],
      userMessage: 'hello',
      systemInstruction: 'SYSTEM',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('hello from server');
  });

  it('sends FUSE compilation through the server API', async () => {
    const compiled = 'x'.repeat(160);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe('/api/mr-slop/fuse');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body));
      expect(body.source).toContain('tm-15');
      return new Response(JSON.stringify({ text: compiled }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(compileFuseGenome(genome)).resolves.toBe(compiled);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
