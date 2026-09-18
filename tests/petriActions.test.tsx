import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import PetriDishRunner from '../components/PetriDishRunner';
import {
  resolvePetriSelectedLiveSpecimens,
  resolvePetriBreedingPair,
} from '../lib/petriActions';
import { createGenome } from '../lib/genome';
import { createPetriTrial, PETRI_EXPERIMENT_INSTRUCTION_VERSION } from '../lib/petriRunner';
import { createPetriEntrantSnapshot } from '../lib/petriSnapshot';
import { applyPetriSelection } from '../lib/petriSelection';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { makeSpecimen } from '../services/specimenStore';
import type { PetriTrial, Specimen } from '../types';

const spawned = (name: string, ids: string[] = ['tm-01']): Specimen =>
  makeSpecimen(createGenome(ids, SLOP_LIBRARY, 'stack'), name, 'spawned');

const trialFor = (specimens: Specimen[]): PetriTrial => {
  const trial = createPetriTrial({
    challenge: 'same pressure',
    entrants: specimens.map((item, index) =>
      createPetriEntrantSnapshot(item, {
        now: 1,
        idFactory: () => `snap-${index}`,
      })),
    config: {
      model: 'gemini-test',
      temperature: 0.9,
      maxOutputTokens: 1000,
      experimentInstructionVersion: PETRI_EXPERIMENT_INSTRUCTION_VERSION,
    },
    now: 2,
    idFactory: () => 'trial',
  });

  trial.status = 'complete';
  trial.results = trial.results.map((result, index) => ({
    ...result,
    status: 'succeeded',
    outputText: `output ${index}`,
    attempts: [],
  }));
  return trial;
};

const runner = (
  trial: PetriTrial,
  overrides: Partial<React.ComponentProps<typeof PetriDishRunner>> = {},
) => {
  const props: React.ComponentProps<typeof PetriDishRunner> = {
    trial,
    blind: true,
    busy: false,
    readOnly: false,
    onToggleBlind: vi.fn(),
    onRetry: vi.fn(),
    onAbort: vi.fn(),
    onSelectionChange: vi.fn(),
    onOpenEntrant: vi.fn(),
    onForkEntrant: vi.fn(),
    onBreedSelected: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<PetriDishRunner {...props} />);
  return props;
};

describe('Petri post-trial specimen actions', () => {
  it('resolves selected snapshot IDs to current live specimens, not frozen snapshot state', () => {
    const originalA = spawned('ALPHA', ['tm-01']);
    const originalB = spawned('BETA', ['tm-02']);
    let trial = trialFor([originalA, originalB]);
    trial = applyPetriSelection(trial, ['snap-0', 'snap-1'], {
      identityMode: 'blind',
      now: 10,
    });

    const currentA = structuredClone(originalA);
    currentA.currentGenome = createGenome(['tm-01', 'tm-03', 'tm-04'], SLOP_LIBRARY, 'stack');
    currentA.lastModified += 1000;

    const resolved = resolvePetriSelectedLiveSpecimens(trial, [currentA, originalB]);

    expect(resolved.map(item => item.id)).toEqual([originalA.id, originalB.id]);
    expect(resolved[0].currentGenome.components).toHaveLength(3);
    expect(resolved[0].currentGenome).toEqual(currentA.currentGenome);
    expect(resolved[0].currentGenome).not.toEqual(trial.entrants[0].genome);
  });

  it('requires exactly two selected live specimens for Petri breeding', () => {
    const a = spawned('ALPHA');
    const b = spawned('BETA');
    const c = spawned('GAMMA');
    const base = trialFor([a, b, c]);

    const two = applyPetriSelection(base, ['snap-0', 'snap-1'], {
      identityMode: 'blind',
      now: 10,
    });
    expect(resolvePetriBreedingPair(two, [a, b, c]).map(item => item.id))
      .toEqual([a.id, b.id]);

    const one = applyPetriSelection(base, ['snap-0'], {
      identityMode: 'blind',
      now: 11,
    });
    expect(() => resolvePetriBreedingPair(one, [a, b, c]))
      .toThrow('PETRI_BREED_REQUIRES_TWO');

    const three = applyPetriSelection(base, ['snap-0', 'snap-1', 'snap-2'], {
      identityMode: 'blind',
      now: 12,
    });
    expect(() => resolvePetriBreedingPair(three, [a, b, c]))
      .toThrow('PETRI_BREED_REQUIRES_TWO');
  });

  it('offers OPEN and FORK for selected successful entrants and BREED only for exactly two', () => {
    const a = spawned('ALPHA');
    const b = spawned('BETA');
    const c = spawned('GAMMA');
    let trial = trialFor([a, b, c]);
    trial = applyPetriSelection(trial, ['snap-0', 'snap-1'], {
      identityMode: 'blind',
      now: 10,
    });

    const onOpenEntrant = vi.fn();
    const onForkEntrant = vi.fn();
    const onBreedSelected = vi.fn();
    runner(trial, { onOpenEntrant, onForkEntrant, onBreedSelected });

    const dialog = screen.getByRole('dialog', { name: /petri dish results/i });
    const openButtons = within(dialog).getAllByRole('button', { name: /open selected/i });
    const forkButtons = within(dialog).getAllByRole('button', { name: /fork selected/i });
    expect(openButtons).toHaveLength(2);
    expect(forkButtons).toHaveLength(2);

    fireEvent.click(openButtons[0]);
    expect(onOpenEntrant).toHaveBeenCalledWith('snap-0');

    fireEvent.click(forkButtons[1]);
    expect(onForkEntrant).toHaveBeenCalledWith('snap-1');

    fireEvent.click(within(dialog).getByRole('button', { name: /breed selected/i }));
    expect(onBreedSelected).toHaveBeenCalledWith(['snap-0', 'snap-1']);
  });

  it('never exposes automatic multi-parent breeding when more than two are selected', () => {
    const a = spawned('ALPHA');
    const b = spawned('BETA');
    const c = spawned('GAMMA');
    let trial = trialFor([a, b, c]);
    trial = applyPetriSelection(trial, ['snap-0', 'snap-1', 'snap-2'], {
      identityMode: 'revealed',
      now: 10,
    });

    runner(trial);

    expect(screen.queryByRole('button', { name: /breed selected/i }))
      .not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /open selected/i })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /fork selected/i })).toHaveLength(3);
  });

  it('does not offer post-trial specimen actions for unselected outputs', () => {
    const a = spawned('ALPHA');
    const b = spawned('BETA');
    const trial = trialFor([a, b]);

    runner(trial);

    expect(screen.queryByRole('button', { name: /open selected/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fork selected/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /breed selected/i })).not.toBeInTheDocument();
  });
});
