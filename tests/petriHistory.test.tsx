import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  specimens: [] as unknown[],
  trials: [] as unknown[],
  petriSave: vi.fn(),
  generate: vi.fn(),
}));

vi.mock('../services/specimenStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/specimenStore')>();
  return {
    ...actual,
    loadSpecimens: vi.fn(async () => harness.specimens),
    saveSpecimens: vi.fn(async () => undefined),
  };
});

vi.mock('../services/petriStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/petriStore')>();
  return {
    ...actual,
    loadPetriTrials: vi.fn(async () => harness.trials),
    savePetriTrials: harness.petriSave,
  };
});

vi.mock('../services/petriGenerationService', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/petriGenerationService')>();
  return { ...actual, sendPetriGeneration: harness.generate };
});

import App from '../App';
import { createGenome } from '../lib/genome';
import { createPetriTrial, PETRI_EXPERIMENT_INSTRUCTION_VERSION } from '../lib/petriRunner';
import { createPetriEntrantSnapshot } from '../lib/petriSnapshot';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { makeSpecimen } from '../services/specimenStore';
import type { PetriTrial, Specimen } from '../types';

const spawned = (name: string): Specimen =>
  makeSpecimen(createGenome(['tm-01'], SLOP_LIBRARY, 'stack'), name, 'spawned');

const historicTrial = (a: Specimen, b: Specimen): PetriTrial => {
  const trial = createPetriTrial({
    challenge: 'historic pressure',
    entrants: [
      createPetriEntrantSnapshot(a, { now: 1, idFactory: () => 'snap-a' }),
      createPetriEntrantSnapshot(b, { now: 1, idFactory: () => 'snap-b' }),
    ],
    config: {
      model: 'gemini-test',
      temperature: 0.9,
      maxOutputTokens: 1000,
      experimentInstructionVersion: PETRI_EXPERIMENT_INSTRUCTION_VERSION,
    },
    now: 2,
    idFactory: () => 'historic-trial',
  });
  trial.status = 'complete';
  trial.completedAt = 3;
  trial.lastModified = 3;
  trial.results = trial.results.map((result, index) => ({
    ...result,
    status: 'succeeded',
    outputText: index === 0 ? 'saved alpha output' : 'saved beta output',
    attempts: [],
  }));
  return trial;
};

const openLoadedSpecimen = async (name: string) => {
  await screen.findByRole('button', { name: /build me/i });
  fireEvent.click(screen.getByRole('button', { name: /build me/i }));
  fireEvent.click(screen.getByRole('button', { name: /start from a specimen/i }));
  fireEvent.click((await screen.findByText(name)).closest('button')!);
};

describe('Petri history and reload', () => {
  beforeEach(() => {
    harness.petriSave.mockReset();
    harness.generate.mockReset();
    harness.petriSave.mockResolvedValue(undefined);
  });

  it('reopens a saved trial without regenerating outputs and allows selection revision', async () => {
    const a = spawned('ALPHA');
    const b = spawned('BETA');
    harness.specimens = [a, b];
    harness.trials = [historicTrial(a, b)];

    render(<App />);
    await openLoadedSpecimen('ALPHA');

    fireEvent.click(screen.getByRole('button', { name: /petri dish/i }));
    const setup = await screen.findByRole('dialog', { name: /^petri dish$/i });
    fireEvent.click(within(setup).getByRole('button', { name: /trial history/i }));

    const history = await screen.findByRole('dialog', { name: /petri history/i });
    expect(history).toHaveTextContent('historic pressure');
    expect(history).toHaveTextContent(/2 entrants/i);
    expect(history).toHaveTextContent(/complete/i);

    fireEvent.click(within(history).getByRole('button', { name: /open petri trial/i }));

    const results = await screen.findByRole('dialog', { name: /petri dish results/i });
    expect(results).toHaveTextContent('saved alpha output');
    expect(results).toHaveTextContent('saved beta output');
    expect(harness.generate).not.toHaveBeenCalled();

    fireEvent.click(within(results).getByLabelText(/select a/i));
    await waitFor(() => expect(harness.petriSave).toHaveBeenCalled());
    expect(harness.generate).not.toHaveBeenCalled();
  });
});
