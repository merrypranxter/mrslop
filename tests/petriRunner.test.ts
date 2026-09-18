import { describe, expect, it, vi } from 'vitest';
import type { PetriEntrantSnapshot } from '../types';
import {
  PETRI_EXPERIMENT_INSTRUCTION_VERSION,
  createPetriTrial,
  retryPetriEntrant,
  runPetriTrial,
} from '../lib/petriRunner';

const snapshot = (id: string): PetriEntrantSnapshot => ({
  id: `snapshot-${id}`,
  specimenId: `specimen-${id}`,
  specimenName: id.toUpperCase(),
  specimenSchemaVersion: 4,
  stateHash: `state-${id}`,
  generation: 0,
  lineageKind: 'root',
  driftScore: 0,
  driftBand: 'LOW',
  genome: {
    id: `genome-${id}`,
    mode: 'stack',
    components: [],
  },
  activeTraits: [],
  activeInfections: [],
  capturedAt: 1,
});

const config = {
  model: 'gemini-test',
  temperature: 0.9,
  maxOutputTokens: 2048,
  experimentInstructionVersion: PETRI_EXPERIMENT_INSTRUCTION_VERSION,
};

describe('Petri trial runner', () => {
  it('requires 2–8 distinct spawned entrant snapshots', () => {
    expect(() => createPetriTrial({
      challenge: 'x',
      entrants: [snapshot('a')],
      config,
      now: 10,
      idFactory: () => 'trial-1',
    })).toThrow('PETRI_ENTRANT_COUNT');

    expect(() => createPetriTrial({
      challenge: 'x',
      entrants: Array.from({ length: 9 }, (_, i) => snapshot(String(i))),
      config,
      now: 10,
      idFactory: () => 'trial-1',
    })).toThrow('PETRI_ENTRANT_COUNT');

    const duplicate = snapshot('a');
    expect(() => createPetriTrial({
      challenge: 'x',
      entrants: [duplicate, structuredClone(duplicate)],
      config,
      now: 10,
      idFactory: () => 'trial-1',
    })).toThrow('PETRI_DUPLICATE_ENTRANT');
  });

  it('runs exactly one isolated generation attempt per entrant with shared challenge/settings', async () => {
    const entrants = [snapshot('a'), snapshot('b'), snapshot('c')];
    const trial = createPetriTrial({
      challenge: 'same pressure',
      entrants,
      config,
      now: 10,
      idFactory: () => 'trial-1',
    });
    const before = structuredClone(trial);

    const generate = vi.fn(async (request: any) => ({
      text: `output:${request.systemInstruction.includes('PETRI DISH') ? 'petri' : 'bad'}`,
      finishReason: 'STOP',
    }));

    const result = await runPetriTrial(trial, {
      generate,
      now: (() => {
        let n = 100;
        return () => n++;
      })(),
    });

    expect(generate).toHaveBeenCalledTimes(3);
    for (const call of generate.mock.calls) {
      expect(call[0]).toMatchObject({
        challenge: 'same pressure',
        model: 'gemini-test',
        temperature: 0.9,
        maxOutputTokens: 2048,
      });
      expect(call[0].systemInstruction).toContain('PETRI DISH');
    }

    expect(result.status).toBe('complete');
    expect(result.results.map(item => item.entrantSnapshotId))
      .toEqual(entrants.map(item => item.id));
    expect(result.results.every(item => item.status === 'succeeded')).toBe(true);
    expect(result.results.every(item => item.attempts.length === 1)).toBe(true);
    expect(trial).toEqual(before);
  });

  it('never exceeds three in-flight entrant calls and preserves selected order', async () => {
    const entrants = ['a', 'b', 'c', 'd', 'e', 'f'].map(snapshot);
    const trial = createPetriTrial({
      challenge: 'pressure',
      entrants,
      config,
      now: 10,
      idFactory: () => 'trial-1',
    });

    let active = 0;
    let maxActive = 0;
    const generate = vi.fn(async ({ systemInstruction }: any) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
      return { text: systemInstruction.slice(0, 20) };
    });

    const result = await runPetriTrial(trial, { generate });

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(result.results.map(item => item.entrantSnapshotId))
      .toEqual(entrants.map(item => item.id));
  });

  it('records failures as partial results without hidden app-layer retry', async () => {
    const entrants = [snapshot('a'), snapshot('b'), snapshot('c')];
    const trial = createPetriTrial({
      challenge: 'pressure',
      entrants,
      config,
      now: 10,
      idFactory: () => 'trial-1',
    });

    const generate = vi.fn(async ({ systemInstruction }: any) => {
      if (systemInstruction.includes('B')) {
        throw new Error('PROVIDER_DOWN:nope');
      }
      return { text: 'ok' };
    });

    const result = await runPetriTrial(trial, { generate });

    expect(generate).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('partial');
    const failed = result.results.find(item => item.specimenId === 'specimen-b');
    expect(failed).toMatchObject({
      status: 'failed',
      errorCode: 'PROVIDER_DOWN',
      errorMessage: 'nope',
    });
    expect(failed?.attempts).toHaveLength(1);
  });

  it('explicit retry reruns only the failed entrant and creates attempt 2', async () => {
    const entrants = [snapshot('a'), snapshot('b')];
    const trial = createPetriTrial({
      challenge: 'pressure',
      entrants,
      config,
      now: 10,
      idFactory: () => 'trial-1',
    });

    const firstGenerate = vi.fn(async ({ systemInstruction }: any) => {
      if (systemInstruction.includes('B')) throw new Error('TEMP_FAIL:first');
      return { text: 'a-ok' };
    });
    const first = await runPetriTrial(trial, { generate: firstGenerate });

    const retryGenerate = vi.fn(async () => ({ text: 'b-ok', finishReason: 'STOP' }));
    const retried = await retryPetriEntrant(first, 'snapshot-b', {
      generate: retryGenerate,
      now: (() => {
        let n = 500;
        return () => n++;
      })(),
    });

    expect(retryGenerate).toHaveBeenCalledTimes(1);
    expect(retried.status).toBe('complete');
    expect(retried.results.find(item => item.entrantSnapshotId === 'snapshot-a')?.attempts)
      .toHaveLength(1);
    const b = retried.results.find(item => item.entrantSnapshotId === 'snapshot-b');
    expect(b?.status).toBe('succeeded');
    expect(b?.attempts.map(item => item.attempt)).toEqual([1, 2]);
    expect(b?.outputText).toBe('b-ok');
  });

  it('pre-aborted runs mark unfinished entrants aborted without generation calls', async () => {
    const trial = createPetriTrial({
      challenge: 'pressure',
      entrants: [snapshot('a'), snapshot('b')],
      config,
      now: 10,
      idFactory: () => 'trial-1',
    });
    const controller = new AbortController();
    controller.abort();
    const generate = vi.fn();

    const result = await runPetriTrial(trial, {
      generate,
      signal: controller.signal,
    });

    expect(generate).not.toHaveBeenCalled();
    expect(result.status).toBe('partial');
    expect(result.results.every(item => item.status === 'aborted')).toBe(true);
  });
});
