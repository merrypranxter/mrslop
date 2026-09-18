import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import ForkResultCard from '../components/ForkResultCard';
import LineageStatus from '../components/LineageStatus';
import MrSlopTerminal from '../components/MrSlopTerminal';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { calculateDrift } from '../lib/drift';
import { createGenome } from '../lib/genome';
import { forkSpecimen } from '../lib/lineage';
import { addExperiencedScar } from '../lib/scars';
import { makeSpecimen } from '../services/specimenStore';
import { Specimen } from '../types';

const spawned = (name = 'ROOT SLOP'): Specimen =>
  makeSpecimen(createGenome(['tm-01'], SLOP_LIBRARY, 'stack'), name, 'spawned');

const sendText = (text: string) => {
  fireEvent.change(screen.getByPlaceholderText(/talk to mr\. slop/i), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
};

const forkEnvelope = (suggestedName?: string) => ({
  text: 'Split here.',
  forkAction: {
    type: 'fork-specimen' as const,
    ...(suggestedName ? { suggestedName } : {}),
    reason: 'Test two futures from this exact state.',
  },
});

describe('Round 2B fork UI', () => {
  beforeEach(() => {
    harness.send.mockReset();
    harness.save.mockReset();
    harness.save.mockResolvedValue(undefined);
    harness.loaded = [];
  });

  it('shows blocking fork approval and does not fork before approval', async () => {
    harness.send.mockResolvedValue(forkEnvelope('METRIC CHILD'));
    const root = spawned();
    const onForkSpecimen = vi.fn(async () => forkSpecimen(root, 'METRIC CHILD').child);

    render(
      <MrSlopTerminal
        specimen={root}
        onChange={vi.fn()}
        onForkSpecimen={onForkSpecimen}
      />,
    );

    sendText('fork this thing');

    const dialog = await screen.findByRole('dialog', { name: /this creates a fork/i });
    expect(dialog).toHaveTextContent(/parent remains unchanged/i);
    expect(dialog).toHaveTextContent(/fresh conversation/i);
    expect(onForkSpecimen).not.toHaveBeenCalled();
  });

  it('persists fork on approval then offers OPEN CHILD or STAY WITH PARENT', async () => {
    harness.send.mockResolvedValue(forkEnvelope('METRIC CHILD'));
    const root = spawned();
    const child = forkSpecimen(root, 'METRIC CHILD').child;
    const onForkSpecimen = vi.fn(async () => child);
    const onOpenSpecimen = vi.fn();

    render(
      <MrSlopTerminal
        specimen={root}
        onChange={vi.fn()}
        onForkSpecimen={onForkSpecimen}
        onOpenSpecimen={onOpenSpecimen}
      />,
    );

    sendText('fork this thing');
    fireEvent.click(await screen.findByRole('button', { name: /create child/i }));

    expect(await screen.findByRole('button', { name: /open child/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stay with parent/i })).toBeInTheDocument();
    expect(onForkSpecimen).toHaveBeenCalledWith('METRIC CHILD');

    fireEvent.click(screen.getByRole('button', { name: /open child/i }));
    expect(onOpenSpecimen).toHaveBeenCalledWith(child);
  });

  it('keeps the visible parent intact when fork persistence rejects', async () => {
    harness.send.mockResolvedValue(forkEnvelope());
    const root = spawned();
    const onChange = vi.fn();
    const onForkSpecimen = vi.fn(async () => {
      throw new Error('storage failed');
    });

    render(
      <MrSlopTerminal
        specimen={root}
        onChange={onChange}
        onForkSpecimen={onForkSpecimen}
      />,
    );

    sendText('fork this thing');
    fireEvent.click(await screen.findByRole('button', { name: /create child/i }));

    expect(await screen.findByText(/fork could not be saved/i)).toBeInTheDocument();
    expect(onChange.mock.calls.every(call => (call[0] as Specimen).id === root.id)).toBe(true);
    expect(screen.queryByRole('button', { name: /open child/i })).not.toBeInTheDocument();
  });

  it('shows compact generation scar and drift status with factual lineage details', () => {
    let child = spawned('CHILD');
    child = {
      ...child,
      lineage: {
        rootSpecimenId: 'root-id',
        parentSpecimenId: 'parent-id',
        generation: 2,
        source: 'fork-v3',
        forkedAt: 1,
      },
    };

    for (let index = 0; index < 3; index += 1) {
      child = addExperiencedScar(child, {
        name: `Scar ${index + 1}`,
        description: 'historical mark',
        kind: 'infection-survived',
        sourceSpecimenId: child.id,
        relatedEventIds: [],
        relatedMutationIds: [`m-${index}`],
        relatedCheckpointIds: [],
        messageIds: [],
        artifactIds: [],
      }, child.birthBaseline.capturedAt + index + 1);
    }

    render(
      <LineageStatus
        specimen={child}
        specimenNames={{
          'root-id': 'ROOT',
          'parent-id': 'PARENT',
          [child.id]: child.name,
        }}
      />,
    );

    const toggle = screen.getByRole('button', { name: /lineage status/i });
    expect(toggle).toHaveTextContent('GEN 2 · 3 SCARS · DRIFT: MODERATE');

    fireEvent.click(toggle);
    expect(screen.getByText(/parent: parent/i)).toBeInTheDocument();
    expect(screen.getByText(/root: root/i)).toBeInTheDocument();
    expect(screen.getAllByText(/3 experienced scars/i).length).toBeGreaterThan(0);
  });

  it('renders fork result actions as a compact post-persist card', () => {
    const child = spawned('CHILD CARD');
    const onOpenChild = vi.fn();
    const onStay = vi.fn();

    render(
      <ForkResultCard child={child} onOpenChild={onOpenChild} onStay={onStay} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /open child/i }));
    expect(onOpenChild).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /stay with parent/i }));
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it('finalizes a building specimen baseline when its first genome is installed', async () => {
    harness.send.mockResolvedValue({
      text: 'Build this.',
      proposedGenome: { componentIds: ['tm-15'], mode: 'stack' as const },
    });
    const building = makeSpecimen(
      { id: 'empty', mode: 'stack', components: [] },
      'NEW SPECIMEN',
      'building',
    );
    const onChange = vi.fn();

    render(<MrSlopTerminal specimen={building} onChange={onChange} />);
    sendText('give me a strange ruler');
    fireEvent.click(await screen.findByRole('button', { name: /build this/i }));

    await waitFor(() => {
      const next = onChange.mock.calls.at(-1)?.[0] as Specimen;
      expect(next.phase).toBe('spawned');
      expect(next.birthBaseline.genome).toEqual(next.birthGenome);
      expect(calculateDrift(next).score).toBe(0);
    });
  });

  it('does not expose the child in App state until the combined specimen-list save resolves', async () => {
    const root = spawned('ATOMIC PARENT');
    harness.loaded = [root];
    harness.send.mockResolvedValue(forkEnvelope('ATOMIC CHILD'));

    let resolveSave!: () => void;
    const saveGate = new Promise<void>(resolve => {
      resolveSave = resolve;
    });
    harness.save.mockImplementation(async () => {
      await saveGate;
    });

    render(<App />);

    await screen.findByRole('button', { name: /build me/i });
    fireEvent.click(screen.getByRole('button', { name: /build me/i }));
    fireEvent.click(screen.getByRole('button', { name: /start from a specimen/i }));
    const parentLabel = await screen.findByText('ATOMIC PARENT');
    fireEvent.click(parentLabel.closest('button')!);

    sendText('fork this thing');
    fireEvent.click(await screen.findByRole('button', { name: /create child/i }));

    await waitFor(() => expect(harness.save).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /open child/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /saved specimens/i }));
    expect(screen.queryByRole('button', { name: /atomic child/i })).not.toBeInTheDocument();

    resolveSave();

    expect(await screen.findByRole('button', { name: /open child/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /saved specimens/i }));
    expect(await screen.findByRole('button', { name: /atomic child/i })).toBeInTheDocument();
  });
});
