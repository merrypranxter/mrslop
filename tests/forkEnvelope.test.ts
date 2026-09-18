import { afterEach, describe, expect, it, vi } from 'vitest';
import { MR_SLOP_BASE_SHELL } from '../prompts/mrSlopBase';
import { parseMrSlopEnvelope, sendMrSlopMessage } from '../services/geminiService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fork response envelope', () => {
  it('parses a valid in-app specimen fork request', () => {
    const result = parseMrSlopEnvelope(JSON.stringify({
      text: 'I can split this timeline.',
      forkAction: {
        type: 'fork-specimen',
        suggestedName: 'METRIC CHILD',
        reason: 'Preserve this state and let another branch diverge.',
      },
    }));

    expect(result.forkAction).toEqual({
      type: 'fork-specimen',
      suggestedName: 'METRIC CHILD',
      reason: 'Preserve this state and let another branch diverge.',
    });
  });

  it('allows a fork request without a suggested name', () => {
    const result = parseMrSlopEnvelope(JSON.stringify({
      text: 'Split here.',
      forkAction: {
        type: 'fork-specimen',
        reason: 'The current state is a useful branching point.',
      },
    }));

    expect(result.forkAction).toEqual({
      type: 'fork-specimen',
      reason: 'The current state is a useful branching point.',
    });
  });

  it('drops malformed fork metadata while preserving conversational text', () => {
    expect(parseMrSlopEnvelope(JSON.stringify({
      text: 'still talking',
      forkAction: {
        type: 'fork-specimen',
        reason: 7,
      },
    }))).toEqual({ text: 'still talking' });

    expect(parseMrSlopEnvelope(JSON.stringify({
      text: 'still talking too',
      forkAction: {
        type: 'github-fork',
        reason: 'wrong kind of fork',
      },
    }))).toEqual({ text: 'still talking too' });
  });

  it('trims and bounds a model-suggested child name', () => {
    const result = parseMrSlopEnvelope(JSON.stringify({
      text: 'Here.',
      forkAction: {
        type: 'fork-specimen',
        suggestedName: `   ${'X'.repeat(100)}   `,
        reason: 'Diverge.',
      },
    }));

    expect(result.forkAction?.suggestedName).toHaveLength(80);
    expect(result.forkAction?.suggestedName).toBe('X'.repeat(80));
  });

  it('includes fork semantics in the same ordinary Gemini call', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.systemInstruction).toContain('forkAction');
      expect(body.systemInstruction).toContain('fork-specimen');
      expect(body.systemInstruction).toContain('parent remains unchanged');
      expect(body.systemInstruction).toContain('fresh conversation');
      expect(body.systemInstruction).toContain('not a GitHub fork');
      return new Response(JSON.stringify({ text: '{"text":"ok"}' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendMrSlopMessage({
      history: [],
      userMessage: 'fork this thing',
      systemInstruction: 'SYSTEM',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('Mr. Slop fork conversation rules', () => {
  it('understands natural specimen-fork language without confusing it with repository forks', () => {
    expect(MR_SLOP_BASE_SHELL).toContain('fork this thing');
    expect(MR_SLOP_BASE_SHELL).toContain('split this specimen');
    expect(MR_SLOP_BASE_SHELL).toContain('make a copy and let it evolve separately');
    expect(MR_SLOP_BASE_SHELL).toContain('not a GitHub fork');
    expect(MR_SLOP_BASE_SHELL).toContain('parent');
    expect(MR_SLOP_BASE_SHELL).toContain('fresh conversation');
  });
});
