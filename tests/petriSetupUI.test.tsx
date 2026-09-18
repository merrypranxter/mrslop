import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import PetriDishSetup from '../components/PetriDishSetup';
import { createGenome } from '../lib/genome';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { makeSpecimen } from '../services/specimenStore';
import type { Specimen } from '../types';

const spawned = (name: string, ids: string[] = ['tm-01']): Specimen =>
  makeSpecimen(createGenome(ids, SLOP_LIBRARY, 'stack'), name, 'spawned');

describe('Petri Dish setup and preflight UI', () => {
  it('shows only spawned specimens and defaults to two eligible entrants', () => {
    const a = spawned('ALPHA');
    const b = spawned('BETA');
    const building = makeSpecimen(createGenome([], SLOP_LIBRARY, 'stack'), 'UNFORMED', 'building');

    render(
      <PetriDishSetup
        specimens={[a, b, building]}
        initialSpecimenId={a.id}
        onRun={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: /petri dish/i });
    expect(within(dialog).getByText('ALPHA')).toBeInTheDocument();
    expect(within(dialog).getByText('BETA')).toBeInTheDocument();
    expect(within(dialog).queryByText('UNFORMED')).not.toBeInTheDocument();

    const alpha = within(dialog).getByLabelText('ALPHA') as HTMLInputElement;
    const beta = within(dialog).getByLabelText('BETA') as HTMLInputElement;
    expect(alpha).toBeChecked();
    expect(beta).toBeChecked();
    expect(within(dialog).getByText(/2 specimens = 2 generation calls/i)).toBeInTheDocument();
  });

  it('requires a non-empty challenge and 2–8 entrants before run', () => {
    const a = spawned('ALPHA');
    const b = spawned('BETA');
    const c = spawned('GAMMA');
    const onRun = vi.fn();

    render(
      <PetriDishSetup
        specimens={[a, b, c]}
        initialSpecimenId={a.id}
        onRun={onRun}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: /petri dish/i });
    const run = within(dialog).getByRole('button', { name: /run petri dish/i });
    expect(run).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(/shared challenge/i), {
      target: { value: 'Make something strange and useful.' },
    });
    expect(run).toBeEnabled();

    fireEvent.click(within(dialog).getByLabelText('BETA'));
    expect(run).toBeDisabled();
    expect(within(dialog).getByText(/select at least 2 specimens/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByLabelText('GAMMA'));
    expect(run).toBeEnabled();
  });

  it('shows factual entrant context without compatibility or best-specimen ranking', () => {
    const a = spawned('ALPHA', ['tm-01', 'tm-02']);
    const b = spawned('BETA', ['tm-03']);

    render(
      <PetriDishSetup
        specimens={[a, b]}
        onRun={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: /petri dish/i });
    expect(dialog).toHaveTextContent(/GEN 0/i);
    expect(dialog).toHaveTextContent(/STACK/i);
    expect(dialog).toHaveTextContent(/PARTS/i);
    expect(dialog).toHaveTextContent(/TRAITS/i);
    expect(dialog).toHaveTextContent(/INFECTIONS/i);
    expect(dialog).not.toHaveTextContent(/compatibility/i);
    expect(dialog).not.toHaveTextContent(/best specimen/i);
    expect(dialog).not.toHaveTextContent(/fitness score/i);
  });

  it('blocks a selected FUSE entrant whose compiled kernel is missing', () => {
    const a = spawned('ALPHA');
    const b = spawned('BROKEN FUSE');
    b.currentGenome = {
      ...b.currentGenome,
      mode: 'fuse',
      compiledKernel: undefined,
    };

    render(
      <PetriDishSetup
        specimens={[a, b]}
        onRun={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: /petri dish/i });
    fireEvent.change(within(dialog).getByLabelText(/shared challenge/i), {
      target: { value: 'pressure test' },
    });

    expect(within(dialog).getByRole('button', { name: /run petri dish/i })).toBeDisabled();
    expect(within(dialog).getByText(/missing its compiled fuse kernel/i)).toBeInTheDocument();
  });

  it('does not run anything before explicit RUN PETRI DISH and passes exact selection/challenge when approved', () => {
    const a = spawned('ALPHA');
    const b = spawned('BETA');
    const onRun = vi.fn();

    render(
      <PetriDishSetup
        specimens={[a, b]}
        initialSpecimenId={a.id}
        onRun={onRun}
        onCancel={vi.fn()}
      />,
    );

    expect(onRun).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog', { name: /petri dish/i });
    fireEvent.change(within(dialog).getByLabelText(/shared challenge/i), {
      target: { value: '  preserve this exact challenge  ' },
    });
    expect(onRun).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: /run petri dish/i }));

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun.mock.calls[0][0].map((item: Specimen) => item.id)).toEqual([a.id, b.id]);
    expect(onRun.mock.calls[0][1]).toBe('  preserve this exact challenge  ');
  });

  it('cancel performs no run', () => {
    const a = spawned('ALPHA');
    const b = spawned('BETA');
    const onRun = vi.fn();
    const onCancel = vi.fn();

    render(
      <PetriDishSetup
        specimens={[a, b]}
        onRun={onRun}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRun).not.toHaveBeenCalled();
  });
});
