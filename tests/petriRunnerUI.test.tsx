import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  specimens: [] as unknown[],
  specimenSave: vi.fn(),
  petriLoad: vi.fn(),
  petriSave: vi.fn(),
  generate: vi.fn(),
}));

vi.mock('../services/specimenStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/specimenStore')>();
  return {
    ...actual,
    loadSpecimens: vi.fn(async () => harness.specimens),
    saveSpecimens: harness.specimenSave,
  };
});

vi.mock('../services/petriStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/petriStore')>();
  return {
    ...actual,
    loadPetriTrials: harness.petriLoad,
    savePetriTrials: harness.petriSave,
  };
});

vi.mock('../services/petriGenerationService', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/petriGenerationService')>();
  return {
    ...actual,
    sendPetriGeneration: harness.generate,
  };
});

import App from '../App';
import PetriDishRunner from '../components/PetriDishRunner';
import { createGenome } from '../lib/genome';
import { createPetriTrial, PETRI_EXPERIMENT_INSTRUCTION_VERSION } from '../lib/petriRunner';
import { createPetriEntrantSnapshot } from '../lib/petriSnapshot';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { makeSpecimen } from '../services/specimenStore';
import type { PetriTrial, Specimen } from '../types';

const spawned = (name: string): Specimen =>
  makeSpecimen(createGenome(['tm-01'], SLOP_LIBRARY, 'stack'), name, 'spawned');

const completedTrial = (): PetriTrial => {
  const a = spawned('ALPHA');
  const b = spawned('BETA');
  const sa = createPetriEntrantSnapshot(a, { now: 1, idFactory: () => 'snap-a' });
  const sb = createPetriEntrantSnapshot(b, { now: 1, idFactory: () => 'snap-b' });
  const trial = createPetriTrial({
    challenge: 'same pressure',
    entrants: [sa, sb],
    config: {
      model: 'gemini-test',
      temperature: 0.9,
      maxOutputTokens: 1000,
      experimentInstructionVersion: PETRI_EXPERIMENT_INSTRUCTION_VERSION,
    },
    now: 2,
    idFactory: () => 'trial-1',
  });

  trial.status = 'partial';
  trial.results[0] = {
    ...trial.results[0],
    status: 'succeeded',
    outputText: 'alpha phenotype',
    attempts: [],
  };
  trial.results[1] = {
    ...trial.results[1],
    status: 'failed',
    errorCode: 'NOPE',
    errorMessage: 'provider failed',
    attempts: [],
  };
  return trial;
};

const openLoadedSpecimen = async (name: string) => {
  await screen.findByRole('button', { name: /build me/i });
  fireEvent.click(screen.getByRole('button', { name: /build me/i }));
  fireEvent.click(screen.getByRole('button', { name: /start from a specimen/i }));
  fireEvent.click((await screen.findByText(name)).closest('button')!);
};

describe('Petri running and results UI', () => {
  beforeEach(() => {
    harness.specimenSave.mockReset();
    harness.petriLoad.mockReset();
    harness.petriSave.mockReset();
    harness.generate.mockReset();
    harness.petriLoad.mockResolvedValue([]);
    harness.petriSave.mockResolvedValue(undefined);
    harness.specimenSave.mockResolvedValue(undefined);
    harness.specimens = [];
  });

  it('shows phenotype output, failures, stable blind labels, and explicit retry controls', () => {
    const trial = completedTrial();
    const onRetry = vi.fn();
    const onToggleBlind = vi.fn();
    const onSelectionChange = vi.fn();

    render(
      <PetriDishRunner
        trial={trial}
        blind
        busy={false}
        onToggleBlind={onToggleBlind}
        onRetry={onRetry}
        onAbort={vi.fn()}
        onSelectionChange={onSelectionChange}
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: /petri dish results/i });
    expect(dialog).toHaveTextContent('alpha phenotype');
    expect(dialog).toHaveTextContent('provider failed');
    expect(dialog).not.toHaveTextContent('ALPHA');
    expect(dialog).not.toHaveTextContent('BETA');
    expect(within(dialog).getByText('A')).toBeInTheDocument();
    expect(within(dialog).getByText('B')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /reveal identities/i }));
    expect(onToggleBlind).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole('button', { name: /retry b/i }));
    expect(onRetry).toHaveBeenCalledWith('snap-b');

    fireEvent.click(within(dialog).getByLabelText(/select a/i));
    expect(onSelectionChange).toHaveBeenCalledWith(['snap-a']);
  });

  it('shows ABORT only while a trial is actively running', () => {
    const trial = completedTrial();
    trial.status = 'running';
    const onAbort = vi.fn();

    render(
      <PetriDishRunner
        trial={trial}
        blind={false}
        busy
        onToggleBlind={vi.fn()}
        onRetry={vi.fn()}
        onAbort={onAbort}
        onSelectionChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /abort petri dish/i }));
    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it('runs a Petri Dish from the app with one call per entrant and no specimen persistence write', async () => {
    const a = spawned('PARENT ALPHA');
    const b = spawned('PARENT BETA');
    harness.specimens = [a, b];
    harness.generate.mockImplementation(async ({ systemInstruction }: any) => ({
      text: systemInstruction.includes('Specimen: PARENT ALPHA')
        ? 'alpha result'
        : 'beta result',
      finishReason: 'STOP',
    }));

    render(<App />);
    await openLoadedSpecimen('PARENT ALPHA');

    fireEvent.click(screen.getByRole('button', { name: /petri dish/i }));
    const setup = await screen.findByRole('dialog', { name: /^petri dish$/i });
    fireEvent.change(within(setup).getByLabelText(/shared challenge/i), {
      target: { value: 'same exact pressure' },
    });
    fireEvent.click(within(setup).getByRole('button', { name: /run petri dish/i }));

    const results = await screen.findByRole('dialog', { name: /petri dish results/i });
    await waitFor(() => expect(results).toHaveTextContent('alpha result'));
    expect(results).toHaveTextContent('beta result');

    expect(harness.generate).toHaveBeenCalledTimes(2);
    expect(harness.generate.mock.calls.every(call => call[0].challenge === 'same exact pressure'))
      .toBe(true);
    expect(harness.specimenSave).not.toHaveBeenCalled();
    expect(harness.petriSave).toHaveBeenCalled();
  });
});
