import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendPetriGeneration } from '../services/petriGenerationService';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Petri plain generation client', () => {
  it('posts one isolated user challenge with exact system instruction and settings', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(_url).toBe('/api/mr-slop/chat');
      expect(body).toEqual({
        model: 'gemini-test',
        contents: [{
          role: 'user',
          parts: [{ text: 'shared challenge' }],
        }],
        systemInstruction: 'EXACT PETRI SYSTEM',
        temperature: 0.42,
        maxOutputTokens: 1234,
      });

      return new Response(JSON.stringify({
        text: '{"text":"this stays raw"}',
        finishReason: 'STOP',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await sendPetriGeneration({
      challenge: 'shared challenge',
      systemInstruction: 'EXACT PETRI SYSTEM',
      model: 'gemini-test',
      temperature: 0.42,
      maxOutputTokens: 1234,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      text: '{"text":"this stays raw"}',
      finishReason: 'STOP',
    });
  });

  it('does not append ordinary Mr. Slop envelope or chat history', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.contents).toHaveLength(1);
      expect(body.contents[0]).toEqual({
        role: 'user',
        parts: [{ text: 'only this challenge' }],
      });
      expect(body.systemInstruction).toBe('frozen specimen + petri experiment instruction');
      expect(JSON.stringify(body)).not.toContain('RESPONSE FORMAT');
      expect(JSON.stringify(body)).not.toContain('mutationProposal');
      expect(JSON.stringify(body)).not.toContain('forkAction');

      return new Response(JSON.stringify({ text: 'plain phenotype' }), { status: 200 });
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(sendPetriGeneration({
      challenge: 'only this challenge',
      systemInstruction: 'frozen specimen + petri experiment instruction',
      model: 'gemini-test',
      temperature: 0.9,
      maxOutputTokens: 8192,
    })).resolves.toEqual({ text: 'plain phenotype' });
  });

  it('surfaces server error code and message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        code: 'MR_SLOP_SERVER_KEY_MISSING',
        error: 'server key unavailable',
      }), { status: 500, statusText: 'Internal Server Error' }),
    ));

    await expect(sendPetriGeneration({
      challenge: 'x',
      systemInstruction: 'y',
      model: 'gemini-test',
      temperature: 0.9,
      maxOutputTokens: 8192,
    })).rejects.toThrow('MR_SLOP_SERVER_KEY_MISSING:server key unavailable');
  });

  it('passes abort signals through to fetch', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendPetriGeneration({
      challenge: 'x',
      systemInstruction: 'y',
      model: 'gemini-test',
      temperature: 0.9,
      maxOutputTokens: 8192,
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
