import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  send: vi.fn(),
  loaded: [] as unknown[],
  save: vi.fn(),
}));

vi.mock('../services/geminiService', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/geminiService')>();
  return { ...actual, sendMrSlopMessage: harness.send };
});

vi.mock('../services/specimenStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/specimenStore')>();
  return {
    ...actual,
    loadSpecimens: vi.fn(async () => harness.loaded),
    saveSpecimens: harness.save,
  };
});

import App from '../App';
import BreedingPicker from '../components/BreedingPicker';
import BreedingPreviewCard from '../components/BreedingPreviewCard';
import { createBreedingPreview } from '../lib/breeding';
import { createGenome } from '../lib/genome';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { makeSpecimen } from '../services/specimenStore';
import type { Specimen } from '../types';

const spawned = (name: string, ids: string[]): Specimen =>
  makeSpecimen(createGenome(ids, SLOP_LIBRARY, 'stack'), name, 'spawned');

const openLoadedSpecimen = async (name: string) => {
  await screen.findByRole('button', { name: /build me/i });
  fireEvent.click(screen.getByRole('button', { name: /build me/i }));
  fireEvent.click(screen.getByRole('button', { name: /start from a specimen/i }));
  const label = await screen.findByText(name);
  fireEvent.click(label.closest('button')!);
};

describe('Round 2C breeding UI', () => {
  beforeEach(() => {
    harness.send.mockReset();
    harness.save.mockReset();
    harness.save.mockResolvedValue(undefined);
    harness.loaded = [];
  });

  it('offers only spawned specimens, blocks self-pairing, and shows factual contrast without mate ranking', () => {
    const a = spawned('ALPHA', ['tm-01', 'tm-15']);
    const b = spawned('BETA', ['tm-01', 'tm-02', 'tm-03']);
    const building = makeSpecimen(createGenome([], SLOP_LIBRARY, 'stack'), 'BUILDING', 'building');
    const onPreview = vi.fn();

    render(
      <BreedingPicker
        specimens={[a, b, building]}
        initialParentAId={a.id}
        onPreview={onPreview}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: /breed specimens/i });
    expect(within(dialog).queryByText('BUILDING')).not.toBeInTheDocument();

    const parentA = within(dialog).getByLabelText(/parent a/i) as HTMLSelectElement;
    const parentB = within(dialog).getByLabelText(/parent b/i) as HTMLSelectElement;
    expect(parentA.value).toBe(a.id);
    expect(parentB.value).toBe(b.id);

    expect(within(dialog).getByText(/generation/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/enabled components/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/compatibility/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/best mate/i)).not.toBeInTheDocument();

    fireEvent.change(parentB, { target: { value: a.id } });
    expect(within(dialog).getByRole('button', { name: /preview offspring/i })).toBeDisabled();

    fireEvent.change(parentB, { target: { value: b.id } });
    fireEvent.click(within(dialog).getByRole('button', { name: /preview offspring/i }));
    expect(onPreview).toHaveBeenCalledWith(a, b);
  });

  it('renders THIS CREATES OFFSPRING preview with an inspectable genetics receipt before approval', () => {
    const a = spawned('ALPHA', ['tm-01', 'tm-15']);
    const b = spawned('BETA', ['tm-01', 'tm-02']);
    const preview = createBreedingPreview(a, b, {
      seed: '00000000000000000000000000000022',
      now: 1000,
    });

    render(
      <BreedingPreviewCard
        preview={preview}
        specimenNames={{ [a.id]: a.name, [b.id]: b.name }}
        onApprove={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: /this creates offspring/i });
    expect(dialog).toHaveTextContent('ALPHA');
    expect(dialog).toHaveTextContent('BETA');
    expect(dialog).toHaveTextContent(/STACK/i);
    expect(within(dialog).getByRole('button', { name: /create offspring/i })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /genetics receipt/i }));
    expect(within(dialog).getByText(/GENETICS RECEIPT/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Algorithm:/i)).toBeInTheDocument();
  });

  it('previews and approves breeding without any Gemini call, then offers OPEN CHILD or STAY HERE', async () => {
    const a = spawned('PARENT ALPHA', ['tm-01', 'tm-15']);
    const b = spawned('PARENT BETA', ['tm-01', 'tm-02', 'tm-03']);
    harness.loaded = [a, b];

    render(<App />);
    await openLoadedSpecimen('PARENT ALPHA');

    const breed = screen.getByRole('button', { name: /breed specimen/i });
    fireEvent.click(breed);

    const picker = await screen.findByRole('dialog', { name: /breed specimens/i });
    expect(within(picker).getByLabelText(/parent a/i)).toHaveValue(a.id);
    expect(within(picker).getByLabelText(/parent b/i)).toHaveValue(b.id);

    fireEvent.click(within(picker).getByRole('button', { name: /preview offspring/i }));

    const preview = await screen.findByRole('dialog', { name: /this creates offspring/i });
    expect(harness.save).not.toHaveBeenCalled();
    expect(harness.send).not.toHaveBeenCalled();

    fireEvent.click(within(preview).getByRole('button', { name: /create offspring/i }));

    expect(await screen.findByRole('button', { name: /open child/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stay here/i })).toBeInTheDocument();
    expect(harness.send).not.toHaveBeenCalled();
    expect(harness.save).toHaveBeenCalledTimes(1);

    const saved = harness.save.mock.calls[0][0] as Specimen[];
    expect(saved).toHaveLength(3);
    const child = saved.find(item => item.lineage.kind === 'bred');
    expect(child).toBeDefined();
    expect(child?.currentGenome.mode).toBe('stack');
    expect(child?.geneticsReceipt).toBeDefined();
  });

  it('cancels a preview without writing anything', async () => {
    const a = spawned('CANCEL A', ['tm-01']);
    const b = spawned('CANCEL B', ['tm-02']);
    harness.loaded = [a, b];

    render(<App />);
    await openLoadedSpecimen('CANCEL A');

    fireEvent.click(screen.getByRole('button', { name: /breed specimen/i }));
    const picker = await screen.findByRole('dialog', { name: /breed specimens/i });
    fireEvent.click(within(picker).getByRole('button', { name: /preview offspring/i }));

    const preview = await screen.findByRole('dialog', { name: /this creates offspring/i });
    fireEvent.click(within(preview).getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog', { name: /this creates offspring/i })).not.toBeInTheDocument();
    expect(harness.save).not.toHaveBeenCalled();
    expect(harness.send).not.toHaveBeenCalled();
  });

  it('opens the persisted child only after the atomic save resolves', async () => {
    const a = spawned('ATOMIC A', ['tm-01']);
    const b = spawned('ATOMIC B', ['tm-02']);
    harness.loaded = [a, b];

    let resolveSave!: () => void;
    harness.save.mockImplementation(async () => {
      await new Promise<void>(resolve => {
        resolveSave = resolve;
      });
    });

    render(<App />);
    await openLoadedSpecimen('ATOMIC A');

    fireEvent.click(screen.getByRole('button', { name: /breed specimen/i }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: /breed specimens/i }))
      .getByRole('button', { name: /preview offspring/i }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: /this creates offspring/i }))
      .getByRole('button', { name: /create offspring/i }));

    await waitFor(() => expect(harness.save).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: /open child/i })).not.toBeInTheDocument();

    resolveSave();

    expect(await screen.findByRole('button', { name: /open child/i })).toBeInTheDocument();
  });
});
