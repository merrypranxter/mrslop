import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PetriTrial } from '../types';

const storage = vi.hoisted(() => new Map<string, unknown>());

vi.mock('localforage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: unknown) => {
      storage.set(key, structuredClone(value));
      return value;
    }),
  },
}));

import localforage from 'localforage';
import {
  PETRI_STORAGE_KEY,
  loadPetriTrials,
  savePetriTrials,
} from '../services/petriStore';
import { MR_SLOP_STORAGE_KEY } from '../services/specimenStore';

const trial = (): PetriTrial => ({
  schemaVersion: 1,
  id: 'trial-1',
  challenge: 'Make one strange but useful thing.',
  challengeHash: 'challenge-hash',
  status: 'complete',
  model: 'gemini-test',
  temperature: 0.9,
  maxOutputTokens: 8192,
  experimentInstructionVersion: 'petri-v1',
  entrantOrder: ['snapshot-a', 'snapshot-b'],
  entrants: [
    {
      id: 'snapshot-a',
      specimenId: 'specimen-a',
      specimenName: 'A',
      specimenSchemaVersion: 4,
      stateHash: 'state-a',
      generation: 0,
      lineageKind: 'root',
      driftScore: 0,
      driftBand: 'LOW',
      genome: {
        id: 'genome-a',
        mode: 'stack',
        components: [],
      },
      activeTraits: [],
      activeInfections: [],
      capturedAt: 10,
    },
    {
      id: 'snapshot-b',
      specimenId: 'specimen-b',
      specimenName: 'B',
      specimenSchemaVersion: 4,
      stateHash: 'state-b',
      generation: 1,
      lineageKind: 'bred',
      driftScore: 3,
      driftBand: 'MODERATE',
      genome: {
        id: 'genome-b',
        mode: 'stack',
        components: [],
      },
      activeTraits: [],
      activeInfections: [],
      capturedAt: 10,
    },
  ],
  results: [
    {
      entrantSnapshotId: 'snapshot-a',
      specimenId: 'specimen-a',
      status: 'succeeded',
      attempts: [{
        attempt: 1,
        status: 'succeeded',
        startedAt: 20,
        endedAt: 21,
        outputText: 'alpha',
        finishReason: 'STOP',
        systemInstructionHash: 'system-a',
        challengeHash: 'challenge-hash',
        entrantStateHash: 'state-a',
      }],
      outputText: 'alpha',
      finishReason: 'STOP',
    },
    {
      entrantSnapshotId: 'snapshot-b',
      specimenId: 'specimen-b',
      status: 'failed',
      attempts: [{
        attempt: 1,
        status: 'failed',
        startedAt: 20,
        endedAt: 21,
        errorCode: 'NOPE',
        errorMessage: 'provider unavailable',
        systemInstructionHash: 'system-b',
        challengeHash: 'challenge-hash',
        entrantStateHash: 'state-b',
      }],
      errorCode: 'NOPE',
      errorMessage: 'provider unavailable',
    },
  ],
  selection: {
    selectedEntrantSnapshotIds: ['snapshot-a'],
    note: 'preferred this one',
    identityMode: 'blind',
    selectedAt: 30,
    revisedAt: 31,
  },
  createdAt: 5,
  startedAt: 20,
  completedAt: 31,
  lastModified: 31,
});

describe('Petri trial schema and dedicated persistence', () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it('keeps Petri trials in their own stable storage key', () => {
    expect(PETRI_STORAGE_KEY).toBe('mrslop_petri_trials_v1');
    expect(MR_SLOP_STORAGE_KEY).toBe('mrslop_specimens_v1');
    expect(PETRI_STORAGE_KEY).not.toBe(MR_SLOP_STORAGE_KEY);
    expect(PETRI_STORAGE_KEY).not.toBe('ghost_sessions');
  });

  it('loads an empty collection when no Petri data exists', async () => {
    await expect(loadPetriTrials()).resolves.toEqual([]);
    expect(localforage.getItem).toHaveBeenCalledWith(PETRI_STORAGE_KEY);
  });

  it('round-trips schema-v1 trials including result and selection state', async () => {
    const original = trial();

    await savePetriTrials([original]);
    const loaded = await loadPetriTrials();

    expect(localforage.setItem).toHaveBeenCalledTimes(1);
    expect(localforage.setItem).toHaveBeenCalledWith(
      PETRI_STORAGE_KEY,
      expect.any(Array),
    );
    expect(loaded).toEqual([original]);
    expect(loaded[0]).not.toBe(original);
    expect(loaded[0].entrants).not.toBe(original.entrants);
    expect(loaded[0].results[0].attempts).not.toBe(original.results[0].attempts);
  });

  it('ignores malformed or unsupported records without discarding valid trials', async () => {
    storage.set(PETRI_STORAGE_KEY, [
      trial(),
      { schemaVersion: 99, id: 'future' },
      { schemaVersion: 1, id: 'broken', results: 'nope' },
      null,
    ]);

    const loaded = await loadPetriTrials();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('trial-1');
  });

  it('saving Petri trials writes only the Petri collection key', async () => {
    await savePetriTrials([trial()]);

    const setItem = vi.mocked(localforage.setItem);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem.mock.calls[0][0]).toBe(PETRI_STORAGE_KEY);
    expect(setItem.mock.calls[0][0]).not.toBe(MR_SLOP_STORAGE_KEY);
    expect(setItem.mock.calls[0][0]).not.toBe('ghost_sessions');
  });
});
