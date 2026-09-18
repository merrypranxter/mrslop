import { afterEach, describe, expect, it, vi } from 'vitest';
import { MR_SLOP_BASE_SHELL } from '../prompts/mrSlopBase';
import { parseMrSlopEnvelope, sendMrSlopMessage } from '../services/geminiService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mutation response envelope', () => {
  it('parses a bounded temporary infection proposal', () => {
    const result = parseMrSlopEnvelope(JSON.stringify({
      text: 'I have a small infection for you.',
      mutationProposal: {
        id: 'mut-1',
        kind: 'infection',
        name: 'Metric Vertigo',
        description: 'Change distance rules temporarily.',
        prompt: 'Treat musical distance as non-Euclidean.',
        reason: 'Your current genome keeps converging too quickly.',
        recommendedTurns: 5,
        sourceMessageIds: ['m1'],
        sourceArtifactIds: [],
        sourceType: 'mr-slop',
      },
    }));

    expect(result.mutationProposal).toMatchObject({
      id: 'mut-1',
      kind: 'infection',
      recommendedTurns: 5,
      sourceType: 'mr-slop',
    });
  });

  it('parses a fossilization proposal with source evidence', () => {
    const result = parseMrSlopEnvelope(JSON.stringify({
      text: 'That accidental behavior is worth preserving.',
      mutationProposal: {
        id: 'mut-fossil',
        kind: 'fossilized-accident',
        name: 'Navigation Harmony',
        description: 'Translate harmony problems into navigation problems.',
        prompt: 'When harmony stalls, remap it as navigation through a strange space.',
        reason: 'It appeared repeatedly across recent outputs.',
        sourceMessageIds: ['m7', 'm8'],
        sourceArtifactIds: ['a2'],
        sourceType: 'conversation',
      },
    }));

    expect(result.mutationProposal).toMatchObject({
      kind: 'fossilized-accident',
      sourceMessageIds: ['m7', 'm8'],
      sourceArtifactIds: ['a2'],
    });
  });

  it('parses bounded remove and restore mutation actions', () => {
    const remove = parseMrSlopEnvelope(JSON.stringify({
      text: 'I can kill the infection.',
      mutationAction: {
        type: 'remove-infection',
        targetId: 'infection-1',
      },
    }));
    expect(remove.mutationAction).toEqual({
      type: 'remove-infection',
      targetId: 'infection-1',
    });

    const restore = parseMrSlopEnvelope(JSON.stringify({
      text: 'I can roll back to the checkpoint.',
      mutationAction: {
        type: 'restore-checkpoint',
        targetId: 'checkpoint-1',
      },
    }));
    expect(restore.mutationAction).toEqual({
      type: 'restore-checkpoint',
      targetId: 'checkpoint-1',
    });
  });

  it('parses a start-infection action only with a valid proposal and duration', () => {
    const result = parseMrSlopEnvelope(JSON.stringify({
      text: 'Try it for five.',
      mutationAction: {
        type: 'start-infection',
        durationMode: 'turns',
        durationTurns: 5,
        proposal: {
          id: 'mut-2',
          kind: 'infection',
          name: 'Rhythmic Gravity',
          description: 'Let rhythmic density behave like gravity.',
          prompt: 'Treat denser rhythmic zones as stronger attractors.',
          reason: 'Useful short experiment.',
          recommendedTurns: 5,
          sourceMessageIds: ['m2'],
          sourceArtifactIds: [],
          sourceType: 'mutation-proposal',
        },
      },
    }));

    expect(result.mutationAction).toMatchObject({
      type: 'start-infection',
      durationMode: 'turns',
      durationTurns: 5,
      proposal: { kind: 'infection', name: 'Rhythmic Gravity' },
    });
  });

  it('drops malformed mutation payloads while preserving conversational text', () => {
    const malformedProposal = parseMrSlopEnvelope(JSON.stringify({
      text: 'still useful',
      mutationProposal: {
        id: 'bad',
        kind: 'infection',
        name: 'Bad',
        description: 'Bad',
        prompt: 'Bad',
        reason: 'Bad',
        recommendedTurns: 0,
        sourceMessageIds: ['ok', 7],
        sourceArtifactIds: [],
        sourceType: 'mr-slop',
      },
    }));

    expect(malformedProposal).toEqual({ text: 'still useful' });

    const malformedAction = parseMrSlopEnvelope(JSON.stringify({
      text: 'still useful too',
      mutationAction: {
        type: 'restore-checkpoint',
        targetId: 99,
      },
    }));

    expect(malformedAction).toEqual({ text: 'still useful too' });
  });

  it('includes the mutation contract in ordinary Gemini calls', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.systemInstruction).toContain('mutationProposal');
      expect(body.systemInstruction).toContain('mutationAction');
      expect(body.systemInstruction).toContain('start-infection');
      expect(body.systemInstruction).toContain('restore-checkpoint');
      return new Response(JSON.stringify({ text: '{"text":"ok"}' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendMrSlopMessage({
      history: [],
      userMessage: 'fuck with yourself',
      systemInstruction: 'SYSTEM',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('Mr. Slop mutation conversation rules', () => {
  it('treats mutation requests as proposals and keeps permanent changes behind approval', () => {
    expect(MR_SLOP_BASE_SHELL).toContain('fuck with yourself');
    expect(MR_SLOP_BASE_SHELL).toContain('try that temporarily');
    expect(MR_SLOP_BASE_SHELL).toContain('keep that shit');
    expect(MR_SLOP_BASE_SHELL).toContain('undo that shit');
    expect(MR_SLOP_BASE_SHELL).toContain('do not claim');
    expect(MR_SLOP_BASE_SHELL).toContain('approval');
  });
});
