import { describe, expect, it } from 'vitest';
import { parseMrSlopEnvelope } from '../services/geminiService';

describe('parseMrSlopEnvelope', () => {
  it('parses a minimal JSON envelope', () => {
    expect(parseMrSlopEnvelope('{"text":"hi"}')).toEqual({ text: 'hi' });
  });

  it('falls back to plain text when the model does not return JSON', () => {
    expect(parseMrSlopEnvelope('not json')).toEqual({ text: 'not json' });
  });

  it('strips markdown JSON fences before parsing', () => {
    expect(parseMrSlopEnvelope('```json\n{"text":"hello"}\n```')).toEqual({ text: 'hello' });
  });

  it('discards malformed UI events instead of crashing chat', () => {
    expect(() => parseMrSlopEnvelope('{"text":"","uiEvent":{"type":"structural-decision"}}')).not.toThrow();
    expect(parseMrSlopEnvelope('{"text":"ok","uiEvent":{"type":"structural-decision"}}')).toEqual({ text: 'ok' });
  });

  it('keeps valid choice-card events', () => {
    const parsed = parseMrSlopEnvelope(JSON.stringify({
      text: 'Pick one.',
      uiEvent: {
        type: 'choice-card',
        id: 'choice-1',
        title: 'Three doors',
        options: [{ id: 'a', label: 'A', description: 'first' }],
      },
    }));
    expect(parsed.uiEvent?.type).toBe('choice-card');
  });

  it('keeps a valid proposed genome and rejects invalid component IDs', () => {
    expect(parseMrSlopEnvelope(JSON.stringify({
      text: 'I have a build.',
      proposedGenome: { componentIds: ['tm-01', 'tm-15'], mode: 'stack' },
    })).proposedGenome?.componentIds).toEqual(['tm-01', 'tm-15']);

    expect(parseMrSlopEnvelope(JSON.stringify({
      text: 'bad',
      proposedGenome: { componentIds: ['tm-01', 3], mode: 'stack' },
    })).proposedGenome).toBeUndefined();
  });
});
