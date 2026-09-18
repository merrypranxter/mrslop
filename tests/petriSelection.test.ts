import { describe, expect, it } from 'vitest';
import type { PetriEntrantSnapshot } from '../types';
import {
  PETRI_EXPERIMENT_INSTRUCTION_VERSION,
  createPetriTrial,
} from '../lib/petriRunner';
import {
  applyPetriSelection,
  petriBlindLabel,
  petriEntrantDisplayLabel,
} from '../lib/petriSelection';

const snapshot = (id: string, name: string): PetriEntrantSnapshot => ({
  id: `snap-${id}`,
  specimenId: `spec-${id}`,
  specimenName: name,
  specimenSchemaVersion: 4,
  stateHash: `hash-${id}`,
  generation: 0,
  lineageKind: 'root',
  driftScore: 0,
  driftBand: 'LOW',
  genome: { id: `g-${id}`, mode: 'stack', components: [] },
  activeTraits: [],
  activeInfections: [],
  capturedAt: 1,
});

const makeTrial = () => createPetriTrial({
  challenge: 'same challenge',
  entrants: [
    snapshot('a', 'ALPHA'),
    snapshot('b', 'BETA'),
    snapshot('c', 'GAMMA'),
    snapshot('d', 'DELTA'),
  ],
  config: {
    model: 'gemini-test',
    temperature: 0.9,
    maxOutputTokens: 1000,
    experimentInstructionVersion: PETRI_EXPERIMENT_INSTRUCTION_VERSION,
  },
  now: 10,
  idFactory: () => 'trial',
});

describe('Petri human selection and blind labels', () => {
  it('allows zero, one, or multiple selected entrants without a score', () => {
    const trial = makeTrial();

    const none = applyPetriSelection(trial, [], {
      identityMode: 'revealed',
      now: 20,
    });
    expect(none.selection?.selectedEntrantSnapshotIds).toEqual([]);

    const one = applyPetriSelection(trial, ['snap-b'], {
      identityMode: 'blind',
      now: 21,
    });
    expect(one.selection?.selectedEntrantSnapshotIds).toEqual(['snap-b']);
    expect(one.selection?.identityMode).toBe('blind');

    const many = applyPetriSelection(trial, ['snap-a', 'snap-c', 'snap-d'], {
      identityMode: 'revealed',
      note: 'these did the interesting thing',
      now: 22,
    });
    expect(many.selection?.selectedEntrantSnapshotIds)
      .toEqual(['snap-a', 'snap-c', 'snap-d']);
    expect(many.selection?.note).toBe('these did the interesting thing');
    expect(many.selection).not.toHaveProperty('fitness');
    expect(many.selection).not.toHaveProperty('score');
  });

  it('deduplicates selection and stores it in stable entrant order', () => {
    const trial = makeTrial();

    const selected = applyPetriSelection(
      trial,
      ['snap-d', 'snap-b', 'snap-d', 'snap-a'],
      { identityMode: 'blind', now: 20 },
    );

    expect(selected.selection?.selectedEntrantSnapshotIds)
      .toEqual(['snap-a', 'snap-b', 'snap-d']);
  });

  it('rejects IDs that are not entrants in the trial', () => {
    expect(() => applyPetriSelection(
      makeTrial(),
      ['snap-not-real'],
      { identityMode: 'revealed', now: 20 },
    )).toThrow('PETRI_SELECTION_UNKNOWN_ENTRANT');
  });

  it('revises selection explicitly while preserving the original selectedAt', () => {
    const first = applyPetriSelection(makeTrial(), ['snap-a'], {
      identityMode: 'blind',
      now: 20,
    });
    const revised = applyPetriSelection(first, ['snap-c'], {
      identityMode: 'revealed',
      note: 'changed my mind after reveal',
      now: 30,
    });

    expect(revised.selection).toMatchObject({
      selectedEntrantSnapshotIds: ['snap-c'],
      identityMode: 'revealed',
      selectedAt: 20,
      revisedAt: 30,
      note: 'changed my mind after reveal',
    });
    expect(first.selection?.selectedEntrantSnapshotIds).toEqual(['snap-a']);
  });

  it('assigns stable blind labels from entrant order', () => {
    const trial = makeTrial();

    expect(petriBlindLabel(trial, 'snap-a')).toBe('A');
    expect(petriBlindLabel(trial, 'snap-b')).toBe('B');
    expect(petriBlindLabel(trial, 'snap-c')).toBe('C');
    expect(petriBlindLabel(trial, 'snap-d')).toBe('D');

    expect(petriEntrantDisplayLabel(trial, 'snap-b', true)).toBe('B');
    expect(petriEntrantDisplayLabel(trial, 'snap-b', false)).toBe('BETA');
  });

  it('does not mutate trial outputs or entrant snapshots when selection changes', () => {
    const trial = makeTrial();
    trial.results[0].status = 'succeeded';
    trial.results[0].outputText = 'alpha output';
    const before = structuredClone(trial);

    const selected = applyPetriSelection(trial, ['snap-a'], {
      identityMode: 'blind',
      now: 20,
    });

    expect(trial).toEqual(before);
    expect(selected.entrants).toEqual(before.entrants);
    expect(selected.results).toEqual(before.results);
  });
});
